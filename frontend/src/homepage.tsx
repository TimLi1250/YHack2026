import { useEffect, useState, useCallback, type ChangeEvent, type FormEvent } from "react";
import {
  users,
  ballots,
  candidates as candidatesApi,
  legislation as legislationApi,
  meetings as meetingsApi,
  notifications as notificationsApi,
  type UserRecord,
  type BallotItem,
  type CandidateRecord,
  type LegislationRecord,
  type MeetingRecord,
  type NotificationRecord,
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

/* ─── form types ───────────────────────────────────────────────────── */

const defaultFormState = {
  name: "", age_range: "", ethnicity: "", interests: [] as string[],
  salary_range: "", gender: "", state: "", city: "", language_preference: "en",
};
type FormState = typeof defaultFormState;
type Tab = "home" | "explore" | "ballot" | "profile";

/* ─── small reusable components ────────────────────────────────────── */

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
    <div className="rounded-2xl bg-slate-50 p-3 text-center">
      {loading ? (
        <div className="mx-auto h-6 w-8 animate-pulse rounded bg-slate-200" />
      ) : (
        <p className="text-xl font-bold text-blue-600">{value}</p>
      )}
      <p className="mt-1 text-xs text-slate-500">{label}</p>
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

export default function VotingAssistantHomepage() {
  /* ── UI state ─────────────────────────────────────────────────────── */
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [user, setUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<FormState>(defaultFormState);
  const [statusMessage, setStatusMessage] = useState("");
  const [saving, setSaving] = useState(false);

  /* ── data from backend (null = not loaded yet) ────────────────────── */
  const [ballotItems, setBallotItems] = useState<BallotItem[] | null>(null);
  const [candidatesList, setCandidatesList] = useState<CandidateRecord[] | null>(null);
  const [legislationList, setLegislationList] = useState<LegislationRecord[] | null>(null);
  const [meetingsList, setMeetingsList] = useState<MeetingRecord[] | null>(null);
  const [notificationsList, setNotificationsList] = useState<NotificationRecord[] | null>(null);

  /* ── detail-view state ────────────────────────────────────────────── */
  const [selectedBallot, setSelectedBallot] = useState<BallotItem | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRecord | null>(null);
  const [selectedLegislation, setSelectedLegislation] = useState<LegislationRecord | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null);

  const hasLocation = !!(user?.state && user?.city);

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
      ballots.upcoming(u.state, u.city),
      candidatesApi.list({ state: u.state, city: u.city }),
      notificationsApi.forUser(u.id),
    ]);
    setBallotItems(b.status === "fulfilled" ? b.value : []);
    setCandidatesList(c.status === "fulfilled" ? c.value : []);
    setNotificationsList(n.status === "fulfilled" ? n.value : []);
  }, []);

  const fetchGlobalData = useCallback(async () => {
    const [l, m] = await Promise.allSettled([
      legislationApi.search(),
      meetingsApi.congressional(),
    ]);
    setLegislationList(l.status === "fulfilled" ? l.value : []);
    setMeetingsList(m.status === "fulfilled" ? m.value : []);
  }, []);

  useEffect(() => {
    if (user && hasLocation) void fetchLocationData(user);
  }, [user?.id, hasLocation, fetchLocationData]);

  useEffect(() => { void fetchGlobalData(); }, [fetchGlobalData]);

  /* ── user / form helpers ──────────────────────────────────────────── */

  function mapUserToForm(u: UserRecord): FormState {
    return {
      name: u.name ?? "", age_range: u.age_range ?? "", ethnicity: u.ethnicity ?? "",
      interests: u.interests ?? [], salary_range: u.salary_range ?? "",
      gender: u.gender ?? "", state: u.state ?? "", city: u.city ?? "",
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
      // re-fetch location data
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white shadow-2xl">

        {/* ── HEADER ──────────────────────────────────────────────── */}
        <div className="bg-gradient-to-b from-blue-700 via-blue-600 to-cyan-500 px-6 pb-8 pt-8 text-white">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Civic access for everyone</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">BallotBridge</h1>
            </div>
            <div className="rounded-2xl bg-white/15 px-3 py-2 text-sm font-medium backdrop-blur">Nonpartisan</div>
          </div>
          <div className="rounded-3xl bg-white/12 p-5 backdrop-blur">
            <p className="text-sm font-medium text-blue-100">
              {user ? `Welcome back${user.name ? `, ${user.name}` : ""}` : "Welcome"}
            </p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight">
              {activeTab === "profile" ? "Manage your profile data."
                : activeTab === "ballot" ? "Your upcoming ballot."
                : activeTab === "explore" ? "Explore legislation & meetings."
                : "Understand your ballot in clear, simple language."}
            </h2>
            <p className="mt-3 text-sm leading-6 text-blue-50">
              {activeTab === "profile"
                ? "Update your name, location, interests, and voting preferences."
                : activeTab === "ballot"
                  ? hasLocation ? `Showing races and measures for ${user?.city}, ${user?.state}.`
                    : "Set your location in your profile to see your ballot."
                : activeTab === "explore"
                  ? "Browse recent legislation and congressional meetings."
                  : "Get trusted voting information and community-focused explanations."}
            </p>
          </div>
        </div>

        {/* ── MAIN CONTENT ────────────────────────────────────────── */}
        <div className="-mt-4 px-6 pb-24">

          {/* ════════════ HOME TAB ════════════ */}
          {activeTab === "home" && (
            <>
              {/* Election check-in card */}
              <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Your election check-in</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">Stay ready for the next election</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {hasLocation
                        ? "Track important dates, upcoming reminders, and what to do next."
                        : "Set your city and state in your profile to see upcoming dates."}
                    </p>
                  </div>
                  {notificationsList !== null && (
                    <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
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
                      <div key={n.id} className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{formatNotifType(n.notification_type)}</p>
                          <p className="mt-1 text-sm text-slate-600">{n.message}</p>
                        </div>
                        {n.scheduled_for && (
                          <div className="shrink-0 rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm">
                            {formatDate(n.scheduled_for)}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {hasLocation && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button onClick={handleCheckDeadlines} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700">
                      Check deadlines
                    </button>
                    <button onClick={() => switchTab("ballot")} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
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

              {/* Impact mode CTA */}
              <div className="mt-6 rounded-3xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
                <p className="text-sm font-semibold text-emerald-700">Impact mode</p>
                <h4 className="mt-1 text-lg font-semibold text-slate-900">Explore what matters to your community</h4>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  View ballot measures through lenses like students, renters, families, and public transit users.
                </p>
                <button onClick={() => switchTab("explore")} className="mt-4 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700">
                  Explore legislation &amp; meetings
                </button>
              </div>
            </>
          )}

          {/* ════════════ BALLOT TAB ════════════ */}
          {activeTab === "ballot" && (
            <div className="space-y-4">
              {/* ── ballot detail view ── */}
              {selectedBallot ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
                  <button onClick={() => setSelectedBallot(null)} className="mb-3 text-sm font-semibold text-blue-600 hover:underline">← Back to ballot</button>
                  <div className="flex items-start gap-2">
                    <span className="text-2xl">{selectedBallot.normalized_type === "office" ? "🏛️" : "📜"}</span>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{selectedBallot.title}</h3>
                      <p className="mt-1 text-xs text-slate-500">{selectedBallot.election_type} · {selectedBallot.election_level} · {selectedBallot.normalized_type}</p>
                    </div>
                  </div>
                  {selectedBallot.plain_summary ? (
                    <div className="mt-4 space-y-3">
                      <Section title="Plain-language summary" text={selectedBallot.plain_summary} />
                      {selectedBallot.yes_means && <Section title="A YES vote means" text={selectedBallot.yes_means} />}
                      {selectedBallot.no_means && <Section title="A NO vote means" text={selectedBallot.no_means} />}
                      {selectedBallot.effect_on_user && <Section title="How this may affect you" text={selectedBallot.effect_on_user} />}
                      {selectedBallot.effects_on_groups?.length ? (
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Community impact</p>
                          {selectedBallot.effects_on_groups.map((g, i) => (
                            <p key={i} className="mt-1 text-sm text-slate-600"><span className="font-medium">{g.group}:</span> {g.effect}</p>
                          ))}
                        </div>
                      ) : null}
                      <SourcesList sources={selectedBallot.sources} />
                    </div>
                  ) : (
                    <div className="mt-4"><Skeleton lines={5} /><p className="mt-2 text-xs text-slate-400">Generating plain-language summary…</p></div>
                  )}
                </div>

              ) : selectedCandidate ? (
                /* ── candidate detail view ── */
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
                  <button onClick={() => setSelectedCandidate(null)} className="mb-3 text-sm font-semibold text-blue-600 hover:underline">← Back to ballot</button>
                  <h3 className="text-lg font-semibold text-slate-900">{selectedCandidate.name}</h3>
                  <p className="text-sm text-slate-500">{selectedCandidate.office} · {selectedCandidate.party ?? "No party listed"}</p>
                  {selectedCandidate.bio_summary ? (
                    <div className="mt-4 space-y-3">
                      <Section title="About" text={selectedCandidate.bio_summary} />
                      {selectedCandidate.positions && Object.keys(selectedCandidate.positions).length > 0 && (
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Positions</p>
                          {Object.entries(selectedCandidate.positions).map(([topic, pos]) => (
                            <p key={topic} className="mt-1 text-sm text-slate-600"><span className="font-medium capitalize">{topic}:</span> {pos}</p>
                          ))}
                        </div>
                      )}
                      {selectedCandidate.work_history_summary && <Section title="Experience" text={selectedCandidate.work_history_summary} />}
                      {selectedCandidate.controversy_summary && <Section title="Controversies" text={selectedCandidate.controversy_summary} />}
                      {selectedCandidate.user_effect_summary && <Section title="How this may affect you" text={selectedCandidate.user_effect_summary} />}
                      {selectedCandidate.group_effects?.length ? (
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Community impact</p>
                          {selectedCandidate.group_effects.map((g, i) => (
                            <p key={i} className="mt-1 text-sm text-slate-600"><span className="font-medium">{g.group}:</span> {g.effect}</p>
                          ))}
                        </div>
                      ) : null}
                      <SourcesList sources={selectedCandidate.sources} />
                    </div>
                  ) : (
                    <div className="mt-4"><Skeleton lines={5} /><p className="mt-2 text-xs text-slate-400">Building candidate profile…</p></div>
                  )}
                </div>

              ) : (
                /* ── list views (ballot items + candidates) ── */
                <>
                  {/* Ballot items */}
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ballot measures &amp; races</p>
                    <div className="mt-3 space-y-2">
                      {!hasLocation ? (
                        <PlaceholderCard icon="📍" title="Location needed" subtitle="Add your city and state in Profile to load your ballot." />
                      ) : ballotItems === null ? (
                        <Skeleton lines={4} />
                      ) : ballotItems.length === 0 ? (
                        <PlaceholderCard icon="🗳️" title="No ballot items found" subtitle="No upcoming ballot items were found for your area." />
                      ) : (
                        ballotItems.map((item) => (
                          <button key={item.id} onClick={() => openBallotDetail(item)} className="flex w-full items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100">
                            <span className="text-xl">{item.normalized_type === "office" ? "🏛️" : "📜"}</span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{item.election_type} · {item.election_level} · {item.normalized_type}</p>
                              {item.one_sentence && <p className="mt-1 text-xs text-slate-600">{item.one_sentence}</p>}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Candidates */}
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Candidates</p>
                    <div className="mt-3 space-y-2">
                      {!hasLocation ? (
                        <PlaceholderCard icon="📍" title="Location needed" subtitle="Add your city and state in Profile to see candidates." />
                      ) : candidatesList === null ? (
                        <Skeleton lines={4} />
                      ) : candidatesList.length === 0 ? (
                        <PlaceholderCard icon="👤" title="No candidates found" subtitle="No candidate data found for your area yet." />
                      ) : (
                        candidatesList.map((cand) => (
                          <button key={cand.id} onClick={() => openCandidateDetail(cand)} className="flex w-full items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100">
                            <span className="text-xl">👤</span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900">{cand.name}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{cand.office} · {cand.party ?? "No party"}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════════════ EXPLORE TAB ════════════ */}
          {activeTab === "explore" && (
            <div className="space-y-4">
              {selectedLegislation ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
                  <button onClick={() => setSelectedLegislation(null)} className="mb-3 text-sm font-semibold text-blue-600 hover:underline">← Back</button>
                  <h3 className="text-lg font-semibold text-slate-900">{selectedLegislation.title}</h3>
                  <p className="text-xs text-slate-500">{selectedLegislation.bill_number} · {selectedLegislation.chamber} · {selectedLegislation.status}</p>
                  {selectedLegislation.plain_summary ? (
                    <div className="mt-4 space-y-3">
                      <Section title="Summary" text={selectedLegislation.plain_summary} />
                      {selectedLegislation.vernacular_summary && <Section title="In simple terms" text={selectedLegislation.vernacular_summary} />}
                      {selectedLegislation.effect_on_user && <Section title="How this may affect you" text={selectedLegislation.effect_on_user} />}
                      {selectedLegislation.effects_on_groups?.length ? (
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Community impact</p>
                          {selectedLegislation.effects_on_groups.map((g, i) => (
                            <p key={i} className="mt-1 text-sm text-slate-600"><span className="font-medium">{g.group}:</span> {g.effect}</p>
                          ))}
                        </div>
                      ) : null}
                      {selectedLegislation.uncertainties?.length ? (
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Uncertainties</p>
                          <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">
                            {selectedLegislation.uncertainties.map((u, i) => <li key={i}>{u}</li>)}
                          </ul>
                        </div>
                      ) : null}
                      <SourcesList sources={selectedLegislation.sources} />
                    </div>
                  ) : (
                    <div className="mt-4"><Skeleton lines={5} /><p className="mt-2 text-xs text-slate-400">Summarizing legislation…</p></div>
                  )}
                </div>

              ) : selectedMeeting ? (
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
                  <button onClick={() => setSelectedMeeting(null)} className="mb-3 text-sm font-semibold text-blue-600 hover:underline">← Back</button>
                  <h3 className="text-lg font-semibold text-slate-900">{selectedMeeting.title}</h3>
                  <p className="text-xs text-slate-500">{selectedMeeting.chamber} · {selectedMeeting.committee} · {selectedMeeting.date}</p>
                  {selectedMeeting.summary ? (
                    <div className="mt-4 space-y-3">
                      <Section title="Summary" text={selectedMeeting.summary} />
                      {selectedMeeting.vernacular_summary && <Section title="In simple terms" text={selectedMeeting.vernacular_summary} />}
                      {selectedMeeting.effect_on_user && <Section title="How this may affect you" text={selectedMeeting.effect_on_user} />}
                      {selectedMeeting.effects_on_groups?.length ? (
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Community impact</p>
                          {selectedMeeting.effects_on_groups.map((g, i) => (
                            <p key={i} className="mt-1 text-sm text-slate-600"><span className="font-medium">{g.group}:</span> {g.effect}</p>
                          ))}
                        </div>
                      ) : null}
                      <SourcesList sources={selectedMeeting.sources} />
                    </div>
                  ) : (
                    <div className="mt-4"><Skeleton lines={5} /><p className="mt-2 text-xs text-slate-400">Summarizing meeting…</p></div>
                  )}
                </div>

              ) : (
                <>
                  {/* Legislation list */}
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Recent legislation</p>
                    <div className="mt-3 space-y-2">
                      {legislationList === null ? (
                        <Skeleton lines={4} />
                      ) : legislationList.length === 0 ? (
                        <PlaceholderCard icon="📑" title="No legislation loaded" subtitle="Legislation will appear here once fetched from Congress.gov." />
                      ) : (
                        legislationList.slice(0, 10).map((bill) => (
                          <button key={bill.id} onClick={() => openLegislationDetail(bill)} className="flex w-full items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100">
                            <span className="text-xl">📑</span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900">{bill.title}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{bill.bill_number} · {bill.status ?? "Status unknown"}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Meetings list */}
                  <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Congressional meetings</p>
                    <div className="mt-3 space-y-2">
                      {meetingsList === null ? (
                        <Skeleton lines={4} />
                      ) : meetingsList.length === 0 ? (
                        <PlaceholderCard icon="🏛️" title="No meetings loaded" subtitle="Congressional hearings will appear here once fetched." />
                      ) : (
                        meetingsList.slice(0, 10).map((mtg) => (
                          <button key={mtg.id} onClick={() => openMeetingDetail(mtg)} className="flex w-full items-start gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100">
                            <span className="text-xl">🏛️</span>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-900">{mtg.title}</p>
                              <p className="mt-0.5 text-xs text-slate-500">{mtg.chamber} · {mtg.committee ?? ""} · {mtg.date ?? ""}</p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ════════════ PROFILE TAB ════════════ */}
          {activeTab === "profile" && (
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Profile settings</p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">Edit your personal data</h3>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                  {user ? "Saved" : "New"}
                </div>
              </div>

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

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Language preference</span>
                  <input name="language_preference" value={form.language_preference} onChange={handleInputChange}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none" placeholder="en" />
                </label>

                <button type="submit" disabled={saving}
                  className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? "Saving…" : user ? "Save Profile" : "Create Profile"}
                </button>
              </form>

              {user?.derived_traits?.length ? (
                <div className="mt-6 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">Current profile traits</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {user.derived_traits.map((trait) => <li key={trait}>{trait}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* ── BOTTOM NAV ──────────────────────────────────────────── */}
        <div className="fixed bottom-0 mx-auto flex w-full max-w-md items-center justify-around border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          {(["home", "explore", "ballot", "profile"] as Tab[]).map((tab) => (
            <button key={tab} onClick={() => switchTab(tab)}
              className={`flex flex-col items-center gap-1 text-xs font-semibold ${activeTab === tab ? "text-blue-600" : "text-slate-500"}`}>
              <span className="text-lg">{tabIcon(tab)}</span>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
