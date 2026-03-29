from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any
from uuid import uuid4

import httpx

from app.config import ELECTIONS_FILE, GOOGLE_CIVIC_API_KEY
from app.services.geocode_service import normalize_city, normalize_state
from app.services.source_service import add_source
from app.storage import append_json, load_json, save_json
from app.utils import now_iso

logger = logging.getLogger(__name__)

# Google Civic Information API endpoint
CIVIC_API_URL = "https://www.googleapis.com/civicinfo/v2/elections"
VOTER_INFO_URL = "https://www.googleapis.com/civicinfo/v2/voterinfo"

# Re-fetch the election list after this many hours
ELECTION_CACHE_TTL_HOURS = 24


def _election_is_stale(fetched_at: str | None) -> bool:
    if not fetched_at:
        return True
    try:
        ts = datetime.fromisoformat(fetched_at)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        age_hours = (datetime.now(tz=timezone.utc) - ts).total_seconds() / 3600
        return age_hours >= ELECTION_CACHE_TTL_HOURS
    except (ValueError, TypeError):
        return True


async def fetch_elections_from_api(state: str, city: str) -> list[dict[str, Any]]:
    """Fetch upcoming elections from Google Civic Information API."""
    if not GOOGLE_CIVIC_API_KEY:
        logger.warning("GOOGLE_CIVIC_API_KEY not set – returning cached elections only")
        return []

    fetched_at = now_iso()
    results: list[dict[str, Any]] = []
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                CIVIC_API_URL,
                params={"key": GOOGLE_CIVIC_API_KEY},
            )
            resp.raise_for_status()
            data = resp.json()

            for election in data.get("elections", []):
                election_id = election.get("id", "")
                if election_id == "0":  # test election
                    continue
                results.append({
                    "id": f"election_{election_id}",
                    "name": election.get("name", ""),
                    "election_date": election.get("electionDay", ""),
                    "ocd_division_id": election.get("ocdDivisionId"),
                    "election_type": _infer_election_type(election.get("name", "")),
                    "level": _infer_election_level(election.get("name", "")),
                    "state": normalize_state(state),
                    "city": normalize_city(city),
                    "sources": [{"label": "Google Civic Info API", "url": CIVIC_API_URL}],
                    "fetched_at": fetched_at,
                    "created_at": now_iso(),
                })
    except httpx.HTTPError as e:
        logger.error("Error fetching elections: %s", e)

    return results


def _infer_election_type(name: str) -> str:
    name_lower = name.lower()
    if "primary" in name_lower:
        return "primary"
    if "runoff" in name_lower:
        return "runoff"
    if "special" in name_lower:
        return "special"
    return "general"


def _infer_election_level(name: str) -> str:
    name_lower = name.lower()
    if any(w in name_lower for w in ("city", "municipal", "local")):
        return "city"
    if "county" in name_lower:
        return "county"
    if any(w in name_lower for w in ("state", "governor", "state senate", "state house")):
        return "state"
    return "federal"


async def get_upcoming_elections(state: str, city: str) -> list[dict[str, Any]]:
    """Return upcoming elections for a given state/city, fetching/refreshing as needed.

    A fresh API call is made when:
    - No cached elections exist for this state, OR
    - The most-recent ``fetched_at`` is older than ``ELECTION_CACHE_TTL_HOURS``.

    Duplicate IDs are silently dropped before saving.
    """
    norm_state = normalize_state(state)

    elections = load_json(ELECTIONS_FILE)
    matching = [e for e in elections if e.get("state", "").lower() == norm_state.lower()]

    newest_fetch = max((e.get("fetched_at", "") for e in matching), default="") if matching else ""
    needs_refresh = not matching or _election_is_stale(newest_fetch)

    if needs_refresh:
        fetched = await fetch_elections_from_api(state, city)
        if fetched:
            existing_ids = {e["id"] for e in elections}
            for e in fetched:
                if e["id"] not in existing_ids:
                    existing_ids.add(e["id"])
                    elections.append(e)
                    add_source("election", e["id"], "Google Civic Info API", CIVIC_API_URL)
                else:
                    # Update fetched_at on existing record so TTL resets
                    for existing in elections:
                        if existing["id"] == e["id"]:
                            existing["fetched_at"] = e["fetched_at"]
                            break
            save_json(ELECTIONS_FILE, elections)
            matching = [e for e in elections if e.get("state", "").lower() == norm_state.lower()]

    return matching


async def fetch_all_upcoming_elections(
    limit: int | None = None,
    year: int | None = None,
) -> list[dict[str, Any]]:
    """Fetch all upcoming elections globally, sorted by date.

    Uses cached data when available and fresh (< ELECTION_CACHE_TTL_HOURS old).
    Deduplicates by election ID before saving.
    """
    elections = load_json(ELECTIONS_FILE)
    cached_newest = max((e.get("fetched_at", "") for e in elections), default="") if elections else ""

    if not elections or _election_is_stale(cached_newest):
        if not GOOGLE_CIVIC_API_KEY:
            logger.warning("GOOGLE_CIVIC_API_KEY not set – returning cached elections only")
        else:
            fetched_at = now_iso()
            fresh: list[dict[str, Any]] = []
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    resp = await client.get(
                        CIVIC_API_URL,
                        params={"key": GOOGLE_CIVIC_API_KEY},
                    )
                    resp.raise_for_status()
                    data = resp.json()
                for election in data.get("elections", []):
                    eid = election.get("id", "")
                    if eid == "0":
                        continue
                    fresh.append({
                        "id": f"election_{eid}",
                        "name": election.get("name", ""),
                        "election_date": election.get("electionDay", ""),
                        "ocd_division_id": election.get("ocdDivisionId"),
                        "election_type": _infer_election_type(election.get("name", "")),
                        "level": _infer_election_level(election.get("name", "")),
                        "sources": [{"label": "Google Civic Info API", "url": CIVIC_API_URL}],
                        "fetched_at": fetched_at,
                        "created_at": now_iso(),
                    })
            except httpx.HTTPError as e:
                logger.warning("Error fetching elections from API: %s", e)
                fresh = []

            if fresh:
                # Deduplicate: update fetched_at for existing IDs, append new ones
                existing_ids = {e["id"]: i for i, e in enumerate(elections)}
                for e in fresh:
                    if e["id"] in existing_ids:
                        elections[existing_ids[e["id"]]]["fetched_at"] = fetched_at
                    else:
                        elections.append(e)
                save_json(ELECTIONS_FILE, elections)

    today = date.today().isoformat()
    results = [e for e in elections if e.get("election_date", "") >= today]

    if year:
        results = [e for e in results if e.get("election_date", "").startswith(str(year))]

    results.sort(key=lambda e: e.get("election_date", ""))

    if limit:
        results = results[:limit]

    return results


def get_election_by_id(election_id: str) -> dict[str, Any] | None:
    """Get a specific election by ID."""
    for election in load_json(ELECTIONS_FILE):
        if election.get("id") == election_id:
            return election
    return None


def add_election(election: dict[str, Any]) -> dict[str, Any]:
    """Manually add an election record."""
    if not election.get("id"):
        election["id"] = f"election_{uuid4().hex[:12]}"
    election["created_at"] = now_iso()
    append_json(ELECTIONS_FILE, election)
    return election
