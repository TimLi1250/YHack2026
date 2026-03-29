from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.schemas import CandidateCompareRequest, CandidateFetchRequest
from app.services.candidate_service import (
    build_candidate_profile,
    compare_candidates_by_ids,
    get_candidate_by_id,
    get_candidates,
    get_candidates_for_ballot_item,
)
from app.services.source_service import get_sources_for_entity

router = APIRouter(prefix="/candidates", tags=["candidates"])


@router.get("")
async def list_candidates(
    state: str | None = Query(None),
    city: str | None = Query(None),
    office: str | None = Query(None),
    street_address: str | None = Query(None, description="Full street address for precise voter lookup"),
) -> list[dict[str, Any]]:
    """List candidates, optionally filtered by location/office."""
    return await get_candidates(state=state, city=city, office=office, street_address=street_address)


@router.get("/{candidate_id}")
def get_candidate(candidate_id: str) -> dict[str, Any]:
    """Get a specific candidate profile."""
    candidate = get_candidate_by_id(candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@router.get("/{candidate_id}/profile")
async def candidate_profile(
    candidate_id: str,
    user_id: str | None = Query(None),
) -> dict[str, Any]:
    """Generate or retrieve an enriched candidate profile with LLM summaries."""
    result = await build_candidate_profile(candidate_id, user_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/{candidate_id}/sources")
def candidate_sources(candidate_id: str) -> list[dict[str, Any]]:
    """Get sources for a candidate."""
    return get_sources_for_entity("candidate", candidate_id)


@router.post("/compare")
async def compare(request: CandidateCompareRequest) -> dict[str, Any]:
    """Compare two or more candidates."""
    result = await compare_candidates_by_ids(
        candidate_ids=request.candidate_ids,
        user_id=request.user_id,
    )
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/fetch")
async def fetch_candidates(request: CandidateFetchRequest) -> dict[str, Any]:
    """Fetch candidate data for a location."""
    candidates = await get_candidates(
        state=request.state,
        city=request.city,
        office=request.office,
    )
    return {"count": len(candidates), "candidates": candidates}


@router.get("/ballot/{ballot_item_id}")
def candidates_for_ballot(ballot_item_id: str) -> list[dict[str, Any]]:
    """Get candidates for a specific ballot item / race."""
    return get_candidates_for_ballot_item(ballot_item_id)
