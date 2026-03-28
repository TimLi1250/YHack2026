from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.schemas import LegislationFetchRequest, LegislationSummarizeRequest
from app.services.legislation_service import (
    get_legislation,
    get_legislation_by_id,
    summarize_legislation_by_id,
)
from app.services.source_service import get_sources_for_entity

router = APIRouter(prefix="/legislation", tags=["legislation"])


@router.get("/search")
async def search_legislation(
    q: str | None = Query(None, description="Search query"),
    state: str | None = Query(None),
    bill_number: str | None = Query(None),
) -> list[dict[str, Any]]:
    """Search legislation by query, state, or bill number."""
    return await get_legislation(query=q, state=state, bill_number=bill_number)


@router.get("/{bill_id}")
def get_bill(bill_id: str) -> dict[str, Any]:
    """Get a specific piece of legislation."""
    bill = get_legislation_by_id(bill_id)
    if not bill:
        raise HTTPException(status_code=404, detail="Legislation not found")
    return bill


@router.get("/{bill_id}/summary")
async def bill_summary(
    bill_id: str,
    user_id: str | None = Query(None),
) -> dict[str, Any]:
    """Get or generate a plain-language summary of legislation."""
    result = await summarize_legislation_by_id(bill_id, user_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.get("/{bill_id}/sources")
def bill_sources(bill_id: str) -> list[dict[str, Any]]:
    """Get sources for a piece of legislation."""
    return get_sources_for_entity("legislation", bill_id)


@router.post("/fetch")
async def fetch_legislation_endpoint(request: LegislationFetchRequest) -> dict[str, Any]:
    """Fetch legislation data."""
    results = await get_legislation(
        query=request.query,
        state=request.state,
        bill_number=request.bill_number,
    )
    return {"count": len(results), "legislation": results}


@router.post("/{bill_id}/summarize")
async def summarize_bill(
    bill_id: str,
    request: LegislationSummarizeRequest,
) -> dict[str, Any]:
    """Trigger LLM summarization for a specific bill."""
    result = await summarize_legislation_by_id(bill_id, request.user_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result
