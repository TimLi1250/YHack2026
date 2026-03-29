import { useEffect, useState, useCallback, type ChangeEvent, type FormEvent } from "react";
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

/* ─── form types ───────────────────────────────────────────────────── */

const defaultFormState = {
  name: "", age_range: "", ethnicity: "", interests: [] as string[],
  salary_range: "", gender: "", state: "", city: "", street_address: "", language_preference: "en",
};
type Tab = "home" | "explore" | "ballot" | "profile";
type FormState = typeof defaultFormState;

type VotingAssistantHomepageProps = {
  onOpenProfile: () => void;
  onOpenExplore: () => void;
  onOpenBallot: () => void;
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

/* ═══════════════════════════════════════════════════════════════════ */
/*                        MAIN COMPONENT                              */
/* ═══════════════════════════════════════════════════════════════════ */

export default function VotingAssistantHomepage({
  onOpenProfile,
  onOpenExplore,
  onOpenBallot,
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

  const features = [
    { title: "Explain My Ballot", desc: "Get plain-language summaries of races and ballot measures.", icon: "🗳️" },
    { title: "Voting Info Near Me", desc: "Find registration help, deadlines, polling places, and ID requirements.", icon: "📍" },
    { title: "Community Impact", desc: "See how an issue could affect students, renters, families, and seniors.", icon: "🌍" },
  ];

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
        <div className="px-6 pb-8 pt-8">
          <div className="mb-4 flex items-center justify-between">
            <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-600">
              Civic Dashboard
            </span>
            <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Nonpartisan
            </div>
          </div>
          <div className="mb-6">
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

          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Welcome back</p>
            <h2 className="mt-2 text-2xl font-bold leading-tight text-slate-900" style={headingFontStyle}>
              Start with what matters most right now.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Open the ballot hub for logistics, or jump into Explore when you want quick AI help.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onOpenExplore}
                className="rounded-[1.5rem] bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open Explore
              </button>
              <button
                type="button"
                onClick={onOpenBallot}
                className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Open Ballot
              </button>
            </div>
          </div>
        </div>

        {/* ── MAIN CONTENT ────────────────────────────────────────── */}
        <div className="px-6 pb-24">

          {/* ════════════ HOME TAB ════════════ */}
          {activeTab === "home" && (
            <>
              {/* Election check-in card */}
              <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Your election check-in</p>
                    <h3 className="mt-2 text-xl font-bold text-slate-900" style={headingFontStyle}>Stay ready for the next election</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {hasLocation
                        ? "Track important dates, upcoming reminders, and what to do next."
                        : "Set your city and state in your profile to see upcoming dates."}
                    </p>
                  </div>
                  {notificationsList !== null && (
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {notificationsList.length} upcoming
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {!hasLocation ? (
                    <PlaceholderCard icon="📍" title="Location needed" subtitle="Add your city and state in Profile to see elections and deadlines." />
                  ) : notificationsList === null ? (
                    <Skeleton lines={3} />
                  ) : notificationsList.length === 0 ? (
                    <PlaceholderCard icon="🔔" title="No reminders yet" subtitle="Tap &quot;Check deadlines&quot; to generate reminders." />
                  ) : (
                    notificationsList.slice(0, 5).map((n) => (
                      <div key={n.id} className="flex items-start justify-between gap-4 rounded-[1.5rem] bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{formatNotifType(n.notification_type)}</p>
                          <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                        </div>
                        {n.scheduled_for && (
                          <div className="shrink-0 rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm">
                            {formatDate(n.scheduled_for)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {hasLocation && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button onClick={handleCheckDeadlines} className="rounded-[1.5rem] bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                      Check deadlines
                    </button>
                    <button onClick={onOpenBallot} className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                      View ballot
                    </button>
                  </div>
                )}
              </div>

              {/* Quick stats */}
              <div className="mt-6 grid grid-cols-3 gap-3">
                <QuickStat label="Ballot items" value={ballotItems === null ? "—" : String(ballotItems.length)} loading={ballotItems === null && hasLocation} />
                <QuickStat label="Candidates" value={candidatesList === null ? "—" : String(candidatesList.length)} loading={candidatesList === null && hasLocation} />
                <QuickStat label="Bills tracked" value={legislationList === null ? "—" : String(legislationList.length)} loading={legislationList === null} />
              </div>

              {/* Upcoming 2026 Elections */}
              <div className="mt-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Upcoming elections in 2026</p>
                  {electionsList !== null && (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {electionsList.length} election{electionsList.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-2">
                  {electionsList === null ? (
                    <Skeleton lines={4} />
                  ) : electionsList.length === 0 ? (
                    <PlaceholderCard icon="🗓️" title="No elections found" subtitle="No upcoming 2026 elections could be loaded at this time." />
                  ) : (
                    electionsList.map((election) => (
                      <div key={election.id} className="flex items-start gap-3 rounded-[1.5rem] bg-slate-50 px-4 py-3">
                        <span className="text-xl">🗓️</span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-900">{election.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {election.election_date
                              ? new Date(election.election_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "long", day: "numeric", year: "numeric" })
                              : "Date TBD"}
                            {" · "}{election.level}{election.election_type ? ` · ${election.election_type}` : ""}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Impact mode CTA */}
              <div className="mt-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Impact mode</p>
                <h4 className="mt-2 text-xl font-bold text-slate-900" style={headingFontStyle}>Explore what matters to your community</h4>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  View ballot measures through lenses like students, renters, families, and public transit users.
                </p>
                <button
                  type="button"
                  onClick={onOpenExplore}
                  className="mt-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Ask in Explore
                </button>
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

        <div className="px-6 pb-24 pt-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold" style={headingFontStyle}>How we help</h3>
              <p className="text-sm text-slate-500">Designed for first-time and underserved voters</p>
            </div>
            <button
              type="button"
              onClick={onOpenExplore}
              className="text-sm font-semibold text-blue-600"
            >
              See all
            </button>
          </div>

          <div className="space-y-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-2xl">
                    {feature.icon}
                  </div>
                  <div>
                    <h4 className="text-base font-semibold" style={headingFontStyle}>
                      {feature.title}
                    </h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Impact mode</p>
                <h4 className="mt-1 text-lg font-semibold text-slate-900" style={headingFontStyle}>
                  Explore what matters to your community
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  View ballot measures through lenses like students, renters, families, and public
                  transit users.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                New
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenExplore}
              className="mt-4 rounded-[1.5rem] bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Ask about your ballot
            </button>
          </div>
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
