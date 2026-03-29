from __future__ import annotations

import asyncio
import logging
import re
from typing import Any
from uuid import uuid4

import httpx

from app.config import CONGRESS_API_KEY, LEGISLATION_FILE
from app.services.llm_service import summarize_legislation
from app.services.source_service import add_source
from app.services.user_service import get_user
from app.storage import append_json, find_by_id, load_json, save_json
from app.utils import now_iso

logger = logging.getLogger(__name__)

# Congress.gov API
CONGRESS_API_BASE = "https://api.congress.gov/v3"


async def _fetch_bill_text(
    client: httpx.AsyncClient,
    congress: int | str,
    bill_type: str,
    bill_number: str,
) -> str | None:
    """Fetch the raw text of a bill from Congress.gov."""
    try:
        url = f"{CONGRESS_API_BASE}/bill/{congress}/{bill_type}/{bill_number}/text"
        resp = await client.get(url, params={"format": "json", "api_key": CONGRESS_API_KEY})
        resp.raise_for_status()
        data = resp.json()

        text_versions = data.get("textVersions", [])
        if not text_versions:
            return None

        # Use the first (most recent) text version
        formats = text_versions[0].get("formats", [])
        text_url = None
        for fmt in formats:
            if fmt.get("type") == "Formatted Text":
                text_url = fmt.get("url")
                break
        if not text_url:
            for fmt in formats:
                url_candidate = fmt.get("url", "")
                if url_candidate and not url_candidate.endswith(".pdf"):
                    text_url = url_candidate
                    break
        if not text_url:
            return None

        resp = await client.get(text_url, follow_redirects=True)
        resp.raise_for_status()
        html_content = resp.text

        # Strip HTML tags to get plain text
        plain = re.sub(r"<[^>]+>", " ", html_content)
        plain = re.sub(r"\s+", " ", plain).strip()
        return plain[:15000] if len(plain) > 15000 else plain
    except Exception as e:
        logger.warning("Could not fetch bill text for %s%s: %s", bill_type, bill_number, e)
        return None


async def fetch_legislation(
    query: str | None = None,
    bill_number: str | None = None,
    congress: int = 119,
    limit: int = 10,
) -> list[dict[str, Any]]:
    """Fetch bills from Congress.gov API, including full text."""
    results: list[dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            if bill_number:
                bill_type, bill_num = _parse_bill_number(bill_number)
                url = f"{CONGRESS_API_BASE}/bill/{congress}/{bill_type}/{bill_num}"
                resp = await client.get(url, params={"format": "json", "api_key": CONGRESS_API_KEY})
                resp.raise_for_status()
                data = resp.json()

                bill = data.get("bill", {})
                if bill:
                    normalized = _normalize_bill(bill)
                    text = await _fetch_bill_text(client, congress, bill_type, bill_num)
                    if text:
                        normalized["raw_text"] = text
                    results.append(normalized)
            else:
                url = f"{CONGRESS_API_BASE}/bill/{congress}"
                params: dict[str, Any] = {"limit": limit, "format": "json", "api_key": CONGRESS_API_KEY}
                resp = await client.get(url, params=params)
                resp.raise_for_status()
                data = resp.json()

                for bill in data.get("bills", []):
                    results.append(_normalize_bill(bill))

                # Fetch full text for all bills in parallel
                if results:
                    text_tasks = []
                    for r in results:
                        bn = r.get("bill_number", "")
                        bt, num = _parse_bill_number(bn)
                        text_tasks.append(_fetch_bill_text(client, congress, bt, num))
                    texts = await asyncio.gather(*text_tasks)
                    for r, text in zip(results, texts):
                        if text:
                            r["raw_text"] = text

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


# Map API bill type codes to the public Congress.gov URL path segment
_BILL_TYPE_URL_SLUG = {
    "hr": "house-bill",
    "s": "senate-bill",
    "hjres": "house-joint-resolution",
    "sjres": "senate-joint-resolution",
    "hconres": "house-concurrent-resolution",
    "sconres": "senate-concurrent-resolution",
    "hres": "house-resolution",
    "sres": "senate-resolution",
}


def _congress_ordinal(congress: int | str) -> str:
    """Return ordinal suffix for congress number, e.g. 119 -> '119th'."""
    n = int(congress)
    if 11 <= (n % 100) <= 13:
        return f"{n}th"
    return f"{n}{['th','st','nd','rd'][n % 10] if n % 10 < 4 else 'th'}"


def _public_bill_url(bill: dict[str, Any]) -> str:
    """Build a stable public Congress.gov URL for a bill."""
    congress = bill.get("congress", "")
    bill_type = (bill.get("type") or "").lower()
    bill_number = bill.get("number", "")
    slug = _BILL_TYPE_URL_SLUG.get(bill_type, bill_type)
    if congress and slug and bill_number:
        return f"https://www.congress.gov/bill/{_congress_ordinal(congress)}-congress/{slug}/{bill_number}"
    return bill.get("url", "")


def _normalize_bill(bill: dict[str, Any]) -> dict[str, Any]:
    """Normalize a Congress.gov bill response into our schema."""
    public_url = _public_bill_url(bill)
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
        "source_url": public_url,
        "sources": [{"label": "Congress.gov", "url": public_url}],
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

    # Backfill raw_text for cached bills that don't have it yet
    missing = [i for i, l in enumerate(legislation) if not l.get("raw_text") and l.get("bill_number")]
    if missing:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                tasks = []
                for idx in missing:
                    bill = legislation[idx]
                    bt, num = _parse_bill_number(bill["bill_number"])
                    congress = bill.get("session", "119")
                    congress_int = int(congress) if str(congress).isdigit() else 119
                    tasks.append(_fetch_bill_text(client, congress_int, bt, num))
                texts = await asyncio.gather(*tasks)
                updated = False
                for idx, text in zip(missing, texts):
                    if text:
                        legislation[idx]["raw_text"] = text
                        updated = True
                if updated:
                    save_json(LEGISLATION_FILE, legislation)
        except Exception as e:
            logger.warning("Could not backfill bill texts: %s", e)

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
