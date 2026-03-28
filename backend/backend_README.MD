# Civic AI Backend

A FastAPI backend that aggregates civic data (elections, ballots, candidates, legislation, congressional meetings) and uses LLM-powered summarization to make it accessible in plain language.

## Quick Start

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Server runs at **http://127.0.0.1:8000**. Interactive docs at `/docs`.

## Environment Variables

Create a `.env` file in `backend/`:

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | For summaries | OpenAI key for LLM-powered plain-language explanations |
| `OPENAI_MODEL` | No | Model to use (default: `gpt-4o-mini`) |
| `GOOGLE_CIVIC_API_KEY` | For live data | Google Civic Information API key for elections, ballots, candidates |
| `GEOCODE_API_KEY` | No | For address normalization |

Without API keys, the app falls back to cached JSON data in `app/data/`.

The **Congress.gov API** (`api.congress.gov`) is used for legislation and hearings but requires an API key passed as a query parameter. Set `CONGRESS_API_KEY` if you have one; otherwise those endpoints return cached data.

## Architecture

```
app/
├── main.py          # FastAPI app, CORS, router registration
├── config.py        # Env vars, file paths, LLM settings
├── schemas.py       # Pydantic models for validation
├── storage.py       # JSON file-based persistence (load/save/find/update)
├── utils.py         # Timestamp & string helpers
├── data/            # JSON data files (users, ballots, candidates, etc.)
├── routes/          # HTTP endpoint definitions
│   ├── users.py
│   ├── ballots.py
│   ├── candidates.py
│   ├── legislation.py
│   ├── meetings.py
│   └── notifications.py
└── services/        # Business logic, API integrations, LLM calls
    ├── user_service.py
    ├── ballot_service.py
    ├── candidate_service.py
    ├── election_service.py
    ├── legislation_service.py
    ├── meeting_service.py
    ├── notification_service.py
    ├── llm_service.py
    ├── geocode_service.py
    └── source_service.py
```

**Data flow:** Routes → Services → Storage (JSON files) / External APIs / LLM

## API Endpoints

### Health Check

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{"status": "ok"}` |

### Users

| Method | Path | Description |
|--------|------|-------------|
| POST | `/users` | Create a new user profile |
| GET | `/users` | List all users |
| GET | `/users/{user_id}` | Get a specific user |
| PATCH | `/users/{user_id}` | Update a user profile |

User profiles include demographic info (age range, ethnicity, interests, salary range, gender, location) used to personalize LLM summaries. On creation, the service derives traits (e.g., "young voter", "cost_sensitive_household") and builds a parsed profile with interest buckets and likely groups.

### Ballots

| Method | Path | Description |
|--------|------|-------------|
| GET | `/ballots/upcoming?state=...&city=...` | Get upcoming ballot items for a location |
| GET | `/ballots/{ballot_id}` | Get a specific ballot item |
| GET | `/ballots/{ballot_id}/summary?user_id=...` | Get/generate a plain-language summary |
| GET | `/ballots/{ballot_id}/sources` | Get reference sources |
| GET | `/ballots/election/{election_id}` | Get all ballots in an election |
| POST | `/ballots/fetch` | Trigger ballot fetch from Google Civic API |

Summaries include: `plain_summary`, `simple_summary`, `one_sentence`, `yes_means`, `no_means`, `effect_on_user`, `effects_on_groups`.

### Candidates

| Method | Path | Description |
|--------|------|-------------|
| GET | `/candidates?state=...&city=...&office=...` | List candidates (all filters optional) |
| GET | `/candidates/{candidate_id}` | Get a specific candidate |
| GET | `/candidates/{candidate_id}/profile?user_id=...` | Generate enriched LLM profile |
| GET | `/candidates/{candidate_id}/sources` | Get reference sources |
| GET | `/candidates/ballot/{ballot_item_id}` | Get candidates for a specific race |
| POST | `/candidates/compare` | Compare 2+ candidates side-by-side |
| POST | `/candidates/fetch` | Fetch candidates from Google Civic API |

Profiles include: `bio_summary`, `positions`, `work_history_summary`, `controversy_summary`, `user_effect_summary`, `group_effects`.

### Legislation

| Method | Path | Description |
|--------|------|-------------|
| GET | `/legislation/search?q=...&state=...&bill_number=...` | Search bills (all filters optional) |
| GET | `/legislation/{bill_id}` | Get a specific bill |
| GET | `/legislation/{bill_id}/summary?user_id=...` | Get/generate plain-language summary |
| GET | `/legislation/{bill_id}/sources` | Get reference sources |
| POST | `/legislation/{bill_id}/summarize` | Trigger LLM summarization |
| POST | `/legislation/fetch` | Fetch legislation from Congress.gov |

Summaries include: `plain_summary`, `vernacular_summary`, `effect_on_user`, `effects_on_groups`, `uncertainties`.

### Meetings

| Method | Path | Description |
|--------|------|-------------|
| GET | `/meetings/congressional?chamber=...` | Get recent congressional hearings |
| GET | `/meetings/{meeting_id}` | Get a specific meeting |
| GET | `/meetings/{meeting_id}/summary?user_id=...` | Get/generate summary |
| GET | `/meetings/{meeting_id}/sources` | Get reference sources |
| POST | `/meetings/fetch` | Fetch meeting data from Congress.gov |

### Notifications

| Method | Path | Description |
|--------|------|-------------|
| POST | `/notifications/subscribe` | Create a notification subscription |
| GET | `/notifications/{user_id}` | Get all notifications for a user |
| POST | `/notifications/check-deadlines?user_id=...` | Scan elections & create deadline reminders |

Notification types: `registration_deadline`, `absentee_deadline`, `early_voting`, `election_day`, `poll_wait_alert`, `ballot_ready`. Channels: `email`, `sms`, `push`.

## External APIs

| API | Used For | Key Required |
|-----|----------|--------------|
| Google Civic Information API | Elections, ballots, candidates | `GOOGLE_CIVIC_API_KEY` |
| Congress.gov API | Bills, hearings, legislation | `CONGRESS_API_KEY` |
| OpenAI Chat API | Plain-language summaries & comparisons | `OPENAI_API_KEY` |

## LLM Integration

The LLM service (`llm_service.py`) uses OpenAI's chat API to generate neutral, plain-language civic information. Key functions:

- **`summarize_ballot_text`** — Explains ballot measures (what yes/no means, effects)
- **`summarize_candidate`** — Generates candidate bio, positions, controversies
- **`compare_candidates`** — Side-by-side comparison of 2+ candidates
- **`summarize_legislation`** — Explains bills in plain language
- **`summarize_meeting`** — Summarizes congressional hearings

The system prompt enforces neutrality: *"Never recommend how to vote. Never persuade. Use plain, easy-to-understand language."*

## Data Storage

All data is persisted as JSON files in `app/data/`. The `storage.py` module provides:

- `load_json(path)` — Load a JSON file as a list
- `save_json(path, data)` — Write list to JSON file
- `append_json(path, obj)` — Append a record
- `find_by_id(path, record_id)` — Lookup by `id` field
- `update_by_id(path, record_id, updates)` — Merge updates into a record

## Dependencies

- **FastAPI** — Web framework
- **Uvicorn** — ASGI server
- **Pydantic** — Data validation
- **httpx** — Async HTTP client for external APIs
- **python-dotenv** — Environment variable loading
