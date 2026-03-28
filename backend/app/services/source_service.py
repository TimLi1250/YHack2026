from __future__ import annotations

from typing import Any
from uuid import uuid4

from app.config import SOURCES_FILE
from app.storage import append_json, load_json
from app.utils import now_iso


def add_source(
    entity_type: str,
    entity_id: str,
    label: str,
    url: str,
    snippet: str | None = None,
    trust_tier: str = "unverified",
) -> dict[str, Any]:
    """Record a source reference and return the source record."""
    source = {
        "id": f"src_{uuid4().hex[:12]}",
        "entity_type": entity_type,
        "entity_id": entity_id,
        "label": label,
        "url": url,
        "snippet": snippet,
        "retrieved_at": now_iso(),
        "trust_tier": trust_tier,
    }
    append_json(SOURCES_FILE, source)
    return source


def get_sources_for_entity(entity_type: str, entity_id: str) -> list[dict[str, Any]]:
    """Return all sources linked to a given entity."""
    sources = load_json(SOURCES_FILE)
    return [
        s for s in sources
        if s.get("entity_type") == entity_type and s.get("entity_id") == entity_id
    ]


def get_all_sources() -> list[dict[str, Any]]:
    return load_json(SOURCES_FILE)
