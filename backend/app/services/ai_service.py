from __future__ import annotations

import re
from typing import Any

import httpx

from app.config import BALLOTS_FILE, CANDIDATES_FILE, CONGRESS_API_KEY, ELECTIONS_FILE, GOOGLE_CIVIC_API_KEY, LEGISLATION_FILE, MEETINGS_FILE
from app.schemas import AIChatResponse, AIFactCheckResponse, AIUserContext, SourceCitation
from app.services.election_service import CIVIC_API_URL, VOTER_INFO_URL, get_upcoming_elections
from app.services.geocode_service import STATE_ALIASES, get_civic_address, normalize_city, normalize_state
from app.services.legislation_service import fetch_legislation
from app.services.llm_service import general_chat, grounded_chat, grounded_fact_check
from app.services.source_service import get_sources_for_entity
from app.services.user_service import get_user
from app.storage import load_json

STOPWORDS = {
    "about",
    "after",
    "all",
    "and",
    "are",
    "before",
    "between",
    "but",
    "can",
    "could",
    "does",
    "explain",
    "for",
    "from",
    "give",
    "help",
    "how",
    "into",
    "local",
    "more",
    "need",
    "office",
    "please",
    "show",
    "tell",
    "than",
    "that",
    "the",
    "their",
    "them",
    "there",
    "these",
    "this",
    "those",
    "what",
    "when",
    "where",
    "which",
    "who",
    "with",
    "would",
    "your",
}

POLLING_QUERY_TERMS = (
    "polling place",
    "polling places",
    "polling location",
    "polling locations",
    "where do i vote",
    "where can i vote",
    "vote center",
    "vote centers",
    "voting location",
    "voting locations",
)

ELECTION_QUERY_TERMS = (
    "next election",
    "upcoming election",
    "local election",
    "election day",
    "election date",
    "when is the election",
    "recent election",
)

LEGISLATION_QUERY_TERMS = (
    "bill",
    "congress",
    "resolution",
    "act",
    "senate",
    "house",
    "legislation",
)

CITY_STATE_PATTERN = re.compile(
    r"\b(?:in|for|at|near)\s+([A-Za-z][A-Za-z .'-]+?),\s*([A-Za-z]{2}|[A-Za-z][A-Za-z .'-]+)\b",
    re.IGNORECASE,
)
BILL_NUMBER_PATTERN = re.compile(
    r"\b(?P<prefix>hr|s|hjres|sjres|hconres|sconres|hres|sres)[\s.\-]?(?P<number>\d+)\b",
    re.IGNORECASE,
)


def _slugify(value: str | None) -> str:
    if not value:
        return "unknown"
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_") or "unknown"


def _tokenize(text: str) -> list[str]:
    return [
        token
        for token in re.findall(r"[a-z0-9]{3,}", text.lower())
        if token and token not in STOPWORDS
    ]


def _score_record(query_tokens: list[str], haystack: str) -> int:
    if not query_tokens:
        return 0
    lowered = haystack.lower()
    score = 0
    for token in query_tokens:
        if token in lowered:
            score += 1
    return score


def _is_polling_query(question: str) -> bool:
    lowered = question.lower()
    return any(term in lowered for term in POLLING_QUERY_TERMS)


def _is_election_query(question: str) -> bool:
    lowered = question.lower()
    if any(term in lowered for term in ELECTION_QUERY_TERMS):
        return True
    return "election" in lowered and any(
        term in lowered for term in ("next", "upcoming", "recent", "local", "when")
    )


def _is_legislation_query(question: str) -> bool:
    lowered = question.lower()
    return any(term in lowered for term in LEGISLATION_QUERY_TERMS) or bool(
        BILL_NUMBER_PATTERN.search(lowered)
    )


def _extract_bill_number(question: str) -> str | None:
    match = BILL_NUMBER_PATTERN.search(question)
    if not match:
        return None
    return f"{match.group('prefix').lower()}{match.group('number')}"


def _extract_location_override(
    question: str,
    user_context: AIUserContext | None,
) -> dict[str, str | None]:
    city: str | None = None
    state: str | None = None
    street_address: str | None = None

    match = CITY_STATE_PATTERN.search(question)
    if match:
        city = normalize_city(match.group(1))
        state = normalize_state(match.group(2))
    else:
        lowered = question.lower()
        full_state_names = sorted(set(STATE_ALIASES.values()), key=len, reverse=True)
        for full_state in full_state_names:
            if re.search(rf"\b{re.escape(full_state.lower())}\b", lowered):
                state = full_state
                break

    if not state and user_context and user_context.state:
        state = normalize_state(user_context.state)
    if not city and user_context and user_context.city and state == normalize_state(user_context.state or ""):
        city = normalize_city(user_context.city)

    if (
        user_context
        and user_context.street_address
        and city
        and state
        and city == normalize_city(user_context.city or "")
        and state == normalize_state(user_context.state or "")
    ):
        street_address = user_context.street_address

    location_parts = [part for part in (city, state) if part]
    location_label = ", ".join(location_parts) if location_parts else "the requested location"

    return {
        "city": city,
        "state": state,
        "street_address": street_address,
        "location_label": location_label,
    }


def _format_civic_location(location: dict[str, Any]) -> dict[str, Any]:
    address = location.get("address") or {}
    address_parts = [
        address.get("locationName"),
        address.get("line1"),
        address.get("line2"),
        address.get("line3"),
        address.get("city"),
        address.get("state"),
        address.get("zip"),
    ]
    formatted_address = ", ".join(part for part in address_parts if part)
    return {
        "location_name": address.get("locationName"),
        "address": formatted_address,
        "polling_hours": location.get("pollingHours"),
        "notes": location.get("notes"),
    }


async def _fetch_voterinfo_snapshot(
    state: str,
    city: str,
    street_address: str | None,
    election_ids: list[str],
) -> tuple[dict[str, Any] | None, str]:
    if not GOOGLE_CIVIC_API_KEY:
        return None, get_civic_address(city, state, street_address)

    lookup_address = get_civic_address(city, state, street_address)
    attempts = [None, *election_ids]
    seen: set[str | None] = set()

    async with httpx.AsyncClient(timeout=30) as client:
        for election_id in attempts:
            if election_id in seen:
                continue
            seen.add(election_id)

            params: dict[str, str] = {
                "key": GOOGLE_CIVIC_API_KEY,
                "address": lookup_address,
            }
            if election_id:
                params["electionId"] = election_id.replace("election_", "")

            try:
                response = await client.get(VOTER_INFO_URL, params=params)
                response.raise_for_status()
                data = response.json()
            except httpx.HTTPError:
                continue

            has_polling_data = any(
                data.get(key)
                for key in ("pollingLocations", "earlyVoteSites", "dropOffLocations")
            )
            if has_polling_data or data.get("election"):
                return data, lookup_address

    return None, lookup_address


async def _build_live_location_packet(
    question: str,
    user_context: AIUserContext | None,
) -> tuple[list[dict[str, Any]], list[SourceCitation]]:
    should_lookup_elections = _is_election_query(question)
    should_lookup_polling = _is_polling_query(question)
    if not should_lookup_elections and not should_lookup_polling:
        return [], []

    location = _extract_location_override(question, user_context)
    if not location["state"]:
        return [], []

    norm_state = str(location["state"])
    norm_city = str(location["city"]) if location["city"] else None
    lookup_city = norm_city or "Statewide"
    location_label = str(location["location_label"])

    packet: list[dict[str, Any]] = []
    citations: list[SourceCitation] = []

    live_elections: list[dict[str, Any]] = []
    if should_lookup_elections or should_lookup_polling:
        try:
            live_elections = await get_upcoming_elections(norm_state, lookup_city)
        except Exception:
            live_elections = []

    if live_elections:
        sorted_elections = sorted(live_elections, key=lambda item: item.get("election_date", ""))
        packet.append(
            {
                "entity_type": "live_election_lookup",
                "location": location_label,
                "next_election": sorted_elections[0],
                "upcoming_elections": sorted_elections[:3],
            }
        )
        citations.append(
            SourceCitation(
                id=f"src_live_elections_{_slugify(norm_city)}_{_slugify(norm_state)}",
                label="Google Civic Info API",
                url=CIVIC_API_URL,
                snippet=f"Upcoming elections lookup for {location_label}.",
            )
        )

    if should_lookup_elections or should_lookup_polling:
        election_ids = [election.get("id", "") for election in live_elections if election.get("id")]
        if norm_city:
            voterinfo, lookup_address = await _fetch_voterinfo_snapshot(
                state=norm_state,
                city=norm_city,
                street_address=str(location["street_address"]) if location["street_address"] else None,
                election_ids=election_ids,
            )

            if voterinfo:
                packet.append(
                    {
                        "entity_type": "live_voterinfo_lookup",
                        "location": location_label,
                        "lookup_address": lookup_address,
                        "lookup_precision": "street_address" if location["street_address"] else "city_fallback_address",
                        "election": voterinfo.get("election", {}),
                        "polling_locations": [
                            _format_civic_location(location)
                            for location in voterinfo.get("pollingLocations", [])
                        ],
                        "early_vote_sites": [
                            _format_civic_location(location)
                            for location in voterinfo.get("earlyVoteSites", [])
                        ],
                        "drop_off_locations": [
                            _format_civic_location(location)
                            for location in voterinfo.get("dropOffLocations", [])
                        ],
                    }
                )
            elif should_lookup_polling:
                packet.append(
                    {
                        "entity_type": "live_voterinfo_lookup",
                        "location": location_label,
                        "lookup_address": lookup_address,
                        "lookup_precision": "street_address" if location["street_address"] else "city_fallback_address",
                        "polling_locations": [],
                        "early_vote_sites": [],
                        "drop_off_locations": [],
                        "notes": (
                            "Google Civic did not return polling place data for this lookup. "
                            "Exact polling places are often assigned by street address, so a full street address may be required."
                        ),
                    }
                )
        elif should_lookup_polling:
            packet.append(
                {
                    "entity_type": "live_voterinfo_lookup",
                    "location": location_label,
                    "lookup_precision": "state_only",
                    "polling_locations": [],
                    "early_vote_sites": [],
                    "drop_off_locations": [],
                    "notes": (
                        "Polling places are usually assigned by city and street address. "
                        "Add a city or full street address for a more exact Google Civic lookup."
                    ),
                }
            )

        citations.append(
            SourceCitation(
                id=f"src_live_voterinfo_{_slugify(norm_city)}_{_slugify(norm_state)}",
                label="Google Civic Voter Info API",
                url=VOTER_INFO_URL,
                snippet=f"Voter info lookup for {location_label}.",
            )
        )

    return packet, citations


async def _build_live_congress_packet(question: str) -> tuple[list[dict[str, Any]], list[SourceCitation]]:
    if not CONGRESS_API_KEY or not _is_legislation_query(question):
        return [], []

    bill_number = _extract_bill_number(question)
    if not bill_number:
        return [], []

    try:
        legislation = await fetch_legislation(bill_number=bill_number, limit=3)
    except Exception:
        legislation = []

    if not legislation:
        return [], []

    citations: list[SourceCitation] = []
    for index, record in enumerate(legislation[:3]):
        citations.append(
            SourceCitation(
                id=f"src_live_congress_{bill_number}_{index}",
                label="Congress.gov",
                url=record.get("source_url") or "https://api.congress.gov/",
                snippet=record.get("title"),
            )
        )

    packet = [
        {
            "entity_type": "live_congress_lookup",
            "query": question,
            "matched_bill_number": bill_number,
            "results": legislation[:3],
        }
    ]
    return packet, citations


def build_user_context(
    user_id: str | None = None,
    profile_context: AIUserContext | None = None,
    language_preference: str | None = None,
) -> AIUserContext:
    if user_id:
        user = get_user(user_id)
        return AIUserContext(
            user_id=user.get("id"),
            name=user.get("name"),
            age_range=user.get("age_range"),
            ethnicity=user.get("ethnicity"),
            interests=user.get("interests", []),
            salary_range=user.get("salary_range"),
            gender=user.get("gender"),
            state=user.get("state"),
            city=user.get("city"),
            street_address=user.get("street_address"),
            language_preference=language_preference or user.get("language_preference", "en"),
            derived_traits=user.get("derived_traits", []),
        )

    if profile_context:
        return AIUserContext(
            user_id=profile_context.user_id,
            name=profile_context.name,
            age_range=profile_context.age_range,
            ethnicity=profile_context.ethnicity,
            interests=profile_context.interests,
            salary_range=profile_context.salary_range,
            gender=profile_context.gender,
            state=profile_context.state,
            city=profile_context.city,
            street_address=profile_context.street_address,
            language_preference=language_preference or profile_context.language_preference,
            derived_traits=profile_context.derived_traits,
        )

    return AIUserContext(language_preference=language_preference or "en")


def _retrieve_static_grounded_packet(question: str, limit: int = 6) -> tuple[list[dict[str, Any]], list[SourceCitation]]:
    query_tokens = _tokenize(question)
    if not query_tokens:
        return [], []
    records: list[tuple[int, dict[str, Any], list[SourceCitation]]] = []

    datasets = [
        ("ballot", load_json(BALLOTS_FILE), ["title", "ballot_text", "plain_summary", "simple_summary"]),
        ("candidate", load_json(CANDIDATES_FILE), ["name", "office", "bio_summary", "controversy_summary"]),
        ("legislation", load_json(LEGISLATION_FILE), ["title", "plain_summary", "vernacular_summary"]),
        ("meeting", load_json(MEETINGS_FILE), ["title", "summary", "vernacular_summary"]),
        ("election", load_json(ELECTIONS_FILE), ["name", "level", "election_type"]),
    ]

    for entity_type, dataset, fields in datasets:
        for record in dataset:
            haystack = " ".join(str(record.get(field, "")) for field in fields)
            score = _score_record(query_tokens, haystack)
            if score <= 0:
                continue
            record_sources = []
            if entity_type != "election" and record.get("id"):
                record_sources = [
                    SourceCitation.model_validate(source)
                    for source in get_sources_for_entity(entity_type, record["id"])
                ]
            normalized_record = {
                "entity_type": entity_type,
                **record,
            }
            records.append((score, normalized_record, record_sources))

    records.sort(key=lambda item: item[0], reverse=True)
    top_records = records[:limit]

    packet = [record for _, record, _ in top_records]
    citations_map: dict[str, SourceCitation] = {}
    for _, _, source_list in top_records:
        for source in source_list:
            citations_map[source.id] = source
    return packet, list(citations_map.values())


async def retrieve_grounded_packet(
    question: str,
    user_context: AIUserContext | None = None,
    limit: int = 6,
) -> tuple[list[dict[str, Any]], list[SourceCitation]]:
    static_packet, static_citations = _retrieve_static_grounded_packet(question, limit=limit)
    live_civic_packet, live_civic_citations = await _build_live_location_packet(question, user_context)
    live_congress_packet, live_congress_citations = await _build_live_congress_packet(question)

    live_packet = [*live_civic_packet, *live_congress_packet]
    reserved_live_slots = min(len(live_packet), max(0, limit // 2))
    static_slots = max(0, limit - reserved_live_slots)

    combined_packet = [
        *static_packet[:static_slots],
        *live_packet[: limit - static_slots],
    ]

    citations_map: dict[str, SourceCitation] = {}
    for citation in [*static_citations, *live_civic_citations, *live_congress_citations]:
        citations_map[citation.id] = citation

    return combined_packet, list(citations_map.values())


async def answer_chat(
    question: str,
    user_context: AIUserContext,
    conversation: list[dict[str, str]] | None = None,
) -> AIChatResponse:
    general_answer: AIChatResponse | None = None
    try:
        general_answer = await general_chat(
            question=question,
            user_context=user_context,
            conversation=conversation,
        )
    except Exception:
        general_answer = None

    packet, citations = await retrieve_grounded_packet(question, user_context=user_context)
    return await grounded_chat(
        question=question,
        user_context=user_context,
        source_packet=packet,
        sources=citations,
        conversation=conversation,
        general_answer=general_answer,
    )


async def fact_check_claim(
    claim: str,
    user_context: AIUserContext,
) -> AIFactCheckResponse:
    packet, citations = await retrieve_grounded_packet(claim, user_context=user_context, limit=8)
    return await grounded_fact_check(
        claim=claim,
        user_context=user_context,
        source_packet=packet,
        sources=citations,
    )
