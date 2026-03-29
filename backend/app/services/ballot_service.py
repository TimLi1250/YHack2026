from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

import httpx

from app.config import BALLOTS_FILE, GOOGLE_CIVIC_API_KEY
from app.schemas import AIUserContext, SourceCitation
from app.services.geocode_service import get_civic_address, normalize_city, normalize_state
from app.services.llm_service import summarize_ballot_record
from app.services.source_service import add_source, get_sources_for_entity
from app.services.user_service import get_user
from app.storage import find_by_id, load_json, save_json
from app.utils import now_iso

logger = logging.getLogger(__name__)

VOTER_INFO_URL = "https://www.googleapis.com/civicinfo/v2/voterinfo"

# Re-fetch API data after this many hours even when a cache entry exists
BALLOT_CACHE_TTL_HOURS = 24


def _ballot_fingerprint(b: dict[str, Any]) -> tuple:
    """Unique key used to detect duplicate ballot entries across fetches."""
    return (
        b.get("election_id", ""),
        (b.get("title") or "").strip().lower(),
        (b.get("office_name") or "").strip().lower(),
        (b.get("district_name") or "").strip().lower(),
        b.get("normalized_type", ""),
    )


def _is_stale(fetched_at: str | None) -> bool:
    """Return True if fetched_at is missing or older than BALLOT_CACHE_TTL_HOURS."""
    if not fetched_at:
        return True
    try:
        ts = datetime.fromisoformat(fetched_at)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        age_hours = (datetime.now(tz=timezone.utc) - ts).total_seconds() / 3600
        return age_hours >= BALLOT_CACHE_TTL_HOURS
    except (ValueError, TypeError):
        return True


async def fetch_ballots_for_location(
    state: str,
    city: str,
    election_id: str | None = None,
    street_address: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch ballot items from Google Civic Info API (voterinfo endpoint).

    Returns enriched records including referendum pro/con statements, candidate
    lists for office races, and a ``fetched_at`` timestamp for cache TTL checks.
    """
    if not GOOGLE_CIVIC_API_KEY:
        logger.warning("GOOGLE_CIVIC_API_KEY not set – returning cached ballots only")
        return []

    norm_state = normalize_state(state)
    address = get_civic_address(city, state, street_address)
    params: dict[str, str] = {
        "key": GOOGLE_CIVIC_API_KEY,
        "address": address,
    }
    if election_id:
        raw_id = election_id.replace("election_", "")
        params["electionId"] = raw_id

    fetched_at = now_iso()
    results: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(VOTER_INFO_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        election_info = data.get("election", {})
        eid = election_id or f"election_{election_info.get('id', 'unknown')}"
        election_name = election_info.get("name", "")
        election_date = election_info.get("electionDay", "")

        for contest in data.get("contests", []):
            contest_type = contest.get("type", "")
            contest_type_lower = contest_type.lower()
            level_list = contest.get("level", [])
            level = level_list[0] if level_list else contest.get("district", {}).get("scope", "")
            district_name = contest.get("district", {}).get("name")

            is_measure = contest_type_lower in ("referendum", "ballot-measure")
            if is_measure:
                title = (
                    contest.get("referendumTitle")
                    or contest.get("ballotTitle")
                    or contest.get("referendumSubtitle")
                    or "Ballot Measure"
                )
                text = contest.get("referendumText") or contest.get("referendumBrief", "")
                item: dict[str, Any] = {
                    "id": f"ballot_{uuid4().hex[:12]}",
                    "election_id": eid,
                    "election_name": election_name,
                    "election_date": election_date,
                    "state": norm_state,
                    "title": title,
                    "ballot_text": text,
                    # Extra referendum details from the API
                    "referendum_brief": contest.get("referendumBrief") or None,
                    "referendum_subtitle": contest.get("referendumSubtitle") or None,
                    "referendum_pro": contest.get("referendumProStatement") or None,
                    "referendum_con": contest.get("referendumConStatement") or None,
                    "passage_threshold": contest.get("referendumPassageThreshold") or None,
                    "ballot_placement": contest.get("referendumBallotResponsesUrl") or None,
                    "normalized_type": "proposition",
                    "election_type": _infer_type(election_name),
                    "election_level": level,
                    "office_name": None,
                    "district_name": district_name,
                    "sources": [{"label": "Google Civic Info API", "url": VOTER_INFO_URL}],
                    # LLM summary fields — populated lazily via summarize_ballot()
                    "plain_summary": None,
                    "simple_summary": None,
                    "one_sentence": None,
                    "yes_means": None,
                    "no_means": None,
                    "effect_on_user": None,
                    "effects_on_groups": [],
                    "fetched_at": fetched_at,
                    "created_at": now_iso(),
                }
                results.append(item)
            else:
                office = contest.get("office", "")
                if not office:
                    continue
                # Capture all candidates in this race
                candidates_raw = []
                for cand in contest.get("candidates", []):
                    candidates_raw.append({
                        "name": cand.get("name", ""),
                        "party": cand.get("party"),
                        "url": cand.get("candidateUrl"),
                        "photo_url": cand.get("photoUrl"),
                        "email": cand.get("email"),
                        "phone": cand.get("phone"),
                        "order_on_ballot": cand.get("orderOnBallot"),
                    })
                item = {
                    "id": f"ballot_{uuid4().hex[:12]}",
                    "election_id": eid,
                    "election_name": election_name,
                    "election_date": election_date,
                    "state": norm_state,
                    "title": office,
                    "ballot_text": f"{contest_type or 'Election'} for {office}",
                    "referendum_brief": None,
                    "referendum_subtitle": None,
                    "referendum_pro": None,
                    "referendum_con": None,
                    "passage_threshold": None,
                    "ballot_placement": None,
                    "normalized_type": "office",
                    "election_type": (
                        contest_type_lower
                        if contest_type_lower in ("primary", "runoff", "special")
                        else _infer_type(election_name)
                    ),
                    "election_level": level,
                    "office_name": office,
                    "district_name": district_name,
                    "candidates": candidates_raw,
                    "primary_parties": contest.get("primaryParties", []),
                    "sources": [{"label": "Google Civic Info API", "url": VOTER_INFO_URL}],
                    "plain_summary": None,
                    "simple_summary": None,
                    "one_sentence": None,
                    "yes_means": None,
                    "no_means": None,
                    "effect_on_user": None,
                    "effects_on_groups": [],
                    "fetched_at": fetched_at,
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


async def _auto_summarize(ballot: dict[str, Any], all_ballots: list[dict[str, Any]]) -> None:
    """Background task: run LLM summarization on a proposition and persist it."""
    if ballot.get("normalized_type") != "proposition":
        return
    if ballot.get("plain_summary"):  # already summarized
        return
    try:
        summary = await summarize_ballot_record(
            ballot_record=ballot,
            user_context=None,
            sources=[],
        )
        ballot["plain_summary"] = summary.plain_summary
        ballot["simple_summary"] = summary.simple_summary
        ballot["one_sentence"] = summary.one_sentence
        ballot["yes_means"] = summary.yes_means
        ballot["no_means"] = summary.no_means
        ballot["effect_on_user"] = summary.effect_on_user
        ballot["effects_on_groups"] = summary.effects_on_groups
        # Persist the enriched record back to disk
        fresh = load_json(BALLOTS_FILE)
        for i, b in enumerate(fresh):
            if b.get("id") == ballot["id"]:
                fresh[i] = ballot
                break
        save_json(BALLOTS_FILE, fresh)
        logger.info("Auto-summarized ballot %s", ballot["id"])
    except Exception as exc:
        logger.warning("Auto-summarization failed for ballot %s: %s", ballot.get("id"), exc)


async def get_upcoming_ballots(state: str, city: str, street_address: str | None = None) -> list[dict[str, Any]]:
    """Return ballots for a state, fetching from API when cache is absent or stale.

    Cache key is ``state`` (normalised).  A fresh fetch is triggered when:
    - No entries exist for this state, OR
    - The most-recent ``fetched_at`` is older than ``BALLOT_CACHE_TTL_HOURS``.

    Duplicate entries (same election / title / office / district) are silently
    dropped before saving, preventing the accumulation of identical records.
    LLM summaries for unsummarised propositions are kicked off as background tasks.
    """
    from app.services.election_service import fetch_all_upcoming_elections

    norm_state = normalize_state(state)
    ballots = load_json(BALLOTS_FILE)

    # Match by state field (added to every record from this version onward)
    matching = [b for b in ballots if b.get("state", "").lower() == norm_state.lower()]

    # Check TTL: use the newest fetched_at among matching entries
    newest_fetch = max((b.get("fetched_at", "") for b in matching), default="") if matching else ""
    needs_refresh = not matching or _is_stale(newest_fetch)

    if needs_refresh:
        fetched: list[dict[str, Any]] = []

        # Step 1: try without electionId — picks the next active election automatically
        fetched = await fetch_ballots_for_location(state, city, street_address=street_address)

        # Step 2: if that failed, iterate through known election IDs
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
                        break
            except Exception as exc:
                logger.warning("Could not iterate elections for ballot lookup: %s", exc)

        if fetched:
            # Build deduplication set from existing records
            existing_fps = {_ballot_fingerprint(b) for b in ballots}
            new_items: list[dict[str, Any]] = []
            for b in fetched:
                fp = _ballot_fingerprint(b)
                if fp not in existing_fps:
                    existing_fps.add(fp)
                    new_items.append(b)
                    add_source("ballot", b["id"], "Google Civic Info API", VOTER_INFO_URL)

            if new_items:
                ballots.extend(new_items)
                save_json(BALLOTS_FILE, ballots)
                logger.info("Cached %d new ballot items for state=%s", len(new_items), norm_state)

            # Auto-summarize new propositions in the background (non-blocking)
            for b in new_items:
                if b.get("normalized_type") == "proposition" and not b.get("plain_summary"):
                    asyncio.create_task(_auto_summarize(b, ballots))

            # Return the full deduplicated set for this state
            matching = [b for b in ballots if b.get("state", "").lower() == norm_state.lower()]
            if not matching:
                matching = fetched  # fallback if state field missing on old records

    return matching


async def refresh_ballots_for_location(
    state: str, city: str, street_address: str | None = None
) -> list[dict[str, Any]]:
    """Force a fresh API fetch, deduplicate, save, and return updated records."""
    norm_state = normalize_state(state)
    ballots = load_json(BALLOTS_FILE)

    # Remove stale entries for this state so they are replaced
    ballots = [b for b in ballots if b.get("state", "").lower() != norm_state.lower()]

    fetched = await fetch_ballots_for_location(state, city, street_address=street_address)
    if not fetched:
        from app.services.election_service import fetch_all_upcoming_elections
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
                    break
        except Exception as exc:
            logger.warning("refresh: could not iterate elections: %s", exc)

    existing_fps: set[tuple] = {_ballot_fingerprint(b) for b in ballots}
    for b in fetched:
        fp = _ballot_fingerprint(b)
        if fp not in existing_fps:
            existing_fps.add(fp)
            ballots.append(b)
            add_source("ballot", b["id"], "Google Civic Info API", VOTER_INFO_URL)

    save_json(BALLOTS_FILE, ballots)
    return [b for b in ballots if b.get("state", "").lower() == norm_state.lower()]


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
    user_context: AIUserContext | None = None
    if user_id:
        try:
            user = get_user(user_id)
            user_context = AIUserContext(
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
                language_preference=user.get("language_preference", "en"),
                derived_traits=user.get("derived_traits", []),
            )
        except Exception:
            pass

    sources = [
        SourceCitation.model_validate(source)
        for source in get_sources_for_entity("ballot", ballot_id)
    ]

    summary = await summarize_ballot_record(
        ballot_record=ballot,
        user_context=user_context,
        sources=sources,
    )

    ballot["plain_summary"] = summary.plain_summary
    ballot["simple_summary"] = summary.simple_summary
    ballot["one_sentence"] = summary.one_sentence
    ballot["vernacular_summary"] = summary.vernacular_summary
    ballot["yes_means"] = summary.yes_means
    ballot["no_means"] = summary.no_means
    ballot["effect_on_user"] = summary.effect_on_user
    ballot["effects_on_groups"] = summary.effects_on_groups
    ballot["election_type"] = summary.election_type or ballot.get("election_type", "")
    ballot["election_level"] = summary.election_level or ballot.get("election_level", "")
    ballot["uncertainties"] = summary.uncertainties
    ballot["cited_source_ids"] = summary.cited_source_ids
    ballots[ballot_idx] = ballot
    save_json(BALLOTS_FILE, ballots)

    return ballot


def get_ballots_for_election(election_id: str) -> list[dict[str, Any]]:
    """Return all ballot items for a specific election."""
    return [
        b for b in load_json(BALLOTS_FILE)
        if b.get("election_id") == election_id
    ]
