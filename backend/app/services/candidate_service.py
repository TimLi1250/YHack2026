from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

import httpx

from app.config import CANDIDATES_FILE, GOOGLE_CIVIC_API_KEY
from app.services.geocode_service import get_civic_address, normalize_city, normalize_state
from app.services.llm_service import compare_candidates, summarize_candidate
from app.services.source_service import add_source
from app.services.user_service import get_user
from app.storage import append_json, find_by_id, load_json, save_json
from app.utils import now_iso

logger = logging.getLogger(__name__)

VOTER_INFO_URL = "https://www.googleapis.com/civicinfo/v2/voterinfo"


async def fetch_candidates_for_location(
    state: str,
    city: str,
    election_id: str | None = None,
    street_address: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch candidate info from Google Civic Info API."""
    if not GOOGLE_CIVIC_API_KEY:
        logger.warning("GOOGLE_CIVIC_API_KEY not set – returning cached candidates only")
        return []

    address = get_civic_address(city, state, street_address)
    params: dict[str, str] = {"key": GOOGLE_CIVIC_API_KEY, "address": address}
    if election_id:
        params["electionId"] = election_id.replace("election_", "")

    results: list[dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(VOTER_INFO_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        eid = election_id or f"election_{data.get('election', {}).get('id', 'unknown')}"
        for contest in data.get("contests", []):
            office = contest.get("office", "")
            for cand in contest.get("candidates", []):
                candidate = {
                    "id": f"cand_{uuid4().hex[:12]}",
                    "ballot_item_id": None,
                    "election_id": eid,
                    "name": cand.get("name", ""),
                    "office": office,
                    "party": cand.get("party"),
                    "incumbent": False,
                    "campaign_site": cand.get("candidateUrl"),
                    "photo_url": cand.get("photoUrl"),
                    "sources": [{"label": "Google Civic Info API", "url": VOTER_INFO_URL}],
                    "created_at": now_iso(),
                }
                results.append(candidate)
    except httpx.HTTPError as e:
        logger.warning("Error fetching candidates: %s", e)

    return results


async def get_candidates(
    state: str | None = None,
    city: str | None = None,
    office: str | None = None,
    street_address: str | None = None,
) -> list[dict[str, Any]]:
    """Return candidates, optionally filtered by location/office."""
    from app.services.election_service import fetch_all_upcoming_elections

    candidates = load_json(CANDIDATES_FILE)

    if not candidates and state and city:
        # Step 1: try without electionId
        fetched = await fetch_candidates_for_location(state, city, street_address=street_address)

        # Step 2: if that failed, iterate through known election IDs
        if not fetched:
            try:
                elections = await fetch_all_upcoming_elections()
                for election in elections:
                    eid = election.get("id")
                    if not eid:
                        continue
                    items = await fetch_candidates_for_location(
                        state, city, election_id=eid, street_address=street_address
                    )
                    if items:
                        fetched.extend(items)
                        break
            except Exception as exc:
                logger.warning("Could not iterate elections for candidate lookup: %s", exc)

        if fetched:
            for c in fetched:
                candidates.append(c)
                add_source("candidate", c["id"], "Google Civic Info API", VOTER_INFO_URL)
            save_json(CANDIDATES_FILE, candidates)

    result = candidates
    if office:
        result = [c for c in result if office.lower() in c.get("office", "").lower()]

    return result


def get_candidate_by_id(candidate_id: str) -> dict[str, Any] | None:
    return find_by_id(CANDIDATES_FILE, candidate_id)


def get_candidates_for_ballot_item(ballot_item_id: str) -> list[dict[str, Any]]:
    return [
        c for c in load_json(CANDIDATES_FILE)
        if c.get("ballot_item_id") == ballot_item_id
    ]


async def build_candidate_profile(
    candidate_id: str,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Use LLM to enrich a candidate record with summaries."""
    candidates = load_json(CANDIDATES_FILE)
    candidate = None
    candidate_idx = -1
    for i, c in enumerate(candidates):
        if c.get("id") == candidate_id:
            candidate = c
            candidate_idx = i
            break

    if candidate is None or candidate_idx < 0:
        return {"error": "Candidate not found"}

    user_traits: list[str] = []
    if user_id:
        try:
            user = get_user(user_id)
            user_traits = user.get("derived_traits", [])
        except Exception:
            pass

    # Build info string from existing data
    info_parts = [
        f"Name: {candidate.get('name', '')}",
        f"Party: {candidate.get('party', 'Unknown')}",
        f"Office: {candidate.get('office', '')}",
    ]
    if candidate.get("campaign_site"):
        info_parts.append(f"Campaign website: {candidate['campaign_site']}")

    candidate_info = "\n".join(info_parts)

    summary = await summarize_candidate(
        candidate_info=candidate_info,
        office=candidate.get("office", ""),
        user_traits=user_traits or None,
    )

    if isinstance(summary, dict) and "raw_response" not in summary:
        candidate["bio_summary"] = summary.get("bio_summary")
        candidate["positions"] = summary.get("positions", {})
        candidate["work_history_summary"] = summary.get("work_history_summary")
        candidate["controversy_summary"] = summary.get("controversy_summary")
        candidate["user_effect_summary"] = summary.get("user_effect_summary")
        candidate["group_effects"] = summary.get("group_effects", [])
        candidates[candidate_idx] = candidate
        save_json(CANDIDATES_FILE, candidates)

    return candidate


async def compare_candidates_by_ids(
    candidate_ids: list[str],
    user_id: str | None = None,
) -> dict[str, Any]:
    """Compare two or more candidates running for the same office."""
    candidates = load_json(CANDIDATES_FILE)
    selected = [c for c in candidates if c.get("id") in candidate_ids]

    if len(selected) < 2:
        return {"error": "Need at least two candidates to compare"}

    office = selected[0].get("office", "Unknown Office")

    candidates_info = [
        {
            "name": c.get("name"),
            "party": c.get("party"),
            "bio_summary": c.get("bio_summary", ""),
            "positions": c.get("positions", {}),
        }
        for c in selected
    ]

    comparison = await compare_candidates(candidates_info, office)
    return comparison


def add_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    """Manually add a candidate record."""
    if not candidate.get("id"):
        candidate["id"] = f"cand_{uuid4().hex[:12]}"
    candidate["created_at"] = now_iso()
    append_json(CANDIDATES_FILE, candidate)
    return candidate
