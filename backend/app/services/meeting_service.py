from __future__ import annotations

import logging
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

# Congress.gov API (free, no key required for basic access)
CONGRESS_API_BASE = "https://api.congress.gov/v3"


async def fetch_congressional_hearings(
    congress: int = 119,
    chamber: str | None = None,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Fetch recent congressional hearings from Congress.gov API."""
    results: list[dict[str, Any]] = []

    try:
        url = f"{CONGRESS_API_BASE}/hearing/{congress}"
        params: dict[str, Any] = {"limit": limit, "format": "json", "api_key": CONGRESS_API_KEY}
        if chamber:
            params["chamber"] = chamber

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        for hearing in data.get("hearings", []):
            meeting = {
                "id": f"meeting_{uuid4().hex[:12]}",
                "title": hearing.get("title", "Untitled Hearing"),
                "meeting_type": "congressional",
                "date": hearing.get("date"),
                "chamber": hearing.get("chamber"),
                "committee": hearing.get("committees", [{}])[0].get("name") if hearing.get("committees") else None,
                "source_url": hearing.get("url"),
                "sources": [{"label": "Congress.gov", "url": hearing.get("url", "")}],
                "created_at": now_iso(),
            }
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
