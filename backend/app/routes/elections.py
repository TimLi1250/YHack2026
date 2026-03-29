from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.services.election_service import fetch_all_upcoming_elections, get_election_by_id

router = APIRouter(prefix="/elections", tags=["elections"])


@router.get("")
async def list_elections(
    limit: int | None = None,
    year: int | None = None,
) -> list[dict[str, Any]]:
    """Get upcoming elections sorted by date.

    - **limit**: return only the next N elections
    - **year**: filter to elections in a specific year (e.g. 2026)
    """
    return await fetch_all_upcoming_elections(limit=limit, year=year)


@router.get("/{election_id}")
def get_election(election_id: str) -> dict[str, Any] | None:
    """Get a specific election by ID."""
    return get_election_by_id(election_id)
