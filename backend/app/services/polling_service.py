from __future__ import annotations

import logging
import re
from collections import Counter
from datetime import date, datetime, timedelta
from typing import Any

import httpx

from app.config import GOOGLE_CIVIC_API_KEY
from app.services.geocode_service import get_civic_address, normalize_city, normalize_state

logger = logging.getLogger(__name__)

VOTER_INFO_URL = "https://www.googleapis.com/civicinfo/v2/voterinfo"


async def fetch_polling_locations(
    state: str,
    city: str,
    street_address: str,
) -> list[dict[str, Any]]:
    """Fetch polling locations from Google Civic voterinfo API.

    Requires a street address for accurate results.
    Tries up to a handful of active election IDs to find one with polling data.
    """
    if not GOOGLE_CIVIC_API_KEY:
        logger.warning("GOOGLE_CIVIC_API_KEY not set – cannot fetch polling locations")
        return []

    address = get_civic_address(city, state, street_address)
    results: list[dict[str, Any]] = []

    # Try without an electionId first — Google picks the nearest active election
    params: dict[str, str] = {
        "key": GOOGLE_CIVIC_API_KEY,
        "address": address,
    }

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(VOTER_INFO_URL, params=params)
        if resp.status_code == 200:
            data = resp.json()
            results = _extract_locations(data)

        # If the default call gave nothing, iterate known election IDs
        if not results:
            from app.services.election_service import fetch_all_upcoming_elections
            try:
                elections = await fetch_all_upcoming_elections()
                for election in elections[:6]:  # cap to avoid too many requests
                    eid = election.get("id", "").replace("election_", "")
                    if not eid:
                        continue
                    r = await client.get(VOTER_INFO_URL, params={**params, "electionId": eid})
                    if r.status_code == 200:
                        locs = _extract_locations(r.json())
                        if locs:
                            results = locs
                            break
            except Exception as exc:
                logger.warning("Election iteration failed for polling lookup: %s", exc)

    return results


_LINE_RE = re.compile(r'^\w+,\s+(\w+)\s+(\d+):\s+(.+)$')
_DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']


def _parse_future_lines(raw: str) -> list[tuple[date, str]]:
    """Shared parser: turn raw Google Civic hours string into (date, hours) pairs, future only."""
    today = date.today()
    current_year = today.year
    result: list[tuple[date, str]] = []
    for line in raw.replace('\r\n', '\n').split('\n'):
        line = line.strip()
        m = _LINE_RE.match(line)
        if not m:
            continue
        month_str, day_str, hours = m.group(1), m.group(2), m.group(3)
        try:
            d = datetime.strptime(f"{month_str} {day_str} {current_year}", "%b %d %Y").date()
            if d < today - timedelta(days=180):
                d = d.replace(year=current_year + 1)
        except ValueError:
            continue
        if d >= today:
            result.append((d, hours))
    result.sort(key=lambda x: x[0])
    return result


def _format_early_vote_hours(raw: str) -> str:
    """Format early voting in business-hours style, grouping by recurring day-of-week pattern.

    Example output:
        Mar 30 \u2013 Apr 18
        Mon\u2013Fri: 8:30 am - 5:00 pm
        Sat: 9 am - 5 pm
        Sun: 1 pm - 5 pm
    """
    parsed = _parse_future_lines(raw)
    if not parsed:
        return ""

    first, last = parsed[0][0], parsed[-1][0]
    if first == last:
        date_range = f"{first.strftime('%b')} {first.day}"
    elif first.month == last.month:
        date_range = f"{first.strftime('%b')} {first.day}\u2013{last.day}"
    else:
        date_range = f"{first.strftime('%b')} {first.day} \u2013 {last.strftime('%b')} {last.day}"

    # Map weekday -> most common hours across all occurrences
    dow_bucket: dict[int, list[str]] = {}
    for d, h in parsed:
        dow_bucket.setdefault(d.weekday(), []).append(h)
    dow_primary: dict[int, str] = {
        dow: Counter(hs).most_common(1)[0][0]
        for dow, hs in dow_bucket.items()
    }

    # Group consecutive weekdays (Mon=0..Sun=6) with identical hours
    active = sorted(dow_primary)
    groups: list[tuple[list[int], str]] = []
    g_dows = [active[0]]
    g_h = dow_primary[active[0]]
    for i in range(1, len(active)):
        d, h = active[i], dow_primary[active[i]]
        if h == g_h and d == active[i - 1] + 1:
            g_dows.append(d)
        else:
            groups.append((g_dows[:], g_h))
            g_dows, g_h = [d], h
    groups.append((g_dows, g_h))

    lines_out = [date_range]
    for dows, h in groups:
        if len(dows) == 1:
            label = _DOW[dows[0]]
        elif len(dows) == 2:
            label = f"{_DOW[dows[0]]} & {_DOW[dows[-1]]}"
        else:
            label = f"{_DOW[dows[0]]}\u2013{_DOW[dows[-1]]}"
        lines_out.append(f"{label}: {h}")

    return "\n".join(lines_out)


def _format_polling_hours(raw: str, kind: str = "polling") -> str:
    """Format polling hours string. Early-vote sites use business-hours style.

    Input lines look like: "Mon, Apr 6: 8:30 am - 5:00 pm"
    """
    if not raw:
        return raw
    if kind in ("early_vote", "drop_off"):
        return _format_early_vote_hours(raw)

    parsed = _parse_future_lines(raw)
    if not parsed:
        return ""

    # Group consecutive calendar days (exactly 1 day apart) with identical hours
    groups: list[tuple[date, date, str]] = []
    s, e, cur_h = parsed[0][0], parsed[0][0], parsed[0][1]
    for i in range(1, len(parsed)):
        d, h = parsed[i]
        prev = parsed[i - 1][0]
        if h == cur_h and (d - prev).days == 1:
            e = d
        else:
            groups.append((s, e, cur_h))
            s, e, cur_h = d, d, h
    groups.append((s, e, cur_h))

    parts: list[str] = []
    for s, e, h in groups:
        if s == e:
            label = f"{s.strftime('%b')} {s.day}"
        elif s.month == e.month:
            label = f"{s.strftime('%b')} {s.day}\u2013{e.day}"
        else:
            label = f"{s.strftime('%b')} {s.day}\u2013{e.strftime('%b')} {e.day}"
        parts.append(f"{label}: {h}")

    return "\n".join(parts)


def _extract_locations(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Parse pollingLocations and dropOffLocations out of a voterinfo response."""
    locations: list[dict[str, Any]] = []

    for kind, raw_list in (
        ("polling", data.get("pollingLocations", [])),
        ("drop_off", data.get("dropOffLocations", [])),
        ("early_vote", data.get("earlyVoteSites", [])),
    ):
        for loc in raw_list:
            addr = loc.get("address", {})
            name = (
                addr.get("locationName")
                or loc.get("name")
                or "Polling Location"
            )
            line1 = addr.get("line1", "")
            line2 = addr.get("line2", "")
            city = addr.get("city", "")
            state = addr.get("state", "")
            zip_code = addr.get("zip", "")

            full_address_parts = [p for p in [line1, line2, city, state, zip_code] if p]
            full_address = ", ".join(full_address_parts)

            locations.append({
                "kind": kind,
                "name": name,
                "address": full_address,
                "line1": line1,
                "city": city,
                "state": state,
                "zip": zip_code,
                "polling_hours": _format_polling_hours(loc.get("pollingHours") or loc.get("startTime", ""), kind),
                "notes": loc.get("notes", ""),
                "sources": loc.get("sources", []),
            })

    return locations
