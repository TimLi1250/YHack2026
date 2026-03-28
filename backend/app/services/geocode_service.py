from __future__ import annotations

import logging
import re

logger = logging.getLogger(__name__)

# Lightweight state alias mapping (no external API needed for hackathon)
STATE_ALIASES: dict[str, str] = {
    "al": "Alabama", "ak": "Alaska", "az": "Arizona", "ar": "Arkansas",
    "ca": "California", "co": "Colorado", "ct": "Connecticut", "de": "Delaware",
    "fl": "Florida", "ga": "Georgia", "hi": "Hawaii", "id": "Idaho",
    "il": "Illinois", "in": "Indiana", "ia": "Iowa", "ks": "Kansas",
    "ky": "Kentucky", "la": "Louisiana", "me": "Maine", "md": "Maryland",
    "ma": "Massachusetts", "mi": "Michigan", "mn": "Minnesota", "ms": "Mississippi",
    "mo": "Missouri", "mt": "Montana", "ne": "Nebraska", "nv": "Nevada",
    "nh": "New Hampshire", "nj": "New Jersey", "nm": "New Mexico", "ny": "New York",
    "nc": "North Carolina", "nd": "North Dakota", "oh": "Ohio", "ok": "Oklahoma",
    "or": "Oregon", "pa": "Pennsylvania", "ri": "Rhode Island", "sc": "South Carolina",
    "sd": "South Dakota", "tn": "Tennessee", "tx": "Texas", "ut": "Utah",
    "vt": "Vermont", "va": "Virginia", "wa": "Washington", "wv": "West Virginia",
    "wi": "Wisconsin", "wy": "Wyoming", "dc": "District of Columbia",
}

# Build reverse map too (full name -> full name, for normalization)
_FULL_TO_FULL = {v.lower(): v for v in STATE_ALIASES.values()}


def normalize_state(state: str) -> str:
    """Normalize a state abbreviation or name to its full name."""
    key = re.sub(r"\s+", " ", state.strip().lower())
    if key in STATE_ALIASES:
        return STATE_ALIASES[key]
    if key in _FULL_TO_FULL:
        return _FULL_TO_FULL[key]
    return state.strip().title()


def normalize_city(city: str) -> str:
    """Normalize city name whitespace and casing."""
    return re.sub(r"\s+", " ", city.strip()).title()


def get_normalized_location(state: str, city: str) -> dict[str, str]:
    """Return a normalized location dict."""
    return {
        "city": normalize_city(city),
        "state": normalize_state(state),
    }
