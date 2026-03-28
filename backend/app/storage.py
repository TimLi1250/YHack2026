from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DATA_DIR = Path("app/data")
USERS_FILE = DATA_DIR / "users.json"


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