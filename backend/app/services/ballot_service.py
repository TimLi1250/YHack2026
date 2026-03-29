from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

import httpx

from app.config import BALLOTS_FILE, GOOGLE_CIVIC_API_KEY
from app.services.geocode_service import get_civic_address, normalize_city, normalize_state
from app.services.llm_service import summarize_ballot_text
from app.services.source_service import add_source
from app.services.user_service import get_user
from app.storage import append_json, find_by_id, load_json, save_json
from app.utils import now_iso

logger = logging.getLogger(__name__)

VOTER_INFO_URL = "https://www.googleapis.com/civicinfo/v2/voterinfo"


async def fetch_ballots_for_location(
    state: str,
    city: str,
    election_id: str | None = None,
    street_address: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch ballot items from Google Civic Info API (voterinfo endpoint)."""
    if not GOOGLE_CIVIC_API_KEY:
        logger.warning("GOOGLE_CIVIC_API_KEY not set – returning cached ballots only")
        return []

    address = get_civic_address(city, state, street_address)
    params: dict[str, str] = {
        "key": GOOGLE_CIVIC_API_KEY,
        "address": address,
    }
    if election_id:
        # Strip our prefix to get the raw API election id
        raw_id = election_id.replace("election_", "")
        params["electionId"] = raw_id

    results: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(VOTER_INFO_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        election_info = data.get("election", {})
        eid = election_id or f"election_{election_info.get('id', 'unknown')}"
        election_name = election_info.get("name", "")

        # Ballot measures / referenda and candidate races
        for contest in data.get("contests", []):
            contest_type = contest.get("type", "")
            contest_type_lower = contest_type.lower()
            level_list = contest.get("level", [])
            level = level_list[0] if level_list else contest.get("district", {}).get("scope", "")

            is_measure = contest_type_lower in ("referendum", "ballot-measure")
            if is_measure:
                title = (
                    contest.get("referendumTitle")
                    or contest.get("ballotTitle")
                    or contest.get("referendumSubtitle")
                    or "Ballot Measure"
                )
                text = contest.get("referendumText") or contest.get("referendumBrief", "")
                item = {
                    "id": f"ballot_{uuid4().hex[:12]}",
                    "election_id": eid,
                    "title": title,
                    "ballot_text": text,
                    "normalized_type": "proposition",
                    "election_type": _infer_type(election_name),
                    "election_level": level,
                    "office_name": None,
                    "district_name": contest.get("district", {}).get("name"),
                    "sources": [{"label": "Google Civic Info API", "url": VOTER_INFO_URL}],
                    "created_at": now_iso(),
                }
                results.append(item)
            else:
                # Candidate race (General, Primary, Runoff, Special, etc.)
                office = contest.get("office", "")
                if not office:
                    continue
                item = {
                    "id": f"ballot_{uuid4().hex[:12]}",
                    "election_id": eid,
                    "title": office,
                    "ballot_text": f"{contest_type or 'Election'} for {office}",
                    "normalized_type": "office",
                    "election_type": contest_type_lower if contest_type_lower in ("primary", "runoff", "special") else _infer_type(election_name),
                    "election_level": level,
                    "office_name": office,
                    "district_name": contest.get("district", {}).get("name"),
                    "sources": [{"label": "Google Civic Info API", "url": VOTER_INFO_URL}],
                    "created_at": now_iso(),
                }
                results.append(item)
    except httpx.HTTPError as e:
        logger.warning("Error fetching ballot info: %s", e)

    return results


def _infer_type(name: str) -> str:
    n = name.lower()
    if "primary" in n:
        return "primary"
    if "special" in n:
        return "special"
    if "runoff" in n:
        return "runoff"
    return "general"


async def get_upcoming_ballots(state: str, city: str, street_address: str | None = None) -> list[dict[str, Any]]:
    """Return ballots for a state/city, fetching from API if cache is empty."""
    # Avoid circular import
    from app.services.election_service import fetch_all_upcoming_elections

    norm_city = normalize_city(city)

    ballots = load_json(BALLOTS_FILE)
    # Only reuse cache when we have items for this exact city
    matching = [b for b in ballots if b.get("district_name", "").lower() == norm_city.lower()]

    if not matching:
        # Step 1: try without electionId — picks the next active election automatically
        fetched = await fetch_ballots_for_location(state, city, street_address=street_address)

        # Step 2: if that failed, iterate through known election IDs
        # Google voterinfo often needs an explicit electionId even when VIP data exists
        if not fetched:
            try:
                elections = await fetch_all_upcoming_elections()
                for election in elections:
                    eid = election.get("id")
                    if not eid:
                        continue
                    items = await fetch_ballots_for_location(
                        state, city, election_id=eid, street_address=street_address
                    )
                    if items:
                        fetched.extend(items)
                        break  # stop at first election that returns data
            except Exception as exc:
                logger.warning("Could not iterate elections for ballot lookup: %s", exc)

        if fetched:
            for b in fetched:
                ballots.append(b)
                add_source("ballot", b["id"], "Google Civic Info API", VOTER_INFO_URL)
            save_json(BALLOTS_FILE, ballots)
            matching = fetched

    return matching


def get_ballot_by_id(ballot_id: str) -> dict[str, Any] | None:
    return find_by_id(BALLOTS_FILE, ballot_id)


async def summarize_ballot(
    ballot_id: str,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Run LLM summarization on a ballot item and cache the result."""
    ballots = load_json(BALLOTS_FILE)
    ballot = None
    ballot_idx = -1
    for i, b in enumerate(ballots):
        if b.get("id") == ballot_id:
            ballot = b
            ballot_idx = i
            break

    if ballot is None or ballot_idx < 0:
        return {"error": "Ballot item not found"}

    # Get user traits for personalized explanation
    user_traits: list[str] = []
    if user_id:
        try:
            user = get_user(user_id)
            user_traits = user.get("derived_traits", [])
        except Exception:
            pass

    # Call LLM
    summary = await summarize_ballot_text(
        ballot_text=ballot.get("ballot_text", ""),
        title=ballot.get("title", ""),
        user_traits=user_traits or None,
    )

    # Merge summary fields into the ballot record
    if isinstance(summary, dict) and "raw_response" not in summary:
        ballot["plain_summary"] = summary.get("plain_summary")
        ballot["simple_summary"] = summary.get("simple_summary")
        ballot["one_sentence"] = summary.get("one_sentence")
        ballot["yes_means"] = summary.get("yes_means")
        ballot["no_means"] = summary.get("no_means")
        ballot["effect_on_user"] = summary.get("effect_on_user")
        ballot["effects_on_groups"] = summary.get("effects_on_groups", [])
        ballots[ballot_idx] = ballot
        save_json(BALLOTS_FILE, ballots)

    return ballot


def get_ballots_for_election(election_id: str) -> list[dict[str, Any]]:
    """Return all ballot items for a specific election."""
    return [
        b for b in load_json(BALLOTS_FILE)
        if b.get("election_id") == election_id
    ]
