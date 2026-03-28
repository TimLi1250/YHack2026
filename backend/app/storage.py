from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.config import (
    BALLOTS_FILE,
    CANDIDATES_FILE,
    DATA_DIR,
    ELECTIONS_FILE,
    LEGISLATION_FILE,
    MEETINGS_FILE,
    NOTIFICATIONS_FILE,
    SOURCES_FILE,
    USERS_FILE,
)


def _ensure_data_file(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text("[]", encoding="utf-8")


def load_json(path: Path) -> list[dict[str, Any]]:
    _ensure_data_file(path)
    with path.open("r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            data = []
    return data if isinstance(data, list) else []


def save_json(path: Path, data: list[dict[str, Any]]) -> None:
    _ensure_data_file(path)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def append_json(path: Path, obj: dict[str, Any]) -> None:
    data = load_json(path)
    data.append(obj)
    save_json(path, data)


def find_by_id(path: Path, record_id: str) -> dict[str, Any] | None:
    for record in load_json(path):
        if record.get("id") == record_id:
            return record
    return None


def update_by_id(path: Path, record_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
    data = load_json(path)
    for i, record in enumerate(data):
        if record.get("id") == record_id:
            data[i] = {**record, **updates}
            save_json(path, data)
            return data[i]
    return None