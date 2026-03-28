const API_BASE = "";

// ─── Types ───────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  name?: string | null;
  age_range?: string | null;
  ethnicity?: string | null;
  interests?: string[];
  salary_range?: string | null;
  gender?: string | null;
  state: string;
  city: string;
  language_preference: string;
  normalized_location?: { city: string; state: string };
  derived_traits?: string[];
  parsed_profile?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface BallotItem {
  id: string;
  election_id: string;
  title: string;
  ballot_text: string;
  normalized_type: string;
  election_type?: string;
  election_level?: string;
  office_name?: string | null;
  district_name?: string | null;
  plain_summary?: string | null;
  simple_summary?: string | null;
  one_sentence?: string | null;
  yes_means?: string | null;
  no_means?: string | null;
  effect_on_user?: string | null;
  effects_on_groups?: { group: string; effect: string }[];
  sources?: { label: string; url: string }[];
  created_at?: string;
}

export interface CandidateRecord {
  id: string;
  ballot_item_id?: string | null;
  election_id?: string | null;
  name: string;
  office: string;
  party?: string | null;
  incumbent?: boolean;
  bio_summary?: string | null;
  positions?: Record<string, string>;
  work_history_summary?: string | null;
  controversy_summary?: string | null;
  controversies?: { summary: string; sources: string[] }[];
  user_effect_summary?: string | null;
  group_effects?: { group: string; effect: string }[];
  campaign_site?: string | null;
  photo_url?: string | null;
  sources?: { label: string; url: string }[];
  created_at?: string;
}

export interface ElectionRecord {
  id: string;
  name: string;
  election_date: string;
  election_type: string;
  level: string;
  state: string;
  city?: string | null;
  registration_deadline?: string | null;
  absentee_deadline?: string | null;
  early_voting_start?: string | null;
  early_voting_end?: string | null;
  sources?: { label: string; url: string }[];
}

export interface LegislationRecord {
  id: string;
  doc_type: string;
  title: string;
  chamber?: string | null;
  bill_number?: string | null;
  status?: string | null;
  plain_summary?: string | null;
  vernacular_summary?: string | null;
  effect_on_user?: string | null;
  effects_on_groups?: { group: string; effect: string }[];
  uncertainties?: string[];
  sources?: { label: string; url: string }[];
  source_url?: string | null;
  created_at?: string;
}

export interface MeetingRecord {
  id: string;
  title: string;
  meeting_type?: string;
  date?: string | null;
  chamber?: string | null;
  committee?: string | null;
  summary?: string | null;
  vernacular_summary?: string | null;
  effect_on_user?: string | null;
  effects_on_groups?: { group: string; effect: string }[];
  uncertainties?: string[];
  sources?: { label: string; url: string }[];
  created_at?: string;
}

export interface NotificationRecord {
  id: string;
  user_id: string;
  notification_type: string;
  scheduled_for?: string | null;
  channel: string;
  message: string;
  delivery_status: string;
  created_at?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Users ───────────────────────────────────────────────────────────

export const users = {
  list: () => request<UserRecord[]>("/users"),
  get: (id: string) => request<UserRecord>(`/users/${id}`),
  create: (data: Partial<UserRecord>) =>
    request<UserRecord>("/users", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, data: Partial<UserRecord>) =>
    request<UserRecord>(`/users/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
};

// ─── Ballots ─────────────────────────────────────────────────────────

export const ballots = {
  upcoming: (state: string, city: string) =>
    request<BallotItem[]>(`/ballots/upcoming?state=${encodeURIComponent(state)}&city=${encodeURIComponent(city)}`),
  get: (id: string) => request<BallotItem>(`/ballots/${id}`),
  summary: (id: string, userId?: string) =>
    request<BallotItem>(`/ballots/${id}/summary${userId ? `?user_id=${userId}` : ""}`),
  sources: (id: string) =>
    request<{ label: string; url: string }[]>(`/ballots/${id}/sources`),
  forElection: (electionId: string) =>
    request<BallotItem[]>(`/ballots/election/${electionId}`),
  fetch: (state: string, city: string) =>
    request<{ count: number; ballots: BallotItem[] }>("/ballots/fetch", {
      method: "POST",
      body: JSON.stringify({ state, city }),
    }),
};

// ─── Candidates ──────────────────────────────────────────────────────

export const candidates = {
  list: (params?: { state?: string; city?: string; office?: string }) => {
    const qs = new URLSearchParams();
    if (params?.state) qs.set("state", params.state);
    if (params?.city) qs.set("city", params.city);
    if (params?.office) qs.set("office", params.office);
    const q = qs.toString();
    return request<CandidateRecord[]>(`/candidates${q ? `?${q}` : ""}`);
  },
  get: (id: string) => request<CandidateRecord>(`/candidates/${id}`),
  profile: (id: string, userId?: string) =>
    request<CandidateRecord>(`/candidates/${id}/profile${userId ? `?user_id=${userId}` : ""}`),
  compare: (candidateIds: string[], userId?: string) =>
    request<Record<string, unknown>>("/candidates/compare", {
      method: "POST",
      body: JSON.stringify({ candidate_ids: candidateIds, user_id: userId }),
    }),
  forBallot: (ballotItemId: string) =>
    request<CandidateRecord[]>(`/candidates/ballot/${ballotItemId}`),
};

// ─── Legislation ─────────────────────────────────────────────────────

export const legislation = {
  search: (params?: { q?: string; state?: string; bill_number?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.state) qs.set("state", params.state);
    if (params?.bill_number) qs.set("bill_number", params.bill_number);
    const q = qs.toString();
    return request<LegislationRecord[]>(`/legislation/search${q ? `?${q}` : ""}`);
  },
  get: (id: string) => request<LegislationRecord>(`/legislation/${id}`),
  summary: (id: string, userId?: string) =>
    request<LegislationRecord>(`/legislation/${id}/summary${userId ? `?user_id=${userId}` : ""}`),
  sources: (id: string) =>
    request<{ label: string; url: string }[]>(`/legislation/${id}/sources`),
};

// ─── Meetings ────────────────────────────────────────────────────────

export const meetings = {
  congressional: (chamber?: string) =>
    request<MeetingRecord[]>(`/meetings/congressional${chamber ? `?chamber=${chamber}` : ""}`),
  get: (id: string) => request<MeetingRecord>(`/meetings/${id}`),
  summary: (id: string, userId?: string) =>
    request<MeetingRecord>(`/meetings/${id}/summary${userId ? `?user_id=${userId}` : ""}`),
};

// ─── Notifications ───────────────────────────────────────────────────

export const notifications = {
  forUser: (userId: string) =>
    request<NotificationRecord[]>(`/notifications/${userId}`),
  subscribe: (data: { user_id: string; notification_type: string; channel?: string; scheduled_for?: string; message?: string }) =>
    request<NotificationRecord>("/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  checkDeadlines: (userId: string) =>
    request<{ new_notifications: number; notifications: NotificationRecord[] }>(
      `/notifications/check-deadlines?user_id=${userId}`,
      { method: "POST" },
    ),
};
