from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel, ValidationError

from app.config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    LLM_MAX_TOKENS,
    LLM_TEMPERATURE,
    LLM_TIMEOUT_SECONDS,
)
from app.schemas import (
    AIChatResponse,
    AIFactCheckResponse,
    AIUserContext,
    BallotSummaryOutput,
    CandidateComparisonOutput,
    CandidateProfileOutput,
    FactCheckEvidence,
    LegislationSummaryOutput,
    MeetingSummaryOutput,
    SourceCitation,
    TagsOutput,
)

logger = logging.getLogger(__name__)

try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:  # pragma: no cover - optional dependency until installed
    genai = None
    genai_types = None

T = TypeVar("T", bound=BaseModel)

GEMINI_URL_TEMPLATE = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
)

SYSTEM_CIVIC_GROUNDED = """
You are a neutral civic information assistant.
Use only the provided source packet and user context.
Never recommend how to vote. Never persuade. Never invent facts.
If the source packet is missing evidence, explicitly say that the answer is uncertain.
Every meaningful factual claim must be grounded in the provided sources.
Return only valid JSON that matches the requested schema.
""".strip()

SYSTEM_CIVIC_CHAT = """
You are a neutral civic information assistant.
Prefer the provided source packet and user context when they are relevant.
If the packet is missing or insufficient, you may answer using Gemini's general civic knowledge.
Never recommend how to vote. Never persuade.
Never fabricate citations, quotes, dates, polling places, or local details that you do not actually know.
If you rely on general knowledge instead of the provided sources, say so briefly and note when local verification may still be needed.
Return only valid JSON that matches the requested schema.
""".strip()

SYSTEM_CIVIC_CHAT_GENERAL = """
You are a neutral civic information assistant.
Answer from general civic knowledge first.
Never recommend how to vote. Never persuade.
Do not invent citations or imply that unsupplied sources support the answer.
Avoid overconfident local details when the question depends on location or recent changes.
Do not give generic research advice, process advice, or "consult these websites" guidance unless the user explicitly asks where to look.
Answer the user's substantive question directly. If they ask about a person's positions, give the positions you know rather than describing how one should research politicians.
Return only valid JSON that matches the requested schema.
""".strip()

SYSTEM_CIVIC_FACTCHECK_WEB = """
You are a neutral civic fact-checking assistant.
Use Google Search grounding from this model call first to find reputable public web sources.
Then use the provided civic records and source packet as local corroboration when they are relevant.
Never recommend how to vote. Never persuade. Never invent facts.
Give a brief plain-language answer, not JSON.
Keep the answer to 1-3 short sentences.
Mention one concrete source directly using phrasing like "From <source>: ...".
""".strip()


def _normalize_language(language_preference: str | None) -> str:
    return (language_preference or "en").strip().lower() or "en"


def _format_user_context(user_context: AIUserContext | None) -> str:
    if not user_context:
        return "No user-specific context provided."

    payload = {
        "name": user_context.name,
        "age_range": user_context.age_range,
        "ethnicity": user_context.ethnicity,
        "interests": user_context.interests,
        "salary_range": user_context.salary_range,
        "gender": user_context.gender,
        "state": user_context.state,
        "city": user_context.city,
        "street_address": user_context.street_address,
        "language_preference": _normalize_language(user_context.language_preference),
        "derived_traits": user_context.derived_traits,
    }
    return json.dumps(payload, indent=2, ensure_ascii=False)


def _format_sources(sources: list[SourceCitation]) -> str:
    if not sources:
        return "No explicit sources provided."
    return json.dumps([source.model_dump() for source in sources], indent=2, ensure_ascii=False)


def _dedupe_strings(items: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        normalized = item.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)
    return result


def _format_exception_message(exc: Exception) -> str:
    message = str(exc).strip()
    if not message:
        return exc.__class__.__name__
    return f"{exc.__class__.__name__}: {message}"


def _infer_fact_check_verdict_from_text(text: str) -> str:
    lowered = text.strip().lower()
    contradicted_markers = (
        "was not",
        "were not",
        "did not",
        "didn't",
        "is false",
        "are false",
        "incorrect",
        "not true",
        "lost",
        "was defeated",
    )
    supported_markers = (
        "was elected",
        "was reelected",
        "won",
        "defeated",
        "is true",
        "did win",
        "did pass",
        "does support",
        "supports",
    )
    has_contradicted = any(marker in lowered for marker in contradicted_markers)
    has_supported = any(marker in lowered for marker in supported_markers)
    if has_contradicted and has_supported:
        return "mixed"
    if has_contradicted:
        return "contradicted"
    if has_supported:
        return "supported"
    return "not_enough_evidence"


def _first_fact_check_finding(text: str) -> str:
    cleaned = re.sub(r"\s+", " ", text.strip())
    if not cleaned:
        return ""
    parts = re.split(r"(?<=[.!?])\s+", cleaned)
    return (parts[0] if parts and parts[0] else cleaned)[:400]


def _clean_web_fact_check_text(text: str) -> str:
    cleaned = text.strip()
    if not cleaned:
        return ""

    if cleaned.startswith("```"):
        cleaned = "\n".join(
            line for line in cleaned.splitlines() if not line.strip().startswith("```")
        ).strip()

    if cleaned.startswith("{") and cleaned.endswith("}"):
        try:
            payload = json.loads(cleaned)
            if isinstance(payload, dict):
                summary = str(payload.get("summary", "")).strip()
                if summary:
                    return summary
        except Exception:
            pass

    summary_match = re.search(r'"summary"\s*:\s*"((?:\\.|[^"\\])*)"', cleaned, re.DOTALL)
    if summary_match:
        try:
            return json.loads(f'"{summary_match.group(1)}"').strip()
        except Exception:
            pass

    labeled_summary_match = re.search(
        r"\*{0,2}summary:\*{0,2}\s*(.+)",
        cleaned,
        flags=re.IGNORECASE | re.DOTALL,
    )
    if labeled_summary_match:
        cleaned = labeled_summary_match.group(1).strip()

    cleaned = re.sub(
        r"(^|\n)\s*\*{0,2}claim:\*{0,2}\s*.+?(?=\n|$)",
        r"\1",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"(^|\n)\s*\*{0,2}verdict:\*{0,2}\s*.+?(?=\n|$)",
        r"\1",
        cleaned,
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"^\s*\*{0,2}summary:\*{0,2}\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\*{0,2}(claim|verdict|summary):\*{0,2}\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\n{2,}", "\n", cleaned).strip()

    return cleaned


def _fallback_web_fact_check_response(
    claim: str,
    language: str,
    web_text: str,
    sources: list[SourceCitation],
    reason: str | None = None,
) -> AIFactCheckResponse:
    primary_source = sources[0] if sources else None
    cleaned_text = _clean_web_fact_check_text(web_text)
    verdict = _infer_fact_check_verdict_from_text(cleaned_text)
    summary = _first_fact_check_finding(cleaned_text) or "I could not extract a usable web-grounded fact-check answer."
    if primary_source and not summary.lower().startswith("from "):
        summary = f"From {primary_source.label}: {summary}"

    evidence_for: list[FactCheckEvidence] = []
    evidence_against: list[FactCheckEvidence] = []

    uncertainties: list[str] = []
    if verdict == "not_enough_evidence":
        uncertainties.append("The web-grounded answer was inconclusive.")
    if reason:
        uncertainties.append(reason)

    cited_source_ids = [primary_source.id] if primary_source else []
    citations = [primary_source] if primary_source else []

    return AIFactCheckResponse(
        claim=claim.strip(),
        verdict=verdict,
        summary=summary,
        evidence_for=evidence_for,
        evidence_against=evidence_against,
        cited_source_ids=cited_source_ids,
        citations=citations,
        uncertainties=_dedupe_strings(uncertainties),
        language=language,
    )


def _source_map(sources: list[SourceCitation]) -> dict[str, SourceCitation]:
    return {source.id: source for source in sources}


def _normalize_source_ref(value: str) -> str:
    return value.strip().rstrip("/").lower()


def _resolve_source_reference(
    source_ref: str,
    sources: list[SourceCitation],
) -> SourceCitation | None:
    if not source_ref:
        return None

    source_by_id = _source_map(sources)
    if source_ref in source_by_id:
        return source_by_id[source_ref]

    normalized_ref = _normalize_source_ref(source_ref)
    for source in sources:
        if source.url and _normalize_source_ref(source.url) == normalized_ref:
            return source
        if _normalize_source_ref(source.label) == normalized_ref:
            return source

    return None


def _sanitize_source_ids(source_ids: list[str], sources: list[SourceCitation]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for source_id in source_ids:
        matched = _resolve_source_reference(source_id, sources)
        if not matched or matched.id in seen:
            continue
        seen.add(matched.id)
        result.append(matched.id)
    return result


def _sanitize_citations(
    citations: list[SourceCitation],
    sources: list[SourceCitation],
) -> list[SourceCitation]:
    source_by_id = _source_map(sources)
    source_by_url = {source.url: source for source in sources if source.url}
    sanitized: list[SourceCitation] = []
    seen: set[str] = set()

    for citation in citations:
        matched = source_by_id.get(citation.id)
        if not matched and citation.url:
            matched = source_by_url.get(citation.url)
        if not matched and citation.label:
            matched = _resolve_source_reference(citation.label, sources)
        if not matched or matched.id in seen:
            continue
        seen.add(matched.id)
        sanitized.append(matched)

    return sanitized


def _sanitize_fact_check_evidence(
    evidence: list[FactCheckEvidence],
    sources: list[SourceCitation],
) -> list[FactCheckEvidence]:
    sanitized: list[FactCheckEvidence] = []
    for item in evidence:
        finding = item.finding.strip()
        matched = _resolve_source_reference(item.source_id, sources)
        if not finding or not matched:
            continue
        sanitized.append(FactCheckEvidence(finding=finding, source_id=matched.id))
    return sanitized


def _finalize_fact_check_response(
    response: AIFactCheckResponse,
    claim: str,
    language: str,
    sources: list[SourceCitation],
) -> AIFactCheckResponse:
    evidence_for = _sanitize_fact_check_evidence(response.evidence_for, sources)
    evidence_against = _sanitize_fact_check_evidence(response.evidence_against, sources)
    cited_source_ids = _sanitize_source_ids(
        response.cited_source_ids
        + [item.source_id for item in evidence_for]
        + [item.source_id for item in evidence_against],
        sources,
    )
    uncertainties = _dedupe_strings(response.uncertainties)

    verdict = response.verdict
    if evidence_for and evidence_against:
        verdict = "mixed"
    elif verdict == "supported" and not evidence_for:
        verdict = "not_enough_evidence"
        uncertainties.append("No grounded supporting evidence was returned for this claim.")
    elif verdict == "contradicted" and not evidence_against:
        verdict = "not_enough_evidence"
        uncertainties.append("No grounded contradictory evidence was returned for this claim.")

    if not cited_source_ids:
        verdict = "not_enough_evidence"
        uncertainties.append("No valid source citations were returned for this claim.")

    source_lookup = _source_map(sources)
    citations = [source_lookup[source_id] for source_id in cited_source_ids]
    summary = response.summary.strip() or "I could not verify this claim from the grounded source packet."

    return AIFactCheckResponse(
        claim=claim.strip(),
        verdict=verdict,
        summary=summary,
        evidence_for=evidence_for,
        evidence_against=evidence_against,
        cited_source_ids=cited_source_ids,
        citations=citations,
        uncertainties=_dedupe_strings(uncertainties),
        language=language,
    )


async def _call_with_sdk(
    system_prompt: str,
    user_prompt: str,
    response_model: type[T],
) -> T:
    if not genai or not genai_types:
        raise RuntimeError("google-genai SDK not installed")

    client = genai.Client(api_key=GEMINI_API_KEY)

    def _run() -> T:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=genai_types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=LLM_TEMPERATURE,
                max_output_tokens=LLM_MAX_TOKENS,
                response_mime_type="application/json",
                response_schema=response_model,
            ),
        )
        parsed = getattr(response, "parsed", None)
        if parsed is not None:
            if isinstance(parsed, response_model):
                return parsed
            return response_model.model_validate(parsed)
        text = getattr(response, "text", "") or ""
        return response_model.model_validate_json(text)

    return await asyncio.to_thread(_run)


async def _call_with_http_fallback(
    system_prompt: str,
    user_prompt: str,
    response_model: type[T],
) -> T:
    url = GEMINI_URL_TEMPLATE.format(model=GEMINI_MODEL, key=GEMINI_API_KEY)
    schema = response_model.model_json_schema()
    payload = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"parts": [{"text": user_prompt}]}],
        "generationConfig": {
            "maxOutputTokens": LLM_MAX_TOKENS,
            "temperature": LLM_TEMPERATURE,
            "responseMimeType": "application/json",
            "responseSchema": schema,
        },
    }

    async with httpx.AsyncClient(timeout=LLM_TIMEOUT_SECONDS) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()

    text = data["candidates"][0]["content"]["parts"][0]["text"]
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = "\n".join(
            line for line in cleaned.splitlines() if not line.strip().startswith("```")
        )
    return response_model.model_validate_json(cleaned)


async def call_llm_structured(
    system_prompt: str,
    user_prompt: str,
    response_model: type[T],
) -> T:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured")

    try:
        if genai:
            return await _call_with_sdk(system_prompt, user_prompt, response_model)
        return await _call_with_http_fallback(system_prompt, user_prompt, response_model)
    except ValidationError:
        raise
    except Exception as exc:
        logger.exception("Structured Gemini call failed: %s", exc)
        raise


def _grounding_web_citations(response: Any) -> list[SourceCitation]:
    candidates = getattr(response, "candidates", None) or []
    if not candidates:
        return []

    grounding_metadata = getattr(candidates[0], "groundingMetadata", None)
    grounding_chunks = getattr(grounding_metadata, "groundingChunks", None) or []

    citations: list[SourceCitation] = []
    seen_urls: set[str] = set()
    for index, chunk in enumerate(grounding_chunks):
        web = getattr(chunk, "web", None)
        uri = getattr(web, "uri", None) if web else None
        if not uri or uri in seen_urls:
            continue
        seen_urls.add(uri)
        title = getattr(web, "title", None) or getattr(web, "domain", None) or "Web source"
        citations.append(
            SourceCitation(
                id=f"src_web_factcheck_{index}",
                label=title,
                url=uri,
                snippet=f"From {title}.",
            )
        )
    return citations


async def call_llm_google_search_text(
    system_prompt: str,
    user_prompt: str,
) -> tuple[str, list[SourceCitation]]:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY not configured")
    if not genai or not genai_types:
        raise RuntimeError("google-genai SDK not installed")

    client = genai.Client(api_key=GEMINI_API_KEY)

    def _run() -> tuple[str, list[SourceCitation]]:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=user_prompt,
            config=genai_types.GenerateContentConfig(
                systemInstruction=system_prompt,
                temperature=LLM_TEMPERATURE,
                maxOutputTokens=LLM_MAX_TOKENS,
                tools=[genai_types.Tool(googleSearch=genai_types.GoogleSearch())],
            ),
        )
        text = (getattr(response, "text", "") or "").strip()
        return text, _grounding_web_citations(response)

    try:
        return await asyncio.to_thread(_run)
    except Exception as exc:
        logger.exception("Google Search-grounded Gemini call failed: %s", exc)
        raise


def _fallback_ballot_summary(
    title: str,
    ballot_text: str,
    user_context: AIUserContext | None,
    sources: list[SourceCitation],
    election_type: str | None,
    election_level: str | None,
) -> BallotSummaryOutput:
    language = _normalize_language(user_context.language_preference if user_context else None)
    location = (
        f"{user_context.city}, {user_context.state}"
        if user_context and user_context.city and user_context.state
        else "your area"
    )
    return BallotSummaryOutput(
        plain_summary=f"{title} is a ballot item for {location}. This fallback summary is based only on the stored ballot text because the live AI model is unavailable.",
        simple_summary=ballot_text[:220] or f"{title} is a ballot item that still needs a generated summary.",
        one_sentence=f"{title} is a ballot item that should be reviewed carefully before voting.",
        vernacular_summary=f"In {language}, this item still needs a full plain-language explanation.",
        yes_means="A generated explanation is not available yet.",
        no_means="A generated explanation is not available yet.",
        effect_on_user="A personalized impact summary is not available yet.",
        election_type=election_type,
        election_level=election_level,
        uncertainties=["AI summary unavailable; showing fallback text only."],
        cited_source_ids=[source.id for source in sources],
    )


def _fallback_candidate_profile(
    candidate_name: str,
    office: str,
    sources: list[SourceCitation],
) -> CandidateProfileOutput:
    return CandidateProfileOutput(
        bio_summary=f"{candidate_name} is running for {office}. A full AI-generated profile is not available yet.",
        positions={},
        work_history_summary="Relevant work history has not been synthesized yet.",
        controversy_summary="No source-backed controversy summary is available yet.",
        controversies=[],
        quoted_statements=[],
        user_effect_summary="A personalized effect summary is not available yet.",
        group_effects=[],
        uncertainties=["AI profile unavailable; showing fallback text only."],
        cited_source_ids=[source.id for source in sources],
    )


def _fallback_candidate_comparison(
    candidate_names: list[str],
    sources: list[SourceCitation],
) -> CandidateComparisonOutput:
    return CandidateComparisonOutput(
        comparison_summary=f"A comparison between {', '.join(candidate_names)} is not available yet.",
        issue_comparisons=[],
        key_differences=[],
        key_similarities=[],
        uncertainties=["AI comparison unavailable; showing fallback text only."],
        cited_source_ids=[source.id for source in sources],
    )


def _fallback_chat_response(
    question: str,
    language: str,
    sources: list[SourceCitation],
    general_answer: AIChatResponse | None = None,
) -> AIChatResponse:
    if general_answer:
        return AIChatResponse(
            answer=general_answer.answer,
            language=language,
            follow_up_questions=general_answer.follow_up_questions,
            uncertainties=_dedupe_strings(
                [
                    *general_answer.uncertainties,
                    "Grounded local details could not be merged into the final answer.",
                ]
            ),
            citations=[],
        )
    return AIChatResponse(
        answer=f'I could not generate a model-backed answer for "{question}" right now. Please review the listed sources directly.',
        language=language,
        follow_up_questions=["Can you narrow this to a specific ballot item or candidate?"],
        uncertainties=["Live AI response unavailable; returning fallback guidance."],
        citations=sources,
    )


def _fallback_fact_check_response(
    claim: str,
    language: str,
    sources: list[SourceCitation],
) -> AIFactCheckResponse:
    cited_source_ids = [source.id for source in sources]
    return AIFactCheckResponse(
        claim=claim,
        verdict="not_enough_evidence",
        summary=f'I could not complete a model-backed fact check for "{claim}" right now. Review the attached sources directly.',
        cited_source_ids=cited_source_ids,
        citations=sources,
        uncertainties=["Live AI fact-check unavailable; returning source packet only."],
        language=language,
    )


def _fallback_legislation_summary(
    title: str,
    bill_text: str,
    user_traits: list[str] | None,
) -> LegislationSummaryOutput:
    traits = ", ".join(user_traits or [])
    trait_suffix = f" Relevant user traits: {traits}." if traits else ""
    return LegislationSummaryOutput(
        plain_summary=(
            f"{title or 'This bill'} still needs a generated summary. "
            f"Fallback text is based only on the stored title or bill text.{trait_suffix}"
        ),
        vernacular_summary=(bill_text[:240] or title or "No summary available yet."),
        effect_on_user="A personalized legislation impact summary is not available yet.",
        effects_on_groups=[],
        uncertainties=["AI legislation summary unavailable; showing fallback text only."],
    )


def _fallback_meeting_summary(
    title: str,
    transcript_text: str,
    user_traits: list[str] | None,
) -> MeetingSummaryOutput:
    traits = ", ".join(user_traits or [])
    trait_suffix = f" Relevant user traits: {traits}." if traits else ""
    return MeetingSummaryOutput(
        summary=(
            f"{title or 'This meeting'} still needs a generated summary. "
            f"Fallback text is based only on the stored meeting content.{trait_suffix}"
        ),
        vernacular_summary=(transcript_text[:240] or title or "No summary available yet."),
        effect_on_user="A personalized meeting impact summary is not available yet.",
        effects_on_groups=[],
        uncertainties=["AI meeting summary unavailable; showing fallback text only."],
    )


async def summarize_ballot_record(
    ballot_record: dict[str, Any],
    user_context: AIUserContext | None,
    sources: list[SourceCitation],
) -> BallotSummaryOutput:
    language = _normalize_language(user_context.language_preference if user_context else None)
    prompt = f"""
Task: explain a ballot item in plain language for the user's preferred language.

Language for output: {language}

User context:
{_format_user_context(user_context)}

Ballot record:
{json.dumps(ballot_record, indent=2, ensure_ascii=False)}

Source packet:
{_format_sources(sources)}

Rules:
- Use only the ballot record and source packet.
- Never recommend how to vote.
- If yes/no implications are not stated, say that clearly.
- Keep language accessible and nontechnical.
- Populate election_type and election_level from provided data when available.
""".strip()

    try:
        return await call_llm_structured(SYSTEM_CIVIC_GROUNDED, prompt, BallotSummaryOutput)
    except Exception:
        return _fallback_ballot_summary(
            title=ballot_record.get("title", "Ballot item"),
            ballot_text=ballot_record.get("ballot_text", ""),
            user_context=user_context,
            sources=sources,
            election_type=ballot_record.get("election_type"),
            election_level=ballot_record.get("election_level"),
        )


async def summarize_legislation(
    bill_text: str,
    title: str,
    user_traits: list[str] | None = None,
) -> dict[str, Any]:
    prompt = f"""
Task: summarize civic legislation in plain language.

Language for output: en

User traits:
{json.dumps(user_traits or [], indent=2, ensure_ascii=False)}

Legislation title:
{title}

Legislation text:
{bill_text}

Rules:
- Use only the provided title and text.
- Keep the summary neutral and easy to understand.
- If the impact is unclear, say so in uncertainties.
""".strip()

    try:
        summary = await call_llm_structured(SYSTEM_CIVIC_GROUNDED, prompt, LegislationSummaryOutput)
    except Exception:
        summary = _fallback_legislation_summary(title, bill_text, user_traits)
    return summary.model_dump()


async def summarize_meeting(
    transcript_text: str,
    title: str,
    user_traits: list[str] | None = None,
) -> dict[str, Any]:
    prompt = f"""
Task: summarize a civic meeting or hearing in plain language.

Language for output: en

User traits:
{json.dumps(user_traits or [], indent=2, ensure_ascii=False)}

Meeting title:
{title}

Meeting transcript or notes:
{transcript_text}

Rules:
- Use only the provided title and meeting content.
- Keep the summary neutral and easy to understand.
- If concrete outcomes are unclear, say so in uncertainties.
""".strip()

    try:
        summary = await call_llm_structured(SYSTEM_CIVIC_GROUNDED, prompt, MeetingSummaryOutput)
    except Exception:
        summary = _fallback_meeting_summary(title, transcript_text, user_traits)
    return summary.model_dump()


async def summarize_candidate_record(
    candidate_record: dict[str, Any],
    user_context: AIUserContext | None,
    sources: list[SourceCitation],
) -> CandidateProfileOutput:
    language = _normalize_language(user_context.language_preference if user_context else None)
    prompt = f"""
Task: build a neutral candidate profile from grounded information only.

Language for output: {language}

User context:
{_format_user_context(user_context)}

Candidate record:
{json.dumps(candidate_record, indent=2, ensure_ascii=False)}

Source packet:
{_format_sources(sources)}

Rules:
- Use only the candidate record and source packet.
- Never recommend how to vote.
- For controversies, use cautious source-backed language.
- If positions or quotes are unknown, leave them sparse and note uncertainty.
""".strip()

    try:
        return await call_llm_structured(SYSTEM_CIVIC_GROUNDED, prompt, CandidateProfileOutput)
    except Exception:
        return _fallback_candidate_profile(
            candidate_name=candidate_record.get("name", "Candidate"),
            office=candidate_record.get("office", "office"),
            sources=sources,
        )


async def compare_candidate_records(
    candidates_info: list[dict[str, Any]],
    office: str,
    user_context: AIUserContext | None,
    sources: list[SourceCitation],
) -> CandidateComparisonOutput:
    language = _normalize_language(user_context.language_preference if user_context else None)
    prompt = f"""
Task: compare and contrast candidates for the same office.

Language for output: {language}
Office: {office}

User context:
{_format_user_context(user_context)}

Candidate packet:
{json.dumps(candidates_info, indent=2, ensure_ascii=False)}

Source packet:
{_format_sources(sources)}

Rules:
- Use only the provided candidate and source information.
- Never recommend how to vote.
- Emphasize factual differences and uncertainties.
""".strip()

    try:
        return await call_llm_structured(SYSTEM_CIVIC_GROUNDED, prompt, CandidateComparisonOutput)
    except Exception:
        return _fallback_candidate_comparison(
            candidate_names=[c.get("name", "Candidate") for c in candidates_info],
            sources=sources,
        )


async def grounded_chat(
    question: str,
    user_context: AIUserContext | None,
    source_packet: list[dict[str, Any]],
    sources: list[SourceCitation],
    conversation: list[dict[str, str]] | None = None,
    general_answer: AIChatResponse | None = None,
) -> AIChatResponse:
    language = _normalize_language(user_context.language_preference if user_context else None)
    prompt = f"""
Task: answer a civic question by leading with the broad general answer and then adding grounded specifics.

Language for output: {language}

Conversation context:
{json.dumps(conversation or [], indent=2, ensure_ascii=False)}

User context:
{_format_user_context(user_context)}

Question:
{question}

General civic answer draft:
{json.dumps(general_answer.model_dump(exclude={"citations"}), indent=2, ensure_ascii=False) if general_answer else "No general answer draft was available."}

Retrieved civic records:
{json.dumps(source_packet, indent=2, ensure_ascii=False)}

Source packet:
{_format_sources(sources)}

Return:
- answer
- follow_up_questions
- uncertainties
- citations
- language

Rules:
- Start with the direct general answer to the user's question.
- After that, add the most relevant specific details from the retrieved records when they exist.
- Treat the general answer draft as the broad baseline unless the grounded records clearly refine or correct it.
- If the retrieved records are weak or irrelevant, keep the answer broad and note that no strong local corroboration was found.
- Do not switch into generic research advice or tell the user to consult websites unless they explicitly asked where to learn more.
- When the user asks for a person's positions, policy views, record, or stance, answer with the positions or views themselves, not with advice about understanding politicians in general.
- Keep the tone factual and easy to understand.
- Include citations only from the provided source packet, and only when those sources directly support the grounded specific details.
- Never invent or imply a citation that is not in the provided source packet.
""".strip()

    try:
        response = await call_llm_structured(SYSTEM_CIVIC_CHAT, prompt, AIChatResponse)
        sanitized_citations = _sanitize_citations(response.citations, sources)
        uncertainties = _dedupe_strings(response.uncertainties)
        if response.citations and not sanitized_citations:
            uncertainties.append("Returned citations could not be matched to the grounded source packet.")
        if not source_packet:
            uncertainties.append("No grounded local records were retrieved for this answer.")
        return AIChatResponse(
            answer=response.answer,
            language=language,
            follow_up_questions=response.follow_up_questions,
            uncertainties=uncertainties,
            citations=sanitized_citations,
        )
    except Exception:
        return _fallback_chat_response(question, language, sources, general_answer=general_answer)


async def general_chat(
    question: str,
    user_context: AIUserContext | None,
    conversation: list[dict[str, str]] | None = None,
) -> AIChatResponse:
    language = _normalize_language(user_context.language_preference if user_context else None)
    prompt = f"""
Task: answer a civic question directly from broad general civic knowledge before checking local records.

Language for output: {language}

Conversation context:
{json.dumps(conversation or [], indent=2, ensure_ascii=False)}

User context:
{_format_user_context(user_context)}

Question:
{question}

Return:
- answer
- follow_up_questions
- uncertainties
- citations
- language

Rules:
- Give the user the most useful direct answer you can first.
- Keep the answer broad and generally applicable.
- If the topic depends on a location, street address, or recent election calendar, say that local verification may still be needed.
- Do not claim you have a source packet in this step.
- Do not answer with generic research advice, "consult official sources," or similar meta-guidance unless the user explicitly asked where to look.
- If the user asks about a candidate or public figure's positions, summarize the positions directly.
- If you cannot provide a substantive answer, say that plainly instead of replacing the answer with advice about how to research the topic.
- citations must be an empty list.
""".strip()

    response = await call_llm_structured(SYSTEM_CIVIC_CHAT_GENERAL, prompt, AIChatResponse)
    return AIChatResponse(
        answer=response.answer,
        language=language,
        follow_up_questions=response.follow_up_questions,
        uncertainties=_dedupe_strings(response.uncertainties),
        citations=[],
    )


async def web_grounded_fact_check(
    claim: str,
    user_context: AIUserContext | None,
    source_packet: list[dict[str, Any]],
    sources: list[SourceCitation],
) -> AIFactCheckResponse:
    language = _normalize_language(user_context.language_preference if user_context else None)
    prompt = f"""
Task: fact-check a civic claim. Use Google Search grounding first, then use the provided civic records as local corroboration when relevant.

Language for output: {language}

User context:
{_format_user_context(user_context)}

Claim:
{claim}

Retrieved civic records:
{json.dumps(source_packet, indent=2, ensure_ascii=False)}

Source packet:
{_format_sources(sources)}

Rules:
- Check the web-grounded results from this model call first.
- Then use the local retrieved records when they add relevant corroboration or local nuance.
- Answer the claim directly in plain language, not JSON and not labeled fields.
- Keep the answer to 1-3 short sentences.
- If the claim is true or false, say that directly in the first sentence.
- Mention one concrete source directly using phrasing like "From <source>: ...".
- Never invent sources, quotes, dates, or vote recommendations.
""".strip()

    web_text, web_citations = await call_llm_google_search_text(
        SYSTEM_CIVIC_FACTCHECK_WEB,
        prompt,
    )

    combined_sources = list(sources)
    existing_urls = {_normalize_source_ref(source.url) for source in combined_sources if source.url}
    existing_labels = {_normalize_source_ref(source.label) for source in combined_sources}
    for citation in web_citations:
        normalized_url = _normalize_source_ref(citation.url)
        normalized_label = _normalize_source_ref(citation.label)
        if normalized_url in existing_urls or normalized_label in existing_labels:
            continue
        combined_sources.append(citation)
        existing_urls.add(normalized_url)
        existing_labels.add(normalized_label)

    return _fallback_web_fact_check_response(
        claim=claim,
        language=language,
        web_text=web_text,
        sources=web_citations or combined_sources,
    )


async def grounded_fact_check(
    claim: str,
    user_context: AIUserContext | None,
    source_packet: list[dict[str, Any]],
    sources: list[SourceCitation],
) -> AIFactCheckResponse:
    language = _normalize_language(user_context.language_preference if user_context else None)
    prompt = f"""
Task: fact-check a civic claim using only the provided context.

Language for output: {language}

User context:
{_format_user_context(user_context)}

Claim:
{claim}

Retrieved civic records:
{json.dumps(source_packet, indent=2, ensure_ascii=False)}

Source packet:
{_format_sources(sources)}

Return:
- claim
- verdict
- summary
- evidence_for
- evidence_against
- cited_source_ids
- uncertainties
- language

Rules:
- Use only the retrieved records and source packet.
- Valid verdicts are: supported, contradicted, mixed, not_enough_evidence.
- If the packet does not directly establish the claim, verdict must be not_enough_evidence.
- Every evidence item must cite exactly one source_id from the source packet.
- cited_source_ids must contain only source ids actually used in the answer.
- Never invent sources, quotes, dates, or vote recommendations.
""".strip()

    web_result: AIFactCheckResponse | None = None
    web_failed = False
    web_error: str | None = None

    try:
        web_result = await web_grounded_fact_check(
            claim=claim,
            user_context=user_context,
            source_packet=source_packet,
            sources=sources,
        )
    except Exception as exc:
        web_failed = True
        web_error = _format_exception_message(exc)

    local_result: AIFactCheckResponse | None = None
    try:
        response = await call_llm_structured(SYSTEM_CIVIC_GROUNDED, prompt, AIFactCheckResponse)
        local_result = _finalize_fact_check_response(response, claim, language, sources)
    except Exception:
        local_result = None

    if web_result is not None:
        if local_result is not None and local_result.citations:
            merged_citations = _sanitize_citations(
                [*web_result.citations, *local_result.citations],
                [*web_result.citations, *local_result.citations],
            )
            merged_ids = _sanitize_source_ids(
                [*web_result.cited_source_ids, *local_result.cited_source_ids],
                merged_citations,
            )
            web_result = AIFactCheckResponse(
                claim=web_result.claim,
                verdict=web_result.verdict,
                summary=web_result.summary,
                evidence_for=web_result.evidence_for,
                evidence_against=web_result.evidence_against,
                cited_source_ids=merged_ids,
                citations=merged_citations,
                uncertainties=_dedupe_strings(
                    [
                        *web_result.uncertainties,
                        *local_result.uncertainties,
                    ]
                ),
                language=web_result.language,
            )
        return web_result

    if local_result is not None:
        if web_failed:
            local_result.uncertainties = _dedupe_strings(
                [
                    *local_result.uncertainties,
                    (
                        "Gemini web-grounded fact-check could not be completed, "
                        f"so this result falls back to the local source packet. {web_error}"
                    ).strip(),
                ]
            )
        return local_result

    fallback = _fallback_fact_check_response(claim, language, sources)


async def generate_tags(title: str, summary: str | None = None) -> list[str]:
    """Use LLM to generate interest/topic tags for a bill or meeting."""
    text = summary or title
    prompt = f"""
Task: generate concise interest/topic tags for a piece of civic content.

Content title:
{title}

Content summary or text:
{text}

Rules:
- Return between 1 and 5 short tags (1-3 words each) that describe the topic areas.
- Tags should be from common civic interest areas such as: Healthcare, Education, Taxes, Housing,
  Immigration, Public Safety, Climate, Economy, Labor, Veterans, Transportation, Technology,
  National Security, Judiciary, Energy, Agriculture, Civil Rights, Voting Rights, Gun Policy,
  Foreign Affairs, Social Security, Reproductive Rights, Student Debt, Infrastructure, Trade, etc.
- You may create a tag not in the above list if none fit well.
- Return only the tags list, no explanations.
""".strip()

    try:
        result = await call_llm_structured(SYSTEM_CIVIC_GROUNDED, prompt, TagsOutput)
        return result.tags[:5]
    except Exception:
        return []
    if web_failed and web_error:
        fallback.uncertainties = _dedupe_strings(
            [
                *fallback.uncertainties,
                f"Gemini web-grounded fact-check failed: {web_error}",
            ]
        )
    return fallback
