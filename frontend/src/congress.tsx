import { useEffect, useState } from "react";
import {
  legislation as legislationApi,
  meetings as meetingsApi,
  type LegislationRecord,
  type MeetingRecord,
} from "./api";
import type { UserProfile } from "./profile";

const headingFontStyle = {
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

type CongressPageProps = {
  profile: UserProfile;
  onOpenProfile: () => void;
  onOpenExplore: () => void;
  onOpenBallot: () => void;
  onOpenCongress: () => void;
  onOpenHome: () => void;
};

/* ── Bill card ─────────────────────────────────────────────────── */

function BillCard({ bill }: { bill: LegislationRecord }) {
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState(bill.plain_summary ?? null);
  const [effectOnUser, setEffectOnUser] = useState(bill.effect_on_user ?? null);
  const [effectsOnGroups, setEffectsOnGroups] = useState(bill.effects_on_groups ?? []);
  const [tags, setTags] = useState<string[]>(bill.tags ?? []);
  const [loading, setLoading] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [error, setError] = useState("");

  // Fetch tags on mount if not cached
  useEffect(() => {
    if (tags.length > 0) return;
    let cancelled = false;
    setLoadingTags(true);
    legislationApi
      .tags(bill.id)
      .then((res) => {
        if (!cancelled) setTags(res.tags);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingTags(false);
      });
    return () => { cancelled = true; };
  }, [bill.id, tags.length]);

  async function handleSummarize() {
    setLoading(true);
    setError("");
    try {
      const result = await legislationApi.summary(bill.id);
      setSummary(result.plain_summary ?? null);
      setEffectOnUser(result.effect_on_user ?? null);
      setEffectsOnGroups(result.effects_on_groups ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setError("Backend appears offline. Start the server and try again.");
      } else if (msg.includes("404")) {
        setError("Bill not found in backend.");
      } else {
        setError(`Could not generate summary: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }

  const chamberColor = bill.chamber === "Senate" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700";

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-base font-semibold text-slate-900" style={headingFontStyle}>
            {bill.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {bill.bill_number && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {bill.bill_number.toUpperCase()}
              </span>
            )}
            {bill.chamber && (
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${chamberColor}`}>
                {bill.chamber}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Status */}
      {bill.status && (
        <p className="mt-3 text-sm text-slate-500 italic">
          {bill.status}
        </p>
      )}

      {/* Tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {loadingTags && <span className="text-xs text-slate-400">Loading tags…</span>}
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-600"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* AI summary */}
      {!summary && !expanded && (
        <button
          type="button"
          onClick={() => { setExpanded(true); handleSummarize(); }}
          className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-500 transition"
        >
          Explain this bill →
        </button>
      )}

      {expanded && (
        <div className="mt-4 space-y-3">
          {loading && <p className="text-sm text-slate-400 animate-pulse">Generating summary…</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}

          {summary && (
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Plain-language summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
            </div>
          )}

          {effectOnUser && (
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-amber-600 mb-1">How this could affect you</p>
              <p className="text-sm text-slate-700 leading-relaxed">{effectOnUser}</p>
            </div>
          )}

          {effectsOnGroups.length > 0 && (
            <div className="rounded-xl bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-600 mb-1">Who it affects</p>
              <ul className="space-y-1.5">
                {effectsOnGroups.map((g, i) => (
                  <li key={i} className="text-sm text-slate-700">
                    <span className="font-semibold">{g.group}:</span> {g.effect}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Source link */}
      {bill.source_url && (
        <a
          href={bill.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs text-slate-400 hover:text-slate-600 transition"
        >
          View on Congress.gov ↗
        </a>
      )}
    </div>
  );
}

/* ── Meeting / hearing card ─────────────────────────────────── */

function HearingCard({ meeting }: { meeting: MeetingRecord }) {
  const [expanded, setExpanded] = useState(false);
  const [summary, setSummary] = useState(meeting.summary ?? null);
  const [tags, setTags] = useState<string[]>(meeting.tags ?? []);
  const [loading, setLoading] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (tags.length > 0) return;
    let cancelled = false;
    setLoadingTags(true);
    meetingsApi
      .tags(meeting.id)
      .then((res) => {
        if (!cancelled) setTags(res.tags);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingTags(false);
      });
    return () => { cancelled = true; };
  }, [meeting.id, tags.length]);

  async function handleSummarize() {
    setLoading(true);
    setError("");
    try {
      const result = await meetingsApi.summary(meeting.id);
      setSummary(result.summary ?? null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        setError("Backend appears offline. Start the server and try again.");
      } else {
        setError(`Could not generate summary: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  }

  const chamberColor = meeting.chamber === "Senate" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700";

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-base font-semibold text-slate-900 flex-1" style={headingFontStyle}>
          {meeting.title}
        </p>
        {meeting.chamber && (
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${chamberColor}`}>
            {meeting.chamber}
          </span>
        )}
      </div>

      {meeting.committee && (
        <p className="mt-1 text-sm text-slate-500">{meeting.committee}</p>
      )}
      {meeting.date && (
        <p className="mt-0.5 text-xs text-slate-400">{meeting.date}</p>
      )}

      {/* Tags */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {loadingTags && <span className="text-xs text-slate-400">Loading tags…</span>}
        {tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-teal-600"
          >
            {tag}
          </span>
        ))}
      </div>

      {/* AI summary */}
      {!summary && !expanded && (
        <button
          type="button"
          onClick={() => { setExpanded(true); handleSummarize(); }}
          className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-500 transition"
        >
          Summarize this hearing →
        </button>
      )}

      {expanded && (
        <div className="mt-4 space-y-3">
          {loading && <p className="text-sm text-slate-400 animate-pulse">Generating summary…</p>}
          {error && <p className="text-sm text-red-500">{error}</p>}
          {summary && (
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-1">Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{summary}</p>
            </div>
          )}
        </div>
      )}

      {meeting.sources?.[0]?.url && (
        <a
          href={meeting.sources[0].url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-xs text-slate-400 hover:text-slate-600 transition"
        >
          View on Congress.gov ↗
        </a>
      )}
    </div>
  );
}

/* ── Congress page ────────────────────────────────────────────── */

type Tab = "bills" | "hearings";

export default function CongressPage({
  profile: _profile,
  onOpenProfile,
  onOpenExplore,
  onOpenBallot,
  onOpenCongress: _onOpenCongress,
  onOpenHome,
}: CongressPageProps) {
  const [tab, setTab] = useState<Tab>("bills");
  const [bills, setBills] = useState<LegislationRecord[]>([]);
  const [hearings, setHearings] = useState<MeetingRecord[]>([]);
  const [loadingBills, setLoadingBills] = useState(true);
  const [loadingHearings, setLoadingHearings] = useState(true);
  const [chamberFilter, setChamberFilter] = useState<"all" | "House" | "Senate">("all");

  useEffect(() => {
    legislationApi
      .search()
      .then(setBills)
      .catch(() => {})
      .finally(() => setLoadingBills(false));

    meetingsApi
      .congressional()
      .then(setHearings)
      .catch(() => {})
      .finally(() => setLoadingHearings(false));
  }, []);

  const filteredBills = chamberFilter === "all" ? bills : bills.filter((b) => b.chamber === chamberFilter);
  const filteredHearings = chamberFilter === "all" ? hearings : hearings.filter((h) => h.chamber === chamberFilter);

  return (
    <div
      className="min-h-screen bg-[#FBFBFA] text-[#0F172A] selection:bg-slate-200"
      style={{ fontFamily: "Roboto, sans-serif" }}
    >
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#FBFBFA] shadow-2xl">
        <main className="flex-1 px-6 pb-28 pt-8">
          <div className="mb-6 flex justify-end">
            <button
              type="button"
              onClick={onOpenHome}
              className="group flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-slate-900"
            >
              <span className="text-base transition-transform group-hover:-translate-x-1">←</span>
              <span>Back</span>
            </button>
          </div>

          <div className="mb-8">
            <span className="mb-4 inline-block rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-600">
              Congress Tracker
            </span>
            <h1 className="text-4xl font-black tracking-tight text-slate-900" style={headingFontStyle}>
              Congress
            </h1>
            <p className="mt-4 max-w-[28rem] text-base leading-relaxed text-slate-500">
              Follow bills and hearings from Congress.gov in the same simple, readable format as the rest of the app.
            </p>
          </div>

          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTab("bills")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                  tab === "bills" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                Bills
              </button>
              <button
                type="button"
                onClick={() => setTab("hearings")}
                className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                  tab === "hearings" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                Hearings
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(["all", "House", "Senate"] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setChamberFilter(c)}
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                    chamberFilter === c
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                  }`}
                >
                  {c === "all" ? "All" : c}
                </button>
              ))}
            </div>
          </section>

          <div className="mt-6 space-y-4">
          {tab === "bills" && (
            <>
              {loadingBills && <p className="text-sm text-slate-400 animate-pulse">Loading bills…</p>}
              {!loadingBills && filteredBills.length === 0 && (
                <p className="text-sm text-slate-400">No bills found.</p>
              )}
              {filteredBills.map((bill) => (
                <BillCard key={bill.id} bill={bill} />
              ))}
            </>
          )}

          {tab === "hearings" && (
            <>
              {loadingHearings && <p className="text-sm text-slate-400 animate-pulse">Loading hearings…</p>}
              {!loadingHearings && filteredHearings.length === 0 && (
                <p className="text-sm text-slate-400">No hearings found.</p>
              )}
              {filteredHearings.map((hearing) => (
                <HearingCard key={hearing.id} meeting={hearing} />
              ))}
            </>
          )}
          </div>
        </main>

        {/* Nav bar */}
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
          <nav className="pointer-events-auto mx-auto max-w-md border-t border-slate-100 bg-white/95 backdrop-blur">
            <div className="mx-auto flex h-[4.5rem] max-w-md items-center justify-around">
              <button
                type="button"
                onClick={onOpenHome}
                className="flex flex-col items-center gap-1 px-4 py-2 text-slate-400 transition-colors hover:text-slate-600"
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
                className="flex flex-col items-center gap-1 px-4 py-2 text-[#0F172A]"
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
