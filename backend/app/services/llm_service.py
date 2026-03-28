from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import LLM_MAX_TOKENS, LLM_TEMPERATURE, OPENAI_API_KEY, OPENAI_MODEL

logger = logging.getLogger(__name__)

OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"


async def call_llm(system_prompt: str, user_prompt: str) -> str:
    """Send a prompt to the OpenAI chat API and return the text response."""
    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set – returning empty LLM response")
        return ""

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": LLM_MAX_TOKENS,
        "temperature": LLM_TEMPERATURE,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(OPENAI_CHAT_URL, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
    return data["choices"][0]["message"]["content"]


async def call_llm_json(system_prompt: str, user_prompt: str) -> dict[str, Any]:
    """Call LLM and parse the response as JSON."""
    raw = await call_llm(system_prompt, user_prompt)
    # Strip markdown fences if present
    text = raw.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        logger.error("LLM returned invalid JSON: %s", text[:500])
        return {"raw_response": raw}


# --------------- prompt builders ---------------

SYSTEM_CIVIC = (
    "You are a neutral civic information assistant. "
    "Never recommend how to vote. Never persuade. "
    "Use plain, easy-to-understand language. "
    "Mention uncertainty when appropriate. "
    "Always return valid JSON."
)


async def summarize_ballot_text(
    ballot_text: str,
    title: str,
    user_traits: list[str] | None = None,
) -> dict[str, Any]:
    """Summarize a ballot item into plain language."""
    traits_str = ", ".join(user_traits) if user_traits else "general voter"
    prompt = f"""Task: Explain the following ballot question in plain language.

Ballot Title: {title}

Ballot Text:
{ballot_text}

User Traits: {traits_str}

Return valid JSON with these keys:
- plain_summary: a clear paragraph explaining what this is about
- simple_summary: one or two sentence version
- one_sentence: single sentence summary
- yes_means: what a yes vote means
- no_means: what a no vote means
- effect_on_user: how this might affect someone with the listed traits
- effects_on_groups: array of objects with "group" and "effect" keys

Rules:
- Be neutral
- Do not persuade or recommend
- Use easy language
- Mention uncertainty if needed"""
    return await call_llm_json(SYSTEM_CIVIC, prompt)


async def summarize_candidate(
    candidate_info: str,
    office: str,
    user_traits: list[str] | None = None,
) -> dict[str, Any]:
    """Summarize candidate information into a structured profile."""
    traits_str = ", ".join(user_traits) if user_traits else "general voter"
    prompt = f"""Task: Create a neutral candidate profile summary.

Office: {office}

Candidate Information:
{candidate_info}

User Traits: {traits_str}

Return valid JSON with these keys:
- bio_summary: brief biography
- positions: object with issue topics as keys and position descriptions as values
- work_history_summary: relevant work/political experience
- controversy_summary: any notable controversies (cite sources, use careful language like "critics have raised" or "reported allegations")
- user_effect_summary: how this candidate's positions might affect someone with the listed traits
- group_effects: array of objects with "group" and "effect" keys

Rules:
- Be neutral and factual
- Do not endorse or oppose
- Use source-backed language for controversies
- Mention uncertainty when appropriate"""
    return await call_llm_json(SYSTEM_CIVIC, prompt)


async def compare_candidates(
    candidates_info: list[dict[str, Any]],
    office: str,
) -> dict[str, Any]:
    """Generate a compare/contrast between candidates."""
    info_str = json.dumps(candidates_info, indent=2)
    prompt = f"""Task: Compare and contrast the following candidates running for the same office.

Office: {office}

Candidates:
{info_str}

Return valid JSON with these keys:
- comparison_summary: brief overall comparison
- issue_comparisons: array of objects with "issue", and one key per candidate name containing their position
- key_differences: array of strings summarizing major differences
- key_similarities: array of strings summarizing major similarities

Rules:
- Be neutral and balanced
- Do not favor any candidate
- Use factual language"""
    return await call_llm_json(SYSTEM_CIVIC, prompt)


async def summarize_legislation(
    bill_text: str,
    title: str,
    user_traits: list[str] | None = None,
) -> dict[str, Any]:
    """Summarize a bill or legislation into plain language."""
    traits_str = ", ".join(user_traits) if user_traits else "general citizen"
    prompt = f"""Task: Explain the following legislation in plain language.

Title: {title}

Bill Text / Summary:
{bill_text}

User Traits: {traits_str}

Return valid JSON with these keys:
- plain_summary: clear paragraph explaining what this legislation does
- vernacular_summary: very simple, everyday language version
- what_changes: what changes in law or policy
- who_affected: who is affected and how
- effect_on_user: how this might affect someone with the listed traits
- effects_on_groups: array of objects with "group" and "effect" keys
- uncertainties: array of strings noting things that are unclear or undecided

Rules:
- Be neutral
- Do not persuade
- Use easy language
- Note uncertainty where it exists"""
    return await call_llm_json(SYSTEM_CIVIC, prompt)


async def summarize_meeting(
    transcript_text: str,
    title: str,
    user_traits: list[str] | None = None,
) -> dict[str, Any]:
    """Summarize a congressional or public meeting."""
    traits_str = ", ".join(user_traits) if user_traits else "general citizen"
    prompt = f"""Task: Summarize the following meeting or hearing.

Title: {title}

Transcript / Notes:
{transcript_text[:8000]}

User Traits: {traits_str}

Return valid JSON with these keys:
- summary: concise factual summary of what was discussed
- vernacular_summary: very simple everyday language version
- key_topics: array of main topics discussed
- effect_on_user: how the discussed topics might affect someone with the listed traits
- effects_on_groups: array of objects with "group" and "effect" keys
- uncertainties: array of things that are still undecided or unclear
- action_items: array of any concrete next steps mentioned

Rules:
- Be neutral and factual
- Do not editorialize
- Use easy language
- Note uncertainty where it exists"""
    return await call_llm_json(SYSTEM_CIVIC, prompt)
