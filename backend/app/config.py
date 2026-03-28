from __future__ import annotations

import os
from pathlib import Path

# --------------- paths ---------------
DATA_DIR = Path(__file__).resolve().parent / "data"

USERS_FILE = DATA_DIR / "users.json"
ELECTIONS_FILE = DATA_DIR / "elections.json"
BALLOTS_FILE = DATA_DIR / "ballots.json"
CANDIDATES_FILE = DATA_DIR / "candidates.json"
MEETINGS_FILE = DATA_DIR / "meetings.json"
LEGISLATION_FILE = DATA_DIR / "legislation.json"
NOTIFICATIONS_FILE = DATA_DIR / "notifications.json"
SOURCES_FILE = DATA_DIR / "sources.json"

# --------------- defaults ---------------
DEFAULT_LANGUAGE = "en"
DEFAULT_READING_LEVEL = "plain"

# --------------- API keys (env vars) ---------------
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
GOOGLE_CIVIC_API_KEY: str = os.getenv("GOOGLE_CIVIC_API_KEY", "")
GEOCODE_API_KEY: str = os.getenv("GEOCODE_API_KEY", "")

# --------------- LLM settings ---------------
LLM_MAX_TOKENS: int = 2048
LLM_TEMPERATURE: float = 0.3