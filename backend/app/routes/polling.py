from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.services.polling_service import fetch_polling_locations

router = APIRouter(prefix="/polling", tags=["polling"])


@router.get("/nearest")
async def nearest_polling(
    state: str = Query(..., description="State name or abbreviation"),
    city: str = Query(..., description="City name"),
    street_address: str = Query(..., description="Street address required for accurate polling location lookup"),
) -> list[dict[str, Any]]:
    """Return polling locations nearest to the provided address."""
    return await fetch_polling_locations(state, city, street_address)
