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


# =========================================================
# Election / Ballot schemas
# =========================================================

ELECTION_TYPES = ["primary", "general", "special", "runoff"]
ELECTION_LEVELS = ["city", "county", "state", "federal"]
BALLOT_ITEM_TYPES = ["office", "proposition", "referendum", "bond", "judicial_retention"]


class ElectionRecord(BaseModel):
    id: str
    name: str
    election_date: str
    election_type: str
    level: str
    state: str
    city: str | None = None
    county: str | None = None
    registration_deadline: str | None = None
    absentee_deadline: str | None = None
    early_voting_start: str | None = None
    early_voting_end: str | None = None
    sources: list[dict[str, str]] = Field(default_factory=list)
    created_at: str = ""


class BallotItemRecord(BaseModel):
    id: str
    election_id: str
    title: str
    ballot_text: str
    normalized_type: str  # one of BALLOT_ITEM_TYPES
    election_type: str = ""
    election_level: str = ""
    office_name: str | None = None
    district_name: str | None = None
    plain_summary: str | None = None
    simple_summary: str | None = None
    one_sentence: str | None = None
    yes_means: str | None = None
    no_means: str | None = None
    effect_on_user: str | None = None
    effects_on_groups: list[dict[str, str]] = Field(default_factory=list)
    sources: list[dict[str, str]] = Field(default_factory=list)
    created_at: str = ""


class BallotFetchRequest(BaseModel):
    state: str
    city: str
    user_id: str | None = None


class BallotSummarizeRequest(BaseModel):
    user_id: str | None = None
    reading_level: str = "plain"


# =========================================================
# Candidate schemas
# =========================================================


class CandidateRecord(BaseModel):
    id: str
    ballot_item_id: str | None = None
    election_id: str | None = None
    name: str
    office: str = ""
    party: str | None = None
    incumbent: bool = False
    bio_summary: str | None = None
    positions: dict[str, str] = Field(default_factory=dict)
    work_history_summary: str | None = None
    controversy_summary: str | None = None
    controversies: list[dict[str, Any]] = Field(default_factory=list)
    comparison_summary: str | None = None
    user_effect_summary: str | None = None
    group_effects: list[dict[str, str]] = Field(default_factory=list)
    campaign_site: str | None = None
    photo_url: str | None = None
    sources: list[dict[str, str]] = Field(default_factory=list)
    created_at: str = ""


class CandidateCompareRequest(BaseModel):
    candidate_ids: list[str]
    user_id: str | None = None


class CandidateFetchRequest(BaseModel):
    state: str
    city: str
    office: str | None = None


# =========================================================
# Legislation schemas
# =========================================================

LEGISLATION_DOC_TYPES = ["bill", "hearing", "floor_speech", "committee_meeting", "amendment"]


class LegislationRecord(BaseModel):
    id: str
    doc_type: str  # one of LEGISLATION_DOC_TYPES
    title: str
    chamber: str | None = None
    bill_number: str | None = None
    jurisdiction: str | None = None
    session: str | None = None
    status: str | None = None
    introduced_at: str | None = None
    raw_text: str | None = None
    plain_summary: str | None = None
    vernacular_summary: str | None = None
    effect_on_user: str | None = None
    effects_on_groups: list[dict[str, str]] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    sources: list[dict[str, str]] = Field(default_factory=list)
    source_url: str | None = None
    created_at: str = ""


class LegislationFetchRequest(BaseModel):
    query: str | None = None
    state: str | None = None
    bill_number: str | None = None


class LegislationSummarizeRequest(BaseModel):
    user_id: str | None = None
    reading_level: str = "plain"


# =========================================================
# Meeting schemas
# =========================================================


class MeetingRecord(BaseModel):
    id: str
    title: str
    meeting_type: str = "congressional"  # congressional, committee, city_council, etc.
    date: str | None = None
    chamber: str | None = None
    committee: str | None = None
    transcript_text: str | None = None
    summary: str | None = None
    vernacular_summary: str | None = None
    effect_on_user: str | None = None
    effects_on_groups: list[dict[str, str]] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)
    sources: list[dict[str, str]] = Field(default_factory=list)
    source_url: str | None = None
    created_at: str = ""


class MeetingFetchRequest(BaseModel):
    chamber: str | None = None
    committee: str | None = None
    date_from: str | None = None
    date_to: str | None = None


class MeetingSummarizeRequest(BaseModel):
    user_id: str | None = None
    reading_level: str = "plain"


# =========================================================
# Notification schemas
# =========================================================

NOTIFICATION_TYPES = [
    "registration_deadline",
    "absentee_deadline",
    "early_voting",
    "election_day",
    "poll_wait_alert",
    "ballot_ready",
]

DELIVERY_CHANNELS = ["email", "sms", "push"]


class NotificationCreate(BaseModel):
    user_id: str
    notification_type: str
    scheduled_for: str | None = None
    channel: str = "email"
    message: str | None = None


class NotificationRecord(BaseModel):
    id: str
    user_id: str
    notification_type: str
    scheduled_for: str | None = None
    channel: str = "email"
    message: str = ""
    delivery_status: str = "pending"
    created_at: str = ""


class NotificationPreferencesUpdate(BaseModel):
    channels: list[str] | None = None
    enabled_types: list[str] | None = None


# =========================================================
# Source schemas
# =========================================================


class SourceRecord(BaseModel):
    id: str
    entity_type: str  # candidate, ballot, legislation, meeting
    entity_id: str
    label: str
    url: str
    snippet: str | None = None
    retrieved_at: str = ""
    trust_tier: str = "unverified"


# =========================================================
# Impact request
# =========================================================


class ImpactRequest(BaseModel):
    user_id: str | None = None
    perspective: str | None = None  # e.g. "students", "renters", "seniors"