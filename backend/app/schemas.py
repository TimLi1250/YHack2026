from __future__ import annotations

import re
from typing import Any, ClassVar

from pydantic import BaseModel, Field, field_validator, model_validator

AGE_OPTIONS = [
    "Under 18",
    "18-24",
    "25-34",
    "35-44",
    "45-54",
    "55-64",
    "65+",
]

SALARY_OPTIONS = [
    "Under $25k",
    "$25k-$50k",
    "$50k-$100k",
    "$100k-$200k",
    "$200k+",
    "Prefer not to say",
]

GENDER_OPTIONS = [
    "Male",
    "Female",
    "Nonbinary",
    "Other",
    "Prefer not to say",
]

ETHNICITY_OPTIONS = [
    "East Asian",
    "South Asian / Indian",
    "White",
    "Black",
    "Indigenous",
    "Latino / Hispanic",
    "Middle Eastern / North African",
    "Pacific Islander",
    "Multiracial",
    "Other",
    "Prefer not to say",
]

INTEREST_OPTIONS = [
    "Taxes",
    "Abortion",
    "Voting Rights",
    "Housing",
    "Education",
    "Healthcare",
    "Transportation",
    "Climate",
    "Economy",
    "Immigration",
    "Public Safety",
    "Reproductive Rights",
    "Labor",
    "Student Debt",
]

AgeRange = str
SalaryRange = str
GenderValue = str
EthnicityValue = str


class UserCreate(BaseModel):
    AGE_OPTIONS: ClassVar[list[str]] = AGE_OPTIONS
    SALARY_OPTIONS: ClassVar[list[str]] = SALARY_OPTIONS
    GENDER_OPTIONS: ClassVar[list[str]] = GENDER_OPTIONS
    ETHNICITY_OPTIONS: ClassVar[list[str]] = ETHNICITY_OPTIONS
    INTEREST_OPTIONS: ClassVar[list[str]] = INTEREST_OPTIONS

    name: str | None = None
    age_range: AgeRange | None = None
    ethnicity: EthnicityValue | None = None
    interests: list[str] = Field(default_factory=list)
    salary_range: SalaryRange | None = None
    gender: GenderValue | None = None
    state: str
    city: str
    language_preference: str = "en"

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("ethnicity")
    @classmethod
    def clean_ethnicity(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = re.sub(r"\s+", " ", v.strip())
        return v or None

    @field_validator("city", "state")
    @classmethod
    def normalize_location_fields(cls, v: str) -> str:
        v = re.sub(r"\s+", " ", v.strip())
        if not v:
            raise ValueError("Location fields cannot be empty")
        return v

    @field_validator("language_preference")
    @classmethod
    def clean_language(cls, v: str) -> str:
        v = v.strip().lower()
        return v or "en"

    @field_validator("interests", mode="before")
    @classmethod
    def normalize_interests_input(cls, v: Any) -> list[str]:
        if v is None:
            return []
        if isinstance(v, str):
            parts = re.split(r"[,;/|]", v)
            return [p.strip() for p in parts if p.strip()]
        if isinstance(v, list):
            cleaned: list[str] = []
            for item in v:
                if item is None:
                    continue
                item_str = str(item).strip()
                if item_str:
                    cleaned.append(item_str)
            return cleaned
        raise ValueError("Interests must be a list or comma-separated string")

    @field_validator("interests")
    @classmethod
    def dedupe_interests(cls, v: list[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for item in v:
            normalized = re.sub(r"\s+", " ", item.strip())
            if normalized and normalized not in seen:
                seen.add(normalized)
                result.append(normalized)
        return result[:20]

    @model_validator(mode="after")
    def validate_profile(self) -> "UserCreate":
        if len(self.city) > 100 or len(self.state) > 100:
            raise ValueError("City/state too long")
        return self


class UserUpdate(BaseModel):
    name: str | None = None
    age_range: AgeRange | None = None
    ethnicity: EthnicityValue | None = None
    interests: list[str] | str | None = None
    salary_range: SalaryRange | None = None
    gender: GenderValue | None = None
    state: str | None = None
    city: str | None = None
    language_preference: str | None = None


class UserRecord(BaseModel):
    id: str
    name: str | None = None
    age_range: AgeRange | None = None
    ethnicity: str | None = None
    interests: list[str] = Field(default_factory=list)
    salary_range: SalaryRange | None = None
    gender: GenderValue | None = None
    state: str
    city: str
    language_preference: str = "en"
    normalized_location: dict[str, str]
    derived_traits: list[str]
    parsed_profile: dict[str, Any]
    created_at: str
    updated_at: str