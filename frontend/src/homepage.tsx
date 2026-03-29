import { useEffect, useState, useCallback, type ChangeEvent, type FormEvent } from "react";
import type { UserProfile } from "./profile";
import {
  users,
  ballots,
  candidates as candidatesApi,
  elections as electionsApi,
  legislation as legislationApi,
  meetings as meetingsApi,
  notifications as notificationsApi,
  pollingLocations as pollingApi,
  type UserRecord,
  type BallotItem,
  type CandidateRecord,
  type ElectionRecord,
  type LegislationRecord,
  type MeetingRecord,
  type NotificationRecord,
  type PollingLocation,
} from "./api";

/* ─── dropdown options (match backend schemas.py) ──────────────────── */

const ageOptions = ["Under 18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const salaryOptions = ["Under $25k", "$25k-$50k", "$50k-$100k", "$100k-$200k", "$200k+", "Prefer not to say"];
const genderOptions = ["Male", "Female", "Nonbinary", "Other", "Prefer not to say"];
const ethnicityOptions = [
  "East Asian", "South Asian / Indian", "White", "Black", "Indigenous",
  "Latino / Hispanic", "Middle Eastern / North African", "Pacific Islander",
  "Multiracial", "Other", "Prefer not to say",
];
const interestOptions = [
  "Taxes", "Abortion", "Voting Rights", "Housing", "Education", "Healthcare",
  "Transportation", "Climate", "Economy", "Immigration", "Public Safety",
  "Reproductive Rights", "Labor", "Student Debt",
];

const headingFontStyle = {
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const STATE_NAME_BY_CODE: Record<string, string> = {
  al: "alabama",
  ak: "alaska",
  az: "arizona",
  ar: "arkansas",
  ca: "california",
  co: "colorado",
  ct: "connecticut",
  de: "delaware",
  fl: "florida",
  ga: "georgia",
  hi: "hawaii",
  id: "idaho",
  il: "illinois",
  in: "indiana",
  ia: "iowa",
  ks: "kansas",
  ky: "kentucky",
  la: "louisiana",
  me: "maine",
  md: "maryland",
  ma: "massachusetts",
  mi: "michigan",
  mn: "minnesota",
  ms: "mississippi",
  mo: "missouri",
  mt: "montana",
  ne: "nebraska",
  nv: "nevada",
  nh: "new hampshire",
  nj: "new jersey",
  nm: "new mexico",
  ny: "new york",
  nc: "north carolina",
  nd: "north dakota",
  oh: "ohio",
  ok: "oklahoma",
  or: "oregon",
  pa: "pennsylvania",
  ri: "rhode island",
  sc: "south carolina",
  sd: "south dakota",
  tn: "tennessee",
  tx: "texas",
  ut: "utah",
  vt: "vermont",
  va: "virginia",
  wa: "washington",
  wv: "west virginia",
  wi: "wisconsin",
  wy: "wyoming",
  dc: "district of columbia",
};

/* ─── form types ───────────────────────────────────────────────────── */

const defaultFormState = {
  name: "", age_range: "", ethnicity: "", interests: [] as string[],
  salary_range: "", gender: "", state: "", city: "", street_address: "", language_preference: "en",
};
type Tab = "home" | "explore" | "ballot" | "profile";
type FormState = typeof defaultFormState;

type VotingAssistantHomepageProps = {
  profile: UserProfile;
  onOpenProfile: () => void;
  onOpenExplore: () => void;
  onOpenExploreWithPrompt: (prompt: string) => void;
  onOpenBallot: () => void;
  onOpenCongress: () => void;
  onOpenHome: () => void;
};

function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 rounded-xl bg-slate-200" style={{ width: `${80 - i * 12}%` }} />
      ))}
    </div>
  );
}

function PlaceholderCard({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
      <span className="text-2xl">{icon}</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-slate-400">{title}</p>
        <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function SourcesList({ sources }: { sources?: { label: string; url: string }[] }) {
  if (!sources?.length) return null;
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700">Sources</p>
      <ul className="mt-1 space-y-1">
        {sources.map((s, i) => (
          <li key={i} className="text-xs text-blue-600">
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{s.label}</a>
            ) : s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function QuickStat({ label, value, loading }: { label: string; value: string; loading: boolean }) {
  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-4 text-center shadow-sm">
      {loading ? (
        <div className="mx-auto h-6 w-8 animate-pulse rounded bg-slate-200" />
      ) : (
        <p className="text-xl font-bold text-slate-900">{value}</p>
      )}
      <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-400">{label}</p>
    </div>
  );
}

function tabIcon(tab: Tab) {
  switch (tab) {
    case "home": return "🏠";
    case "explore": return "🔎";
    case "ballot": return "🗳️";
    case "profile": return "👤";
  }
}

function formatNotifType(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
  catch { return iso; }
}

function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const parsed = new Date(`${iso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeStateToken(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase().replace(/\./g, "");
  if (!normalized) return "";
  return STATE_NAME_BY_CODE[normalized] ?? normalized;
}

function inferElectionState(election: ElectionRecord): string {
  const loweredName = election.name.toLowerCase();
  const matchedState = Object.values(STATE_NAME_BY_CODE).find((stateName) => loweredName.includes(stateName));
  return matchedState ?? normalizeStateToken(election.state);
}

function statesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = normalizeStateToken(a);
  const right = normalizeStateToken(b);
  return !!left && !!right && left === right;
}

function titleCase(value: string | null | undefined): string {
  return (value ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function formatElectionContext(election: ElectionRecord): string {
  const parts: string[] = [];
  const normalizedState = inferElectionState(election);
  if (normalizedState && !election.name.toLowerCase().includes(normalizedState)) {
    parts.push(titleCase(normalizedState));
  }

  const normalizedType = (election.election_type ?? "").trim().toLowerCase();
  if (normalizedType && !election.name.toLowerCase().includes(normalizedType)) {
    parts.push(titleCase(normalizedType));
  }

  return parts.join(" · ");
}

/* ═══════════════════════════════════════════════════════════════════ */
/*                        MAIN COMPONENT                              */
/* ═══════════════════════════════════════════════════════════════════ */

export default function VotingAssistantHomepage({
  profile,
  onOpenProfile,
  onOpenExplore,
  onOpenExploreWithPrompt,
  onOpenBallot,
  onOpenCongress,
  onOpenHome,
}: VotingAssistantHomepageProps) {
  /* ── UI state ─────────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [user, setUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [statusMessage, setStatusMessage] = useState("");
  const [saving, setSaving] = useState(false);

  /* ── data from backend (null = not loaded yet) ────────────────────── */
  const [ballotItems, setBallotItems] = useState<BallotItem[] | null>(null);
  const [candidatesList, setCandidatesList] = useState<CandidateRecord[] | null>(null);
  const [electionsList, setElectionsList] = useState<ElectionRecord[] | null>(null);
  const [legislationList, setLegislationList] = useState<LegislationRecord[] | null>(null);
  const [meetingsList, setMeetingsList] = useState<MeetingRecord[] | null>(null);
  const [notificationsList, setNotificationsList] = useState<NotificationRecord[] | null>(null);

  /* ── detail-view state ────────────────────────────────────────────── */
  const [selectedBallot, setSelectedBallot] = useState<BallotItem | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null);
  const [selectedLegislation, setSelectedLegislation] = useState<LegislationRecord | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null);
  const [pollingList, setPollingList] = useState<PollingLocation[] | null>(null);
  const [pollingLoading, setPollingLoading] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);

  const hasLocation = !!(user?.state && user?.city);

  /* ── sync profile prop → internal user so check-in refreshes ───────── */

  useEffect(() => {
    if (!profile.state || !profile.city) return;
    setUser((prev) => {
      if (!prev) {
        return {
          id: "profile-only",
          state: profile.state,
          city: profile.city,
          street_address: profile.street_address ?? null,
          language_preference: profile.language_preference ?? "en",
          name: profile.name ?? null,
          age_range: null,
          ethnicity: null,
          interests: [],
          salary_range: null,
          gender: null,
        } as unknown as UserRecord;
      }
      if (
        prev.state === profile.state &&
        prev.city === profile.city &&
        (prev.street_address ?? "") === (profile.street_address ?? "")
      ) {
        return prev;
      }
      return { ...prev, state: profile.state, city: profile.city, street_address: profile.street_address ?? null };
    });
  }, [profile.state, profile.city, profile.street_address]);

  /* ── load user on mount ───────────────────────────────────────────── */

  useEffect(() => { void loadUser(); }, []);

  async function loadUser() {
    try {
      const list = await users.list();
      const current = list.length > 0 ? list[0] : null;
      if (current) {
        setUser(current);
        setForm(mapUserToForm(current));
      }
    } catch {
      // backend may not be running yet
    }
  }

  /* ── fetch data when location is available ────────────────────────── */

  const fetchLocationData = useCallback(async (u: UserRecord) => {
    if (!u.state || !u.city) return;
    const [b, c, n] = await Promise.allSettled([
      ballots.upcoming(u.state, u.city, u.street_address),
      candidatesApi.list({ state: u.state, city: u.city, street_address: u.street_address }),
      notificationsApi.forUser(u.id),
    ]);
    setBallotItems(b.status === "fulfilled" ? b.value : []);
    setCandidatesList(c.status === "fulfilled" ? c.value : []);
    setNotificationsList(n.status === "fulfilled" ? n.value : []);

    // Fetch polling locations only when a street address is present
    if (u.street_address?.trim()) {
      setPollingLoading(true);
      setPollingError(null);
      try {
        const locs = await pollingApi.nearest(u.state, u.city, u.street_address);
        setPollingList(locs);
      } catch (err) {
        setPollingError(err instanceof Error ? err.message : "Could not load polling locations.");
        setPollingList([]);
      } finally {
        setPollingLoading(false);
      }
    } else {
      setPollingList(null); // null = "not attempted" (no street address)
      setPollingError(null);
    }
  }, []);

  const fetchGlobalData = useCallback(async () => {
    const [l, m, e] = await Promise.allSettled([
      legislationApi.search(),
      meetingsApi.congressional(),
      electionsApi.list({ year: 2026 }),
    ]);
    setLegislationList(l.status === "fulfilled" ? l.value : []);
    setMeetingsList(m.status === "fulfilled" ? m.value : []);
    setElectionsList(e.status === "fulfilled" ? e.value : []);
  }, []);

  useEffect(() => {
    if (user && hasLocation) void fetchLocationData(user);
  }, [user?.id, hasLocation, user?.street_address, fetchLocationData]);

  useEffect(() => { void fetchGlobalData(); }, [fetchGlobalData]);

  const currentDate = new Date();
  const calendarYear = 2026;
  const calendarMonthIndex = currentDate.getMonth();
  const calendarMonthStart = new Date(calendarYear, calendarMonthIndex, 1);
  const calendarMonthLabel = calendarMonthStart.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const daysInMonth = new Date(calendarYear, calendarMonthIndex + 1, 0).getDate();
  const leadingBlankDays = calendarMonthStart.getDay();
  const calendarSlots = Math.ceil((leadingBlankDays + daysInMonth) / 7) * 7;
  const calendarMonthKey = `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, "0")}`;
  const stateElections = (electionsList ?? [])
    .filter((election) => (user?.state ? statesMatch(inferElectionState(election), user.state) : true))
    .sort((a, b) => a.election_date.localeCompare(b.election_date));
  const currentMonthElections = stateElections
    .filter((election) => election.election_date?.startsWith(calendarMonthKey))
    .sort((a, b) => a.election_date.localeCompare(b.election_date));
  const nextElection = stateElections
    .filter((election) => !!parseIsoDate(election.election_date))
    .sort((a, b) => a.election_date.localeCompare(b.election_date))[0] ?? null;
  const nextElectionDate = parseIsoDate(nextElection?.election_date);
  const electionsByDay = currentMonthElections.reduce<Record<number, ElectionRecord[]>>((acc, election) => {
    const parsed = parseIsoDate(election.election_date);
    if (!parsed) return acc;
    const day = parsed.getDate();
    acc[day] = [...(acc[day] ?? []), election];
    return acc;
  }, {});
  const todayInCalendarMonth =
    currentDate.getFullYear() === calendarYear ? currentDate.getDate() : null;
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  /* ── user / form helpers ──────────────────────────────────────────── */

  function mapUserToForm(u: UserRecord): FormState {
    return {
      name: u.name ?? "", age_range: u.age_range ?? "", ethnicity: u.ethnicity ?? "",
      interests: u.interests ?? [], salary_range: u.salary_range ?? "",
      gender: u.gender ?? "", state: u.state ?? "", city: u.city ?? "",
      street_address: u.street_address ?? "",
      language_preference: u.language_preference ?? "en",
    };
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function toggleInterest(interest: string) {
    setForm((prev) => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter((i) => i !== interest)
        : [...prev.interests, interest],
    }));
  }

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      let updated: UserRecord;
      if (user) {
        updated = await users.update(user.id, form);
      } else {
        if (!form.state || !form.city) { setStatusMessage("City and state are required."); return; }
        updated = await users.create(form);
      }
      setUser(updated);
      setForm(mapUserToForm(updated));
      setStatusMessage("Profile saved successfully.");
      setBallotItems(null); setCandidatesList(null); setNotificationsList(null);
      void fetchLocationData(updated);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Error saving profile.");
    } finally {
      setSaving(false);
      setTimeout(() => setStatusMessage(""), 3500);
    }
  }

  /* ── detail openers (fetch enriched data from LLM) ────────────────── */

  async function openBallotDetail(item: BallotItem) {
    setSelectedBallot(item);
    if (!item.plain_summary) {
      try {
        const enriched = await ballots.summary(item.id, user?.id);
        setSelectedBallot(enriched);
        setBallotItems((prev) => prev?.map((b) => (b.id === enriched.id ? enriched : b)) ?? null);
      } catch { /* keep raw */ }
    }
  }

  async function openCandidateDetail(cand: CandidateRecord) {
    setSelectedCandidate(cand);
    if (!cand.bio_summary) {
      try {
        const enriched = await candidatesApi.profile(cand.id, user?.id);
        setSelectedCandidate(enriched);
        setCandidatesList((prev) => prev?.map((c) => (c.id === enriched.id ? enriched : c)) ?? null);
      } catch { /* keep raw */ }
    }
  }

  async function openLegislationDetail(bill: LegislationRecord) {
    setSelectedLegislation(bill);
    if (!bill.plain_summary) {
      try {
        const enriched = await legislationApi.summary(bill.id, user?.id);
        setSelectedLegislation(enriched);
        setLegislationList((prev) => prev?.map((l) => (l.id === enriched.id ? enriched : l)) ?? null);
      } catch { /* keep raw */ }
    }
  }

  async function openMeetingDetail(mtg: MeetingRecord) {
    setSelectedMeeting(mtg);
    if (!mtg.summary) {
      try {
        const enriched = await meetingsApi.summary(mtg.id, user?.id);
        setSelectedMeeting(enriched);
        setMeetingsList((prev) => prev?.map((m) => (m.id === enriched.id ? enriched : m)) ?? null);
      } catch { /* keep raw */ }
    }
  }

  /* ── notifications ────────────────────────────────────────────────── */

  async function handleCheckDeadlines() {
    if (!user) return;
    try {
      const result = await notificationsApi.checkDeadlines(user.id);
      setNotificationsList((prev) => [...(prev ?? []), ...result.notifications]);
      setStatusMessage(`${result.new_notifications} new reminder(s) created.`);
      setTimeout(() => setStatusMessage(""), 3500);
    } catch { /* ignore */ }
  }

  /* ── tab change helper (clear detail views) ─────────────────────── */

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setSelectedBallot(null);
    setSelectedCandidate(null);
    setSelectedLegislation(null);
    setSelectedMeeting(null);
  }

  /* ═════════════════════════════════════════════════════════════════ */
  /*                            RENDER                                */
  /* ═════════════════════════════════════════════════════════════════ */

  return (
    <div
      className="min-h-screen bg-[#FBFBFA] text-[#0F172A] selection:bg-slate-200"
      style={{ fontFamily: "Roboto, sans-serif" }}
    >
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#FBFBFA] shadow-2xl">
        <div className="px-6 pb-4 pt-8">
          <div className="mb-3">
            <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-600">
              Civic Dashboard
            </span>
          </div>
          <div className="mb-4">
            <div>
              <p className="text-sm font-medium text-slate-400">Civic access for everyone</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight" style={headingFontStyle}>
                BallotBridge
              </h1>
              <p className="mt-4 max-w-[28rem] text-base leading-relaxed text-slate-500">
                Understand your ballot in clear language, track election logistics, and move
                between overview, ballot prep, and AI guidance in one place.
              </p>
            </div>
          </div>


        </div>

        {/* ── MAIN CONTENT ────────────────────────────────────────── */}
        <div className="px-6 pb-24">

          {/* ════════════ HOME TAB ════════════ */}
          {activeTab === "home" && (
            <>
              <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Next election date</p>
                    <h3 className="mt-2 text-xl font-bold text-slate-900" style={headingFontStyle}>
                      {electionsList === null
                        ? "Loading election calendar"
                        : nextElection
                          ? nextElection.name
                          : "No election available"}
                    </h3>
                    <p className="mt-2 text-sm font-semibold text-slate-900">
                      {electionsList === null
                        ? "Loading election calendar"
                        : nextElectionDate
                          ? nextElectionDate.toLocaleDateString("en-US", {
                              weekday: "long",
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "No date available"}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {electionsList === null
                        ? "Fetching the upcoming election schedule."
                        : nextElection
                          ? formatElectionContext(nextElection) || "Upcoming election"
                          : user?.state
                            ? `No upcoming ${user.state} election could be loaded at this time.`
                            : "No upcoming election could be loaded at this time."}
                    </p>
                  </div>
                  <div className="rounded-[1.5rem] bg-slate-50 px-4 py-3 text-center">
                    {electionsList === null ? (
                      <div className="h-10 w-12 animate-pulse rounded-xl bg-slate-200" />
                    ) : nextElectionDate ? (
                      <>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                          {nextElectionDate.toLocaleDateString("en-US", { month: "short" })}
                        </p>
                        <p className="mt-1 text-3xl font-black text-slate-900">{nextElectionDate.getDate()}</p>
                      </>
                    ) : (
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">None</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Current month election calendar */}
              <div className="mt-5 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Upcoming elections in 2026</p>
                  {electionsList !== null && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {currentMonthElections.length} this month
                    </span>
                  )}
                </div>
                <div className="mt-4 rounded-[1.5rem] bg-slate-50 p-4">
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{calendarMonthLabel}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Today is{" "}
                        {currentDate.toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      {user?.state && (
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Showing {user.state} elections only
                        </p>
                      )}
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 shadow-sm">
                      {electionsList === null ? "Loading" : currentMonthElections.length > 0 ? "Election dates marked" : "No elections marked"}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-7 gap-2">
                    {weekdayLabels.map((label) => (
                      <div key={label} className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                        {label}
                      </div>
                    ))}
                    {Array.from({ length: calendarSlots }).map((_, index) => {
                      const dayNumber = index - leadingBlankDays + 1;
                      if (dayNumber < 1 || dayNumber > daysInMonth) {
                        return <div key={`blank-${index}`} className="aspect-square rounded-2xl bg-transparent" />;
                      }

                      const isToday = todayInCalendarMonth === dayNumber;
                      const dayElections = electionsByDay[dayNumber] ?? [];
                      const hasElection = dayElections.length > 0;
                      const cellClasses = hasElection
                        ? "border-slate-900 bg-slate-900 text-white"
                        : isToday
                          ? "border-slate-300 bg-white text-slate-900"
                          : "border-transparent bg-white text-slate-700";

                      return (
                        <div
                          key={dayNumber}
                          className={`flex aspect-square flex-col items-center justify-center rounded-2xl border text-center shadow-sm ${cellClasses}`}
                          title={
                            hasElection
                              ? dayElections
                                  .map((election) => {
                                    const context = formatElectionContext(election);
                                    return context ? `${election.name} · ${context}` : election.name;
                                  })
                                  .join("\n")
                              : undefined
                          }
                        >
                          <span className={`text-sm font-semibold ${hasElection ? "text-white" : "text-inherit"}`}>
                            {dayNumber}
                          </span>
                          {hasElection ? (
                            <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-200">
                              {dayElections.length === 1 ? "Vote" : `${dayElections.length}x`}
                            </span>
                          ) : isToday ? (
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-400" />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4">
                    {electionsList === null ? (
                      <Skeleton lines={2} />
                    ) : currentMonthElections.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        {user?.state
                          ? `No ${user.state} election dates were returned for this month.`
                          : "No election dates were returned for this month."}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-600">
                        {currentMonthElections
                          .map((election) => {
                            const parsed = parseIsoDate(election.election_date);
                            const dateLabel = parsed
                              ? parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                              : election.election_date;
                            const context = formatElectionContext(election);
                            return context
                              ? `${dateLabel}: ${election.name} · ${context}`
                              : `${dateLabel}: ${election.name}`;
                          })
                          .join(" • ")}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Polling Location card */}
              <div className="mt-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Your polling location</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Local</span>
                </div>

                {!hasLocation ? (
                  <div className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
                    <span className="text-base">⚠️</span>
                    <p className="text-sm text-amber-800">Set your city and state in your profile to find polling locations.</p>
                  </div>
                ) : !user?.street_address?.trim() ? (
                  <div className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
                    <span className="text-base">⚠️</span>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">Street address required</p>
                      <p className="mt-0.5 text-xs text-amber-700">
                        Add your street address in your profile to find your nearest polling place.
                      </p>
                    </div>
                  </div>
                ) : pollingLoading ? (
                  <div className="mt-3"><Skeleton lines={3} /></div>
                ) : pollingError ? (
                  <div className="mt-3 flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 ring-1 ring-red-200">
                    <span className="text-base">❌</span>
                    <p className="text-sm text-red-700">{pollingError}</p>
                  </div>
                ) : pollingList === null || pollingList.length === 0 ? (
                  <PlaceholderCard icon="📍" title="No polling locations found" subtitle="No polling data is available for your address yet. Check back closer to the election." />
                ) : (
                  <div className="mt-3 space-y-3">
                    {pollingList.map((loc, i) => (
                      <div key={i} className="rounded-[1.5rem] bg-slate-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{loc.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{loc.address}</p>
                            {loc.polling_hours && (
                              <p className="mt-1 text-xs text-slate-500 whitespace-pre-line">🕒 {loc.polling_hours}</p>
                            )}
                            {loc.notes && (
                              <p className="mt-1 text-xs text-slate-400 italic">{loc.notes}</p>
                            )}
                          </div>
                          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                            {loc.kind === "drop_off" ? "Drop-off" : loc.kind === "early_vote" ? "Early vote" : "Polls"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "profile" && (
            <div className="pt-6">
              {statusMessage && (
                <div className="mb-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">{statusMessage}</div>
              )}

              <form onSubmit={saveProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Name</span>
                    <input name="name" value={form.name} onChange={handleInputChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none" placeholder="Your name" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Location</span>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <input name="city" value={form.city} onChange={handleInputChange}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none" placeholder="City" />
                      <input name="state" value={form.state} onChange={handleInputChange}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none" placeholder="State" />
                    </div>
                    <input name="street_address" value={form.street_address} onChange={handleInputChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none" placeholder="Street address (e.g. 123 Main St) — improves ballot accuracy" />
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Age range</span>
                    <select name="age_range" value={form.age_range} onChange={handleInputChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none">
                      <option value="">Select age range</option>
                      {ageOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Salary range</span>
                    <select name="salary_range" value={form.salary_range} onChange={handleInputChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none">
                      <option value="">Select salary range</option>
                      {salaryOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Gender</span>
                    <select name="gender" value={form.gender} onChange={handleInputChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none">
                      <option value="">Select gender</option>
                      {genderOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Ethnicity</span>
                    <select name="ethnicity" value={form.ethnicity} onChange={handleInputChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none">
                      <option value="">Select ethnicity</option>
                      {ethnicityOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                </div>

                <div>
                  <span className="text-sm font-semibold text-slate-700">Interests</span>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {interestOptions.map((interest) => {
                      const active = form.interests.includes(interest);
                      return (
                        <button key={interest} type="button" onClick={() => toggleInterest(interest)}
                          className={`rounded-2xl px-3 py-1.5 text-xs font-medium transition ${active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                          {interest}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button type="submit" disabled={saving} className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50">
                  {saving ? "Saving…" : "Save profile"}
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
          <nav className="pointer-events-auto mx-auto max-w-md border-t border-slate-100 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-[4.5rem] max-w-md items-center justify-around">
          <button
            type="button"
            onClick={onOpenHome}
            className="flex flex-col items-center gap-1 px-4 py-2 text-xs font-semibold text-[#0F172A]"
          >
            <span className="text-xl sm:text-2xl">⌂</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em]">Home</span>
          </button>
          <button
            type="button"
            onClick={onOpenExplore}
            className="flex flex-col items-center gap-1 px-4 py-2 text-slate-400 transition-colors hover:text-slate-600"
          >
            <span className="text-xl sm:text-2xl">⌕</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em]">Explore</span>
          </button>
          <button
            type="button"
            onClick={onOpenBallot}
            className="flex flex-col items-center gap-1 px-4 py-2 text-slate-400 transition-colors hover:text-slate-600"
          >
            <span className="text-xl sm:text-2xl">☑</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em]">Ballot</span>
          </button>
          <button
            type="button"
            onClick={onOpenCongress}
            className="flex flex-col items-center gap-1 px-4 py-2 text-slate-400 transition-colors hover:text-slate-600"
          >
            <span className="text-xl sm:text-2xl">⚖</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em]">Congress</span>
          </button>
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex flex-col items-center gap-1 px-4 py-2 text-slate-400 transition-colors hover:text-slate-600"
          >
            <span className="text-xl sm:text-2xl">◉</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em]">Profile</span>
          </button>
        </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
