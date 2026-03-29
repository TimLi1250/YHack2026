from __future__ import annotations

import logging
import re
from typing import Any
from uuid import uuid4

from fastapi import HTTPException

from app.config import USERS_FILE
from app.schemas import UserCreate, UserRecord, UserUpdate
from app.services.geocode_service import normalize_city, normalize_state
from app.storage import load_json, save_json
from app.utils import now_iso

logger = logging.getLogger(__name__)

INTEREST_TAGS: dict[str, list[str]] = {
    "taxes": ["Taxes"],
    "abortion": ["Abortion"],
    "voting_rights": ["Voting Rights"],
    "housing": ["Housing"],
    "education": ["Education"],
    "healthcare": ["Healthcare"],
    "transportation": ["Transportation"],
    "climate": ["Climate"],
    "economy": ["Economy"],
    "immigration": ["Immigration"],
    "public_safety": ["Public Safety"],
    "reproductive_rights": ["Reproductive Rights"],
    "labor": ["Labor"],
    "student_debt": ["Student Debt"],
}


def categorize_interests(interests: list[str]) -> dict[str, list[str]]:
    buckets: dict[str, list[str]] = {}
    for interest in interests:
        matched = False
        for category, values in INTEREST_TAGS.items():
            if interest in values:
                buckets.setdefault(category, []).append(interest)
                matched = True
                break
        if not matched:
            buckets.setdefault("other", []).append(interest)
    return buckets


def derive_traits(payload: UserCreate) -> list[str]:
    traits: list[str] = []

    if payload.age_range == "18-24":
        traits.append("young voter")
    elif payload.age_range == "25-34":
        traits.append("early-career adult")
    elif payload.age_range in {"55-64", "65+"}:
        traits.append("older adult")

    if payload.salary_range in {"Under $25k", "$25k-$50k"}:
        traits.append("lower-to-middle income household")
    elif payload.salary_range in {"$100k-$200k", "$200k+"}:
        traits.append("higher income household")

    interest_buckets = categorize_interests(payload.interests)
    for category in interest_buckets:
        if category != "other":
            traits.append(f"interested in {category.replace('_', ' ')}")

    if payload.city:
        traits.append(f"resident of {normalize_city(payload.city)}")
    if payload.state:
        traits.append(f"voter in {normalize_state(payload.state)}")

    seen: set[str] = set()
    deduped: list[str] = []
    for trait in traits:
        if trait not in seen:
            seen.add(trait)
            deduped.append(trait)
    return deduped


def build_parsed_profile(payload: UserCreate) -> dict[str, Any]:
    interest_buckets = categorize_interests(payload.interests)

    likely_groups: list[str] = []
    if payload.age_range == "18-24":
        likely_groups.append("first_time_or_young_voter")
    if "education" in interest_buckets:
        likely_groups.append("education_focused")
    if "housing" in interest_buckets:
        likely_groups.append("housing_focused")
    if payload.salary_range in {"Under $25k", "$25k-$50k"}:
        likely_groups.append("cost_sensitive_household")

    return {
        "normalized_location": {
            "city": normalize_city(payload.city),
            "state": normalize_state(payload.state),
        },
        "interest_buckets": interest_buckets,
        "likely_groups": likely_groups,
        "summary": {
            "has_sensitive_fields": any(
                [payload.age_range, payload.ethnicity, payload.salary_range, payload.gender]
            ),
            "interest_count": len(payload.interests),
            "language_preference": payload.language_preference,
        },
    }


def _find_user_index(users: list[dict[str, Any]], user_id: str) -> int | None:
    for i, user in enumerate(users):
        if user.get("id") == user_id:
            return i
    return None


async def _refresh_user_source_packets(user: dict[str, Any]) -> None:
    state = user.get("state")
    city = user.get("city")
    street_address = user.get("street_address")
    if not state or not city:
        return

    try:
        from app.services.ballot_service import get_upcoming_ballots
        from app.services.candidate_service import get_candidates
        from app.services.election_service import get_upcoming_elections

        await get_upcoming_elections(state, city)
        await get_upcoming_ballots(state, city, street_address=street_address)
        await get_candidates(state=state, city=city, street_address=street_address)
    except Exception as exc:
        logger.warning("Could not refresh civic source packets for user %s: %s", user.get("id"), exc)


async def create_user(payload: UserCreate) -> dict[str, Any]:
    users = load_json(USERS_FILE)
    timestamp = now_iso()

    parsed_profile = build_parsed_profile(payload)
    user = UserRecord(
        id=str(uuid4()),
        name=payload.name,
        age_range=payload.age_range,
        ethnicity=payload.ethnicity,
        interests=payload.interests,
        salary_range=payload.salary_range,
        gender=payload.gender,
        state=payload.state,
        city=payload.city,
        street_address=payload.street_address,
        language_preference=payload.language_preference,
        normalized_location=parsed_profile["normalized_location"],
        derived_traits=derive_traits(payload),
        parsed_profile=parsed_profile,
        created_at=timestamp,
        updated_at=timestamp,
    ).model_dump()

    users.append(user)
    save_json(USERS_FILE, users)
    await _refresh_user_source_packets(user)
    return user


def get_user(user_id: str) -> dict[str, Any]:
    users = load_json(USERS_FILE)
    idx = _find_user_index(users, user_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="User not found")
    return users[idx]


def list_users() -> list[dict[str, Any]]:
    return load_json(USERS_FILE)


async def update_user(user_id: str, payload: UserUpdate) -> dict[str, Any]:
    users = load_json(USERS_FILE)
    idx = _find_user_index(users, user_id)
    if idx is None:
        raise HTTPException(status_code=404, detail="User not found")

    current = users[idx]
    updates = payload.model_dump(exclude_unset=True)
    merged = {**current, **updates}

    validated = UserCreate(
        name=merged.get("name"),
        age_range=merged.get("age_range"),
        ethnicity=merged.get("ethnicity"),
        interests=merged.get("interests", []),
        salary_range=merged.get("salary_range"),
        gender=merged.get("gender"),
        state=merged["state"],
        city=merged["city"],
        street_address=merged.get("street_address"),
        language_preference=merged.get("language_preference", "en"),
    )

    parsed_profile = build_parsed_profile(validated)
    merged["name"] = validated.name
    merged["age_range"] = validated.age_range
    merged["ethnicity"] = validated.ethnicity
    merged["interests"] = validated.interests
    merged["salary_range"] = validated.salary_range
    merged["gender"] = validated.gender
    merged["state"] = validated.state
    merged["city"] = validated.city
    merged["street_address"] = validated.street_address
    merged["language_preference"] = validated.language_preference
    merged["normalized_location"] = parsed_profile["normalized_location"]
    merged["derived_traits"] = derive_traits(validated)
    merged["parsed_profile"] = parsed_profile
    merged["updated_at"] = now_iso()

    users[idx] = merged
    save_json(USERS_FILE, users)
    await _refresh_user_source_packets(merged)
    return merged
