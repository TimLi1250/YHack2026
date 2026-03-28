from __future__ import annotations

import logging
from typing import Any
from uuid import uuid4

import httpx

from app.config import LEGISLATION_FILE
from app.services.llm_service import summarize_legislation
from app.services.source_service import add_source
from app.services.user_service import get_user
from app.storage import append_json, find_by_id, load_json, save_json
from app.utils import now_iso

logger = logging.getLogger(__name__)

# Congress.gov API
CONGRESS_API_BASE = "https://api.congress.gov/v3"


async def fetch_legislation(
    query: str | None = None,
    bill_number: str | None = None,
    congress: int = 119,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Fetch bills from Congress.gov API."""
    results: list[dict[str, Any]] = []

    try:
        if bill_number:
            # Try to parse bill type and number (e.g. "hr123" → type=hr, number=123)
            bill_type, bill_num = _parse_bill_number(bill_number)
            url = f"{CONGRESS_API_BASE}/bill/{congress}/{bill_type}/{bill_num}"
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(url, params={"format": "json"})
                resp.raise_for_status()
                data = resp.json()

            bill = data.get("bill", {})
            if bill:
                results.append(_normalize_bill(bill))
        else:
            url = f"{CONGRESS_API_BASE}/bill/{congress}"
            params: dict[str, Any] = {"limit": limit, "format": "json"}
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()

            for bill in data.get("bills", []):
                results.append(_normalize_bill(bill))

    except httpx.HTTPError as e:
        logger.error("Error fetching legislation: %s", e)

    return results


def _parse_bill_number(bill_number: str) -> tuple[str, str]:
    """Parse 'hr123' or 'HR 123' or 's456' into (type, number)."""
    cleaned = bill_number.lower().replace(" ", "").replace(".", "").replace("-", "")
    for prefix in ("hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"):
        if cleaned.startswith(prefix):
            return prefix, cleaned[len(prefix):]
    return "hr", cleaned


def _normalize_bill(bill: dict[str, Any]) -> dict[str, Any]:
    """Normalize a Congress.gov bill response into our schema."""
    bill_url = bill.get("url", "")
    return {
        "id": f"leg_{uuid4().hex[:12]}",
        "doc_type": "bill",
        "title": bill.get("title", ""),
        "chamber": bill.get("originChamber"),
        "bill_number": f"{bill.get('type', '')}{bill.get('number', '')}".lower(),
        "jurisdiction": "federal",
        "session": str(bill.get("congress", "")),
        "status": bill.get("latestAction", {}).get("text"),
        "introduced_at": bill.get("introducedDate"),
        "source_url": bill_url,
        "sources": [{"label": "Congress.gov", "url": bill_url}],
        "created_at": now_iso(),
    }


async def get_legislation(
    query: str | None = None,
    state: str | None = None,
    bill_number: str | None = None,
) -> list[dict[str, Any]]:
    """Return legislation records, fetching from API if cache is empty."""
    legislation = load_json(LEGISLATION_FILE)

    if bill_number:
        # Check cache first
        matches = [
            l for l in legislation
            if l.get("bill_number", "").lower() == bill_number.lower().replace(" ", "")
        ]
        if matches:
            return matches

    if not legislation or bill_number:
        fetched = await fetch_legislation(query=query, bill_number=bill_number)
        if fetched:
            for l in fetched:
                legislation.append(l)
                add_source("legislation", l["id"], "Congress.gov", l.get("source_url", ""))
            save_json(LEGISLATION_FILE, legislation)
            if bill_number:
                return fetched

    # Filter by query if provided
    if query:
        q = query.lower()
        legislation = [
            l for l in legislation
            if q in l.get("title", "").lower() or q in l.get("bill_number", "").lower()
        ]

    return legislation


def get_legislation_by_id(bill_id: str) -> dict[str, Any] | None:
    return find_by_id(LEGISLATION_FILE, bill_id)


async def summarize_legislation_by_id(
    bill_id: str,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Use LLM to summarize a bill and cache the result."""
    legislation = load_json(LEGISLATION_FILE)
    bill = None
    bill_idx = -1
    for i, l in enumerate(legislation):
        if l.get("id") == bill_id:
            bill = l
            bill_idx = i
            break

    if bill is None or bill_idx < 0:
        return {"error": "Legislation not found"}

    text = bill.get("raw_text") or bill.get("title", "")
    if not text.strip():
        return {"error": "No bill text available for summarization"}

    user_traits: list[str] = []
    if user_id:
        try:
            user = get_user(user_id)
            user_traits = user.get("derived_traits", [])
        except Exception:
            pass

    summary = await summarize_legislation(
        bill_text=text,
        title=bill.get("title", ""),
        user_traits=user_traits or None,
    )

    if isinstance(summary, dict) and "raw_response" not in summary:
        bill["plain_summary"] = summary.get("plain_summary")
        bill["vernacular_summary"] = summary.get("vernacular_summary")
        bill["effect_on_user"] = summary.get("effect_on_user")
        bill["effects_on_groups"] = summary.get("effects_on_groups", [])
        bill["uncertainties"] = summary.get("uncertainties", [])
        legislation[bill_idx] = bill
        save_json(LEGISLATION_FILE, legislation)

    return bill


def add_legislation(record: dict[str, Any]) -> dict[str, Any]:
    """Manually add a legislation record."""
    if not record.get("id"):
        record["id"] = f"leg_{uuid4().hex[:12]}"
    record["created_at"] = now_iso()
    append_json(LEGISLATION_FILE, record)
    return record
