from __future__ import annotations

import asyncio
import logging
import re
from typing import Any
from uuid import uuid4

import httpx

from app.config import CONGRESS_API_KEY, MEETINGS_FILE
from app.services.llm_service import summarize_meeting
from app.services.source_service import add_source
from app.services.user_service import get_user
from app.storage import append_json, find_by_id, load_json, save_json
from app.utils import now_iso

logger = logging.getLogger(__name__)

# Congress.gov API
CONGRESS_API_BASE = "https://api.congress.gov/v3"


def _congress_ordinal(congress: int | str) -> str:
    """Return ordinal string for congress number, e.g. 119 -> '119th'."""
    n = int(congress)
    if 11 <= (n % 100) <= 13:
        return f"{n}th"
    return f"{n}{['th','st','nd','rd'][n % 10] if n % 10 < 4 else 'th'}"


def _public_hearing_url(hearing: dict[str, Any], detail: dict[str, Any] | None) -> str:
    """Build a stable public Congress.gov URL for a hearing."""
    congress = ""
    jacket_number = ""
    chamber = ""

    if detail:
        congress = str(detail.get("congress", ""))
        jacket_number = str(detail.get("jacketNumber", ""))
        chamber = (detail.get("chamber") or "").lower()
    if not congress:
        congress = str(hearing.get("congress", "119"))
    if not jacket_number:
        jacket_number = str(hearing.get("jacketNumber", ""))
    if not chamber:
        chamber = (hearing.get("chamber") or "").lower()

    if congress and jacket_number and chamber:
        return f"https://www.congress.gov/event/{_congress_ordinal(congress)}-congress/{chamber}-event/{jacket_number}"
    # Fallback: strip the API URL to something reasonable
    return hearing.get("url", "")


async def _fetch_hearing_detail(
    client: httpx.AsyncClient,
    hearing_url: str,
) -> dict[str, Any] | None:
    """Fetch individual hearing detail from Congress.gov to get title, committee, dates, and formats."""
    if not hearing_url:
        return None
    try:
        resp = await client.get(hearing_url, params={"format": "json", "api_key": CONGRESS_API_KEY})
        resp.raise_for_status()
        data = resp.json()
        return data.get("hearing", {})
    except Exception as e:
        logger.warning("Could not fetch hearing detail from %s: %s", hearing_url, e)
        return None


async def _fetch_hearing_text(
    client: httpx.AsyncClient,
    detail: dict[str, Any],
) -> str | None:
    """Try to fetch hearing text from govinfo.gov HTML format if available."""
    formats = detail.get("formats", [])
    text_url = None
    for fmt in formats:
        fmt_type = (fmt.get("type") or "").lower()
        url_candidate = fmt.get("url", "")
        if "html" in fmt_type or "htm" in fmt_type or "text" in fmt_type:
            text_url = url_candidate
            break
    if not text_url:
        return None

    try:
        resp = await client.get(text_url, follow_redirects=True)
        resp.raise_for_status()
        html_content = resp.text
        plain = re.sub(r"<[^>]+>", " ", html_content)
        plain = re.sub(r"\s+", " ", plain).strip()
        return plain[:15000] if len(plain) > 15000 else plain
    except Exception as e:
        logger.warning("Could not fetch hearing text from %s: %s", text_url, e)
        return None


async def fetch_congressional_hearings(
    congress: int = 119,
    chamber: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Fetch recent congressional hearings from Congress.gov API with full details."""
    results: list[dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            url = f"{CONGRESS_API_BASE}/hearing/{congress}"
            params: dict[str, Any] = {"limit": limit, "format": "json", "api_key": CONGRESS_API_KEY}
            if chamber:
                params["chamber"] = chamber

            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

            hearings_list = data.get("hearings", [])

            # Fetch individual hearing details in parallel to get real titles, committees
            detail_tasks = [
                _fetch_hearing_detail(client, h.get("url", ""))
                for h in hearings_list
            ]
            details = await asyncio.gather(*detail_tasks)

            # Try to fetch hearing text in parallel for those with HTML formats
            text_coros = []
            for d in details:
                if d:
                    text_coros.append(_fetch_hearing_text(client, d))
                else:
                    async def _noop() -> None:
                        return None
                    text_coros.append(_noop())
            texts = await asyncio.gather(*text_coros)

            for hearing, detail, text in zip(hearings_list, details, texts):
                # Prefer detail info over list info
                if detail:
                    title = detail.get("title") or hearing.get("title", "Untitled Hearing")
                    chamber_val = detail.get("chamber") or hearing.get("chamber")
                    committees = detail.get("committees", [])
                    committee = committees[0].get("name") if committees else None
                    dates = detail.get("dates", [])
                    date_val = dates[0].get("date") if dates else hearing.get("date")
                else:
                    title = hearing.get("title", "Untitled Hearing")
                    chamber_val = hearing.get("chamber")
                    committee = hearing.get("committees", [{}])[0].get("name") if hearing.get("committees") else None
                    date_val = hearing.get("date")

                public_url = _public_hearing_url(hearing, detail)

                meeting = {
                    "id": f"meeting_{uuid4().hex[:12]}",
                    "title": title,
                    "meeting_type": "congressional",
                    "date": date_val,
                    "chamber": chamber_val,
                    "committee": committee,
                    "source_url": hearing.get("url"),
                    "public_url": public_url,
                    "sources": [{"label": "Congress.gov", "url": public_url}],
                    "created_at": now_iso(),
                }
                if text:
                    meeting["transcript_text"] = text
                results.append(meeting)

    except httpx.HTTPError as e:
        logger.error("Error fetching congressional hearings: %s", e)

    return results


async def get_meetings(
    meeting_type: str | None = None,
    chamber: str | None = None,
) -> list[dict[str, Any]]:
    """Return meetings from cache, optionally filtered."""
    meetings = load_json(MEETINGS_FILE)

    if not meetings:
        fetched = await fetch_congressional_hearings(chamber=chamber)
        if fetched:
            for m in fetched:
                meetings.append(m)
                add_source("meeting", m["id"], "Congress.gov", m.get("source_url", ""))
            save_json(MEETINGS_FILE, meetings)

    # Backfill hearings that have "Untitled Hearing" or are missing transcript_text
    needs_backfill = [
        i for i, m in enumerate(meetings)
        if m.get("title") == "Untitled Hearing" or (
            not m.get("transcript_text") and m.get("source_url")
        )
    ]
    if needs_backfill:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                detail_tasks = [
                    _fetch_hearing_detail(client, meetings[i].get("source_url", ""))
                    for i in needs_backfill
                ]
                details = await asyncio.gather(*detail_tasks)
                text_coros = []
                for d in details:
                    if d:
                        text_coros.append(_fetch_hearing_text(client, d))
                    else:
                        async def _noop() -> None:
                            return None
                        text_coros.append(_noop())
                texts = await asyncio.gather(*text_coros)

                updated = False
                for idx, detail, text in zip(needs_backfill, details, texts):
                    if detail:
                        if meetings[idx].get("title") == "Untitled Hearing":
                            new_title = detail.get("title")
                            if new_title:
                                meetings[idx]["title"] = new_title
                                updated = True
                        if not meetings[idx].get("committee"):
                            committees = detail.get("committees", [])
                            if committees:
                                meetings[idx]["committee"] = committees[0].get("name")
                                updated = True
                        if not meetings[idx].get("date"):
                            dates = detail.get("dates", [])
                            if dates:
                                meetings[idx]["date"] = dates[0].get("date")
                                updated = True
                    if text and not meetings[idx].get("transcript_text"):
                        meetings[idx]["transcript_text"] = text
                        updated = True
                if updated:
                    save_json(MEETINGS_FILE, meetings)
        except Exception as e:
            logger.warning("Could not backfill hearing details: %s", e)

    result = meetings
    if meeting_type:
        result = [m for m in result if m.get("meeting_type") == meeting_type]
    if chamber:
        result = [m for m in result if m.get("chamber", "").lower() == chamber.lower()]

    return result


def get_meeting_by_id(meeting_id: str) -> dict[str, Any] | None:
    return find_by_id(MEETINGS_FILE, meeting_id)


async def summarize_meeting_by_id(
    meeting_id: str,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Use LLM to summarize a meeting record."""
    meetings = load_json(MEETINGS_FILE)
    meeting = None
    meeting_idx = -1
    for i, m in enumerate(meetings):
        if m.get("id") == meeting_id:
            meeting = m
            meeting_idx = i
            break

    if meeting is None or meeting_idx < 0:
        return {"error": "Meeting not found"}

    transcript = meeting.get("transcript_text") or meeting.get("title", "")
    if not transcript.strip():
        return {"error": "No transcript or content available for summarization"}

    user_traits: list[str] = []
    if user_id:
        try:
            user = get_user(user_id)
            user_traits = user.get("derived_traits", [])
        except Exception:
            pass

    summary = await summarize_meeting(
        transcript_text=transcript,
        title=meeting.get("title", ""),
        user_traits=user_traits or None,
    )

    if isinstance(summary, dict) and "raw_response" not in summary:
        meeting["summary"] = summary.get("summary")
        meeting["vernacular_summary"] = summary.get("vernacular_summary")
        meeting["effect_on_user"] = summary.get("effect_on_user")
        meeting["effects_on_groups"] = summary.get("effects_on_groups", [])
        meeting["uncertainties"] = summary.get("uncertainties", [])
        meetings[meeting_idx] = meeting
        save_json(MEETINGS_FILE, meetings)

    return meeting


def add_meeting(meeting: dict[str, Any]) -> dict[str, Any]:
    """Manually add a meeting record."""
    if not meeting.get("id"):
        meeting["id"] = f"meeting_{uuid4().hex[:12]}"
    meeting["created_at"] = now_iso()
    append_json(MEETINGS_FILE, meeting)
    return meeting
