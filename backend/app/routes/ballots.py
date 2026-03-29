from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.schemas import BallotFetchRequest, BallotSummarizeRequest
from app.services.ballot_service import (
    get_ballot_by_id,
    get_ballots_for_election,
    get_upcoming_ballots,
    summarize_ballot,
)
from app.services.source_service import get_sources_for_entity

router = APIRouter(prefix="/ballots", tags=["ballots"])


@router.get("/upcoming")
async def upcoming_ballots(
    state: str = Query(..., description="State name or abbreviation"),
    city: str = Query(..., description="City name"),
    street_address: str | None = Query(None, description="Full street address for precise voter lookup"),
) -> list[dict[str, Any]]:
    """Get upcoming ballot items for a state/city."""
    return await get_upcoming_ballots(state, city, street_address=street_address)


@router.get("/{ballot_id}")
def get_ballot(ballot_id: str) -> dict[str, Any]:
    """Get a specific ballot item."""
    ballot = get_ballot_by_id(ballot_id)
    if not ballot:
        raise HTTPException(status_code=404, detail="Ballot item not found")
    return ballot


@router.get("/{ballot_id}/summary")
async def ballot_summary(
    ballot_id: str,
    user_id: str | None = Query(None),
) -> dict[str, Any]:
    """Get or generate a plain-language summary of a ballot item."""
    result = await summarize_ballot(ballot_id, user_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/{ballot_id}/sources")
def ballot_sources(ballot_id: str) -> list[dict[str, Any]]:
    """Get sources for a ballot item."""
    return get_sources_for_entity("ballot", ballot_id)


@router.get("/election/{election_id}")
def ballots_for_election(election_id: str) -> list[dict[str, Any]]:
    """Get all ballot items for a specific election."""
    return get_ballots_for_election(election_id)


@router.post("/fetch")
async def fetch_ballots(request: BallotFetchRequest) -> dict[str, Any]:
    """Trigger ballot data fetching for a location."""
    ballots = await get_upcoming_ballots(request.state, request.city)
    return {"count": len(ballots), "ballots": ballots}
