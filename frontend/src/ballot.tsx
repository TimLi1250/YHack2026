import { useEffect, useState } from "react";
import { ballots as ballotsApi, pollingLocations as pollingApi, type BallotItem, type PollingLocation } from "./api";
import type { UserProfile } from "./profile";

const headingFontStyle = {
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

type BallotPageProps = {
  profile: UserProfile;
  onOpenProfile: () => void;
  onOpenExplore: () => void;
  onOpenBallot: () => void;
  onOpenCongress: () => void;
  onOpenHome: () => void;
};

const VOTER_REGISTRATION_URLS: Record<string, string | null> = {
  alabama: "https://www.alabamavotes.gov/",
  alaska: "https://voterregistration.alaska.gov/",
  arizona: "https://servicearizona.com/VoterRegistration/selectLanguage",
  arkansas: "https://www.sos.arkansas.gov/elections/voter-information/voter-registration-information/",
  california: "https://registertovote.ca.gov/",
  colorado: "https://www.sos.state.co.us/voter/pages/pub/olvr/verifyNewVoter.xhtml",
  connecticut: "https://voterregistration.ct.gov/OLVR/",
  delaware: "https://ivote.de.gov/VoterView",
  florida: "https://registertovoteflorida.gov/",
  georgia: "https://registertovote.sos.ga.gov/",
  hawaii: "https://olvr.hawaii.gov/",
  idaho: "https://voteidaho.gov/register/",
  illinois: "https://ova.elections.il.gov/",
  indiana: "https://indianavoters.in.gov/",
  iowa: "https://mymvd.iowadot.gov/Account/Login?ReturnUrl=%2fVoterRegistration",
  kansas: "https://www.kdor.ks.gov/apps/voterreg/",
  kentucky: "https://vrsws.sos.ky.gov/ovrweb/",
  louisiana: "https://www.sos.la.gov/ElectionsAndVoting/Pages/OnlineVoterRegistration.aspx",
  maine: "https://www.maine.gov/sos/cec/elec/voter-info/votreg.html",
  maryland: "https://voterservices.elections.maryland.gov/OnlineVoterRegistration/InstructionsStep1",
  massachusetts: "https://www.sec.state.ma.us/OVR/",
  michigan: "https://mvic.sos.state.mi.us/RegisterVoter",
  minnesota: "https://mnvotes.sos.state.mn.us/VoterRegistration/index",
  mississippi: "https://www.sos.ms.gov/voter-id/register",
  missouri: "https://s1.sos.mo.gov/elections/goVoteMissouri/register.aspx",
  montana: "https://sosmt.gov/elections/vote/",
  nebraska: "https://www.nebraska.gov/apps-sos-voter-registration/",
  nevada: "https://registertovote.nv.gov/",
  "new hampshire": "https://www.sos.nh.gov/elections/register-to-vote",
  "new jersey": "https://voter.svrs.nj.gov/register",
  "new mexico": "https://portal.sos.state.nm.us/OVR/WebPages/InstructionsStep1.aspx",
  "new york": "https://voterreg.dmv.ny.gov/MotorVoter/",
  "north carolina": "https://www.ncdot.gov/dmv/offices-services/online/Pages/voter-registration-application.aspx",
  "north dakota": null, // No voter registration required
  ohio: "https://olvr.ohiosos.gov/",
  oklahoma: "https://oklahoma.gov/elections/voter-registration/register-to-vote.html",
  oregon: "https://secure.sos.state.or.us/orestar/vr/register.do",
  pennsylvania: "https://www.pavoterservices.pa.gov/Pages/VoterRegistrationApplication.aspx",
  "rhode island": "https://vote.sos.ri.gov/Home/RegistertoVote",
  "south carolina": "https://info.scvotes.sc.gov/eng/ovr/start.aspx",
  "south dakota": "https://sdsos.gov/elections-voting/voting/register-to-vote/default.aspx",
  tennessee: "https://ovr.govote.tn.gov/",
  texas: "https://www.votetexas.gov/register-to-vote/",
  utah: "https://vote.utah.gov/register-to-vote/",
  vermont: "https://olvr.vermont.gov/",
  virginia: "https://vote.elections.virginia.gov/VoterInformation",
  washington: "https://voter.votewa.gov/WhereToVote.aspx",
  "west virginia": "https://ovr.sos.wv.gov/Register/Landing",
  wisconsin: "https://myvote.wi.gov/en-us/RegisterToVote",
  wyoming: "https://sos.wyo.gov/elections/state/registeringtovote.aspx",
  // Abbreviations
  al: "https://www.alabamavotes.gov/",
  ak: "https://voterregistration.alaska.gov/",
  az: "https://servicearizona.com/VoterRegistration/selectLanguage",
  ar: "https://www.sos.arkansas.gov/elections/voter-information/voter-registration-information/",
  ca: "https://registertovote.ca.gov/",
  co: "https://www.sos.state.co.us/voter/pages/pub/olvr/verifyNewVoter.xhtml",
  ct: "https://voterregistration.ct.gov/OLVR/",
  de: "https://ivote.de.gov/VoterView",
  fl: "https://registertovoteflorida.gov/",
  ga: "https://registertovote.sos.ga.gov/",
  hi: "https://olvr.hawaii.gov/",
  id: "https://voteidaho.gov/register/",
  il: "https://ova.elections.il.gov/",
  in: "https://indianavoters.in.gov/",
  ia: "https://mymvd.iowadot.gov/Account/Login?ReturnUrl=%2fVoterRegistration",
  ks: "https://www.kdor.ks.gov/apps/voterreg/",
  ky: "https://vrsws.sos.ky.gov/ovrweb/",
  la: "https://www.sos.la.gov/ElectionsAndVoting/Pages/OnlineVoterRegistration.aspx",
  me: "https://www.maine.gov/sos/cec/elec/voter-info/votreg.html",
  md: "https://voterservices.elections.maryland.gov/OnlineVoterRegistration/InstructionsStep1",
  ma: "https://www.sec.state.ma.us/OVR/",
  mi: "https://mvic.sos.state.mi.us/RegisterVoter",
  mn: "https://mnvotes.sos.state.mn.us/VoterRegistration/index",
  ms: "https://www.sos.ms.gov/voter-id/register",
  mo: "https://s1.sos.mo.gov/elections/goVoteMissouri/register.aspx",
  mt: "https://sosmt.gov/elections/vote/",
  ne: "https://www.nebraska.gov/apps-sos-voter-registration/",
  nv: "https://registertovote.nv.gov/",
  nh: "https://www.sos.nh.gov/elections/register-to-vote",
  nj: "https://voter.svrs.nj.gov/register",
  nm: "https://portal.sos.state.nm.us/OVR/WebPages/InstructionsStep1.aspx",
  ny: "https://voterreg.dmv.ny.gov/MotorVoter/",
  nc: "https://www.ncdot.gov/dmv/offices-services/online/Pages/voter-registration-application.aspx",
  nd: null,
  oh: "https://olvr.ohiosos.gov/",
  ok: "https://oklahoma.gov/elections/voter-registration/register-to-vote.html",
  or: "https://secure.sos.state.or.us/orestar/vr/register.do",
  pa: "https://www.pavoterservices.pa.gov/Pages/VoterRegistrationApplication.aspx",
  ri: "https://vote.sos.ri.gov/Home/RegistertoVote",
  sc: "https://info.scvotes.sc.gov/eng/ovr/start.aspx",
  sd: "https://sdsos.gov/elections-voting/voting/register-to-vote/default.aspx",
  tn: "https://ovr.govote.tn.gov/",
  tx: "https://www.votetexas.gov/register-to-vote/",
  ut: "https://vote.utah.gov/register-to-vote/",
  vt: "https://olvr.vermont.gov/",
  va: "https://vote.elections.virginia.gov/VoterInformation",
  wa: "https://voter.votewa.gov/WhereToVote.aspx",
  wv: "https://ovr.sos.wv.gov/Register/Landing",
  wi: "https://myvote.wi.gov/en-us/RegisterToVote",
  wy: "https://sos.wyo.gov/elections/state/registeringtovote.aspx",
};

function getVoterRegUrl(state: string | undefined): string | null | undefined {
  if (!state) return undefined; // no state set
  const key = state.trim().toLowerCase();
  if (key in VOTER_REGISTRATION_URLS) return VOTER_REGISTRATION_URLS[key];
  return undefined; // unrecognised state
}

const requestSteps = [
  "Confirm whether your state offers vote-by-mail or absentee voting.",
  "Submit your application before the state deadline.",
  "Track your ballot request and return it early.",
];

function badgeClasses(tone: string) {
  if (tone === "emerald") {
    return "bg-slate-100 text-slate-700";
  }
  if (tone === "amber") {
    return "bg-slate-100 text-slate-700";
  }
  return "bg-slate-100 text-slate-700";
}

function typeLabel(item: BallotItem): string {
  if (item.normalized_type === "proposition") return "Measure";
  if (item.normalized_type === "office") return "Race";
  return item.normalized_type ?? "Item";
}

function levelBadge(item: BallotItem): string {
  const l = (item.election_level ?? "").toLowerCase();
  if (l.includes("federal") || l.includes("national") || l.includes("country")) return "Federal";
  if (l.includes("state") || l.includes("statewide")) return "State";
  if (l.includes("county")) return "County";
  if (l.includes("city") || l.includes("local") || l.includes("municipal")) return "Local";
  if (item.district_name) return item.district_name;
  return item.election_level ?? "";
}

interface ExplainState {
  loading: boolean;
  data: BallotItem | null;
  error: string | null;
}

function BallotMeasureCard({
  item,
  userId,
}: {
  item: BallotItem;
  userId?: string;
}) {
  const [explain, setExplain] = useState<ExplainState>({ loading: false, data: null, error: null });
  const [expanded, setExpanded] = useState(false);

  // If the item already has a summary, pre-populate
  const hasSummary = !!(item.plain_summary || item.yes_means || item.no_means);

  async function handleExplain() {
    if (explain.data || hasSummary) {
      setExpanded((v) => !v);
      return;
    }
    setExpanded(true);
    setExplain({ loading: true, data: null, error: null });
    try {
      const result = await ballotsApi.summary(item.id, userId);
      setExplain({ loading: false, data: result, error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isOffline = msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("ERR_CONNECTION_REFUSED");
      const is404 = msg.includes("404");
      const is500 = msg.includes("500") || msg.includes("502") || msg.includes("503");
      const friendlyError = isOffline
        ? "The backend server is not reachable. Please make sure uvicorn is running (uvicorn app.main:app --reload) and try again."
        : is404
          ? "This ballot item was not found on the server. It may have been removed or the ID is invalid."
          : is500
            ? "The AI service returned an error. This may mean the GEMINI_API_KEY is missing or invalid in your .env file."
            : `Could not load explanation: ${msg}`;
      setExplain({ loading: false, data: null, error: friendlyError });
    }
  }

  const summaryData = explain.data ?? (hasSummary ? item : null);
  const isProposition = item.normalized_type === "proposition";

  return (
    <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">
              {typeLabel(item)}
            </span>
            {levelBadge(item) && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
                {levelBadge(item)}
              </span>
            )}
          </div>
          <p className="text-base font-semibold text-slate-900 leading-snug">{item.title}</p>
          {item.ballot_text && item.ballot_text !== item.title && (
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">{item.ballot_text}</p>
          )}
        </div>
      </div>

      {isProposition && (
        <button
          type="button"
          onClick={handleExplain}
          className="mt-3 flex w-full items-center justify-between rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-700"
        >
          <span>{expanded && (summaryData || explain.loading) ? "Hide explanation" : "✦ Explain in plain English"}</span>
          <span className="text-slate-400">{expanded && (summaryData || explain.loading) ? "▲" : "▼"}</span>
        </button>
      )}

      {isProposition && expanded && (
        <div className="mt-3 space-y-3">
          {explain.loading && (
            <div className="animate-pulse space-y-2 rounded-xl bg-white p-4">
              <div className="h-3 w-3/4 rounded-lg bg-slate-200" />
              <div className="h-3 w-full rounded-lg bg-slate-200" />
              <div className="h-3 w-5/6 rounded-lg bg-slate-200" />
            </div>
          )}
          {explain.error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-3 ring-1 ring-red-200">
              <span>⚠️</span>
              <p className="text-xs text-red-700">{explain.error}</p>
            </div>
          )}
          {summaryData && !explain.loading && (
            <div className="space-y-3">
              {summaryData.one_sentence && (
                <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">Summary</p>
                  <p className="text-sm text-slate-800 leading-relaxed">{summaryData.one_sentence}</p>
                </div>
              )}
              {summaryData.plain_summary && summaryData.plain_summary !== summaryData.one_sentence && (
                <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-100">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 mb-1">What it means</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{summaryData.plain_summary}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {summaryData.yes_means && (
                  <div className="rounded-xl bg-emerald-50 px-3 py-3 ring-1 ring-emerald-100">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700 mb-1">✓ Yes means</p>
                    <p className="text-xs text-emerald-900 leading-relaxed">{summaryData.yes_means}</p>
                  </div>
                )}
                {summaryData.no_means && (
                  <div className="rounded-xl bg-red-50 px-3 py-3 ring-1 ring-red-100">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-700 mb-1">✗ No means</p>
                    <p className="text-xs text-red-900 leading-relaxed">{summaryData.no_means}</p>
                  </div>
                )}
              </div>
              {summaryData.effect_on_user && (
                <div className="rounded-xl bg-blue-50 px-3 py-3 ring-1 ring-blue-100">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-700 mb-1">↳ How it may affect you</p>
                  <p className="text-xs text-blue-900 leading-relaxed">{summaryData.effect_on_user}</p>
                </div>
              )}
              {summaryData.sources && summaryData.sources.length > 0 && (
                <div className="px-1">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 mb-1">Sources</p>
                  <div className="flex flex-wrap gap-2">
                    {summaryData.sources.map((s) => (
                      <a
                        key={s.url}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-slate-500 underline underline-offset-2 hover:text-slate-900"
                      >
                        {s.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {item.normalized_type === "office" && item.district_name && (
        <p className="mt-2 text-xs text-slate-400">District: {item.district_name}</p>
      )}
    </div>
  );
}

export default function BallotPage({
  profile,
  onOpenProfile,
  onOpenExplore,
  onOpenBallot,
  onOpenCongress,
  onOpenHome,
}: BallotPageProps) {
  const [pollingList, setPollingList] = useState<PollingLocation[] | null>(null);
  const [pollingLoading, setPollingLoading] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);

  const [ballotItems, setBallotItems] = useState<BallotItem[] | null>(null);
  const [ballotLoading, setBallotLoading] = useState(false);
  const [ballotError, setBallotError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.street_address?.trim() || !profile.city || !profile.state) {
      setPollingList(null);
      return;
    }
    setPollingLoading(true);
    setPollingError(null);
    pollingApi
      .nearest(profile.state, profile.city, profile.street_address)
      .then((locs) => setPollingList(locs))
      .catch(() => {
        setPollingError("Could not load polling locations. Check your address and try again.");
        setPollingList([]);
      })
      .finally(() => setPollingLoading(false));
  }, [profile.street_address, profile.city, profile.state]);

  useEffect(() => {
    if (!profile.state || !profile.city) {
      setBallotItems(null);
      return;
    }
    setBallotLoading(true);
    setBallotError(null);
    ballotsApi
      .upcoming(profile.state, profile.city, profile.street_address)
      .then((items) => setBallotItems(items))
      .catch(() => {
        setBallotError("Could not load ballot items. Try again later.");
        setBallotItems([]);
      })
      .finally(() => setBallotLoading(false));
  }, [profile.state, profile.city, profile.street_address]);

  const locationLabel =
    profile.city && profile.state
      ? `${profile.city}, ${profile.state}`
      : profile.state || profile.city || "your area";

  return (
    <div
      className="min-h-screen bg-[#FBFBFA] text-[#0F172A] selection:bg-slate-200"
      style={{ fontFamily: "Roboto, sans-serif" }}
    >
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-[#FBFBFA] shadow-2xl">
        <main className="px-6 pb-24 pt-8">
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

          <div className="mb-10">
            <span className="mb-4 inline-block rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.24em] text-slate-600">
              Ballot Hub
            </span>
            <div>
              <p className="text-sm font-medium text-slate-400">Your voting plan</p>
              <h1 className="mt-2 text-4xl font-black tracking-tight" style={headingFontStyle}>
                Ballot hub
              </h1>
              <p className="mt-4 max-w-[28rem] text-base leading-relaxed text-slate-500">
                Check readiness, find polling places, and prepare your Election Day logistics for{" "}
                {locationLabel}.
              </p>
            </div>
          </div>

          {/* ── Ballot Measures ── */}
          <div className="mb-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  On your ballot
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-900" style={headingFontStyle}>
                  Ballot measures &amp; races
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {profile.state && profile.city
                    ? `Items on the ballot for ${locationLabel}.`
                    : "Add your state and city in your profile to see your ballot."}
                </p>
              </div>
              {ballotItems && ballotItems.length > 0 && (
                <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 shrink-0">
                  {ballotItems.length} {ballotItems.length === 1 ? "item" : "items"}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {!profile.state || !profile.city ? (
                <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
                  <span className="text-base">⚠️</span>
                  <p className="text-sm text-amber-800">Add your state and city in your profile to load ballot information.</p>
                </div>
              ) : ballotLoading ? (
                <div className="animate-pulse space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="rounded-[1.5rem] bg-slate-50 px-4 py-5 space-y-2">
                      <div className="h-3 w-1/4 rounded-lg bg-slate-200" />
                      <div className="h-4 w-3/4 rounded-lg bg-slate-200" />
                      <div className="h-3 w-full rounded-lg bg-slate-200" />
                    </div>
                  ))}
                </div>
              ) : ballotError ? (
                <div className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 ring-1 ring-red-200">
                  <span className="text-base">⚠️</span>
                  <p className="text-sm text-red-700">{ballotError}</p>
                </div>
              ) : !ballotItems || ballotItems.length === 0 ? (
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
                  <span className="text-2xl">🗳️</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-500">No ballot items found</p>
                    <p className="mt-1 text-xs text-slate-400">
                      No upcoming ballot data is available yet for {locationLabel}. Check back closer to the election.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Propositions / Measures */}
                  {ballotItems.filter((b) => b.normalized_type === "proposition").length > 0 && (
                    <div className="space-y-2">
                      <p className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Measures &amp; Propositions</p>
                      {ballotItems
                        .filter((b) => b.normalized_type === "proposition")
                        .map((item) => (
                          <BallotMeasureCard key={item.id} item={item} userId={profile.id} />
                        ))}
                    </div>
                  )}
                  {/* Office Races */}
                  {ballotItems.filter((b) => b.normalized_type === "office").length > 0 && (
                    <div className="space-y-2 mt-4">
                      <p className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Candidate Races</p>
                      {ballotItems
                        .filter((b) => b.normalized_type === "office")
                        .map((item) => (
                          <BallotMeasureCard key={item.id} item={item} userId={profile.id} />
                        ))}
                    </div>
                  )}
                  {/* Any other types */}
                  {ballotItems.filter((b) => b.normalized_type !== "proposition" && b.normalized_type !== "office").length > 0 && (
                    <div className="space-y-2 mt-4">
                      {ballotItems
                        .filter((b) => b.normalized_type !== "proposition" && b.normalized_type !== "office")
                        .map((item) => (
                          <BallotMeasureCard key={item.id} item={item} userId={profile.id} />
                        ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="mb-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Am I ready to vote?
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-900" style={headingFontStyle}>
                  Quick readiness check
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Review the essentials before you head out or request a ballot.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                3 steps
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {/* Registration status */}
              <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-900">Registration status</p>
                    {(() => {
                      const regUrl = getVoterRegUrl(profile.state);
                      if (regUrl === undefined && !profile.state) {
                        return (
                          <p className="mt-1 text-sm text-slate-600">
                            Add your state in your profile to get your state's voter registration link.
                          </p>
                        );
                      }
                      if (regUrl === null) {
                        return (
                          <p className="mt-1 text-sm text-slate-600">
                            North Dakota does not require voter registration — you can vote at your polling place with proof of residency.
                          </p>
                        );
                      }
                      if (regUrl === undefined) {
                        return (
                          <p className="mt-1 text-sm text-slate-600">
                            Confirm your registration at your state's official election portal.
                          </p>
                        );
                      }
                      return (
                        <>
                          <p className="mt-1 text-sm text-slate-600">
                            Confirm your registration, check your status, or request an absentee ballot at the official {profile.state} voter portal.
                          </p>
                          <a
                            href={regUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-700"
                          >
                            Register / verify / absentee in {profile.state}
                            <span aria-hidden>↗</span>
                          </a>
                        </>
                      );
                    }()
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700 shrink-0">
                    Check
                  </div>
                </div>
              </div>

              {/* Polling place plan */}
              <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Polling place plan</p>
                    <p className="mt-1 text-sm text-slate-600">Pick a preferred location before Election Day so you have a backup option.</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700 shrink-0">
                    Review
                  </div>
                </div>
              </div>

              {/* ID and ballot request */}
              <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">ID and ballot request</p>
                    <p className="mt-1 text-sm text-slate-600">Check whether your state needs ID or a mail ballot application.</p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-700 shrink-0">
                    Next step
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Polling locations
                </p>
                <h3 className="mt-2 text-xl font-bold text-slate-900" style={headingFontStyle}>
                  Places near {locationLabel}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {profile.street_address?.trim()
                    ? "Based on your registered address."
                    : "Add your street address in your profile to see nearby polling places."}
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Election Day
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {!profile.street_address?.trim() ? (
                <div className="flex items-start gap-2 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
                  <span className="text-base">⚠️</span>
                  <p className="text-sm text-amber-800">Add your street address in your profile to find polling places near you.</p>
                </div>
              ) : pollingLoading ? (
                <div className="animate-pulse space-y-2">
                  {[80, 68, 56].map((w) => (
                    <div key={w} className="h-4 rounded-xl bg-slate-200" style={{ width: `${w}%` }} />
                  ))}
                </div>
              ) : pollingError ? (
                <div className="flex items-start gap-2 rounded-2xl bg-red-50 px-4 py-3 ring-1 ring-red-200">
                  <span className="text-base">⚠️</span>
                  <p className="text-sm text-red-700">{pollingError}</p>
                </div>
              ) : pollingList === null || pollingList.length === 0 ? (
                <div className="flex items-start gap-3 rounded-2xl bg-slate-50 px-4 py-4">
                  <span className="text-2xl">📍</span>
                  <div>
                    <p className="text-sm font-semibold text-slate-400">No polling locations found</p>
                    <p className="mt-1 text-xs text-slate-400">No polling data is available for your address yet. Check back closer to the election.</p>
                  </div>
                </div>
              ) : (
                pollingList.map((loc, i) => (
                  <div key={i} className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{loc.name}</p>
                        <p className="mt-1 text-sm text-slate-600">{loc.address}</p>
                        {loc.polling_hours && (
                          <p className="mt-2 text-xs font-semibold text-slate-500 whitespace-pre-line">🕒 {loc.polling_hours}</p>
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
                ))
              )}
            </div>
          </div>


          </div>
        </main>

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
            className="flex flex-col items-center gap-1 px-4 py-2 text-[#0F172A]"
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
