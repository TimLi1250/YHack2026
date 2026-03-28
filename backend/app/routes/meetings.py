from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.schemas import MeetingFetchRequest, MeetingSummarizeRequest
from app.services.meeting_service import (
    get_meeting_by_id,
    get_meetings,
    summarize_meeting_by_id,
)
from app.services.source_service import get_sources_for_entity

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.get("/congressional")
async def congressional_meetings(
    chamber: str | None = Query(None),
) -> list[dict[str, Any]]:
    """Get recent congressional meetings/hearings."""
    return await get_meetings(meeting_type="congressional", chamber=chamber)


@router.get("/{meeting_id}")
def get_meeting(meeting_id: str) -> dict[str, Any]:
    """Get a specific meeting."""
    meeting = get_meeting_by_id(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.get("/{meeting_id}/summary")
async def meeting_summary(
    meeting_id: str,
    user_id: str | None = Query(None),
) -> dict[str, Any]:
    """Get or generate a plain-language summary of a meeting."""
    result = await summarize_meeting_by_id(meeting_id, user_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/{meeting_id}/sources")
def meeting_sources(meeting_id: str) -> list[dict[str, Any]]:
    """Get sources for a meeting."""
    return get_sources_for_entity("meeting", meeting_id)


@router.post("/fetch")
async def fetch_meetings(request: MeetingFetchRequest) -> dict[str, Any]:
    """Fetch meeting data."""
    meetings = await get_meetings(chamber=request.chamber)
    return {"count": len(meetings), "meetings": meetings}
