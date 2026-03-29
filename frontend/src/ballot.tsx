import { useEffect, useState } from "react";
import { pollingLocations as pollingApi, type PollingLocation } from "./api";
import type { UserProfile } from "./profile";

const headingFontStyle = {
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

type BallotPageProps = {
  profile: UserProfile;
  onOpenProfile: () => void;
  onOpenExplore: () => void;
  onOpenBallot: () => void;
  onOpenHome: () => void;
};

const readinessItems = [
  {
    label: "Registration status",
    status: "Ready",
    detail: "Your voting profile is in progress. Confirm registration with your state portal.",
    tone: "emerald",
  },
  {
    label: "Polling place plan",
    status: "Review",
    detail: "Pick a preferred location before Election Day so you have a backup option.",
    tone: "amber",
  },
  {
    label: "ID and ballot request",
    status: "Next step",
    detail: "Check whether your state needs ID or a mail ballot application.",
    tone: "blue",
  },
];

const requestSteps = [
  "Confirm whether your state offers vote-by-mail or absentee voting.",
  "Submit your application before the state deadline.",
  "Track your ballot request and return it early.",
];

function badgeClasses(tone: string) {
  if (tone === "emerald") {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  }
  if (tone === "amber") {
    return "bg-amber-50 text-amber-700 ring-1 ring-amber-100";
  }
  return "bg-blue-50 text-blue-700 ring-1 ring-blue-100";
}

export default function BallotPage({
  profile,
  onOpenProfile,
  onOpenExplore,
  onOpenBallot,
  onOpenHome,
}: BallotPageProps) {
  const [pollingList, setPollingList] = useState<PollingLocation[] | null>(null);
  const [pollingLoading, setPollingLoading] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);

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

  const locationLabel =
    profile.city && profile.state
      ? `${profile.city}, ${profile.state}`
      : profile.state || profile.city || "your area";

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900"
      style={{ fontFamily: "Roboto, sans-serif" }}
    >
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white shadow-2xl">
        <div className="bg-gradient-to-b from-blue-700 via-blue-600 to-cyan-500 px-6 pb-8 pt-8 text-white">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Your voting plan</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight" style={headingFontStyle}>
                Ballot hub
              </h1>
            </div>
            <button
              type="button"
              onClick={onOpenHome}
              className="rounded-2xl bg-white/15 px-3 py-2 text-sm font-medium backdrop-blur transition hover:bg-white/20"
            >
              Back home
            </button>
          </div>

          <div className="rounded-3xl bg-white/12 p-5 backdrop-blur">
            <p className="text-sm font-medium text-blue-100">Plan before Election Day</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight" style={headingFontStyle}>
              Check readiness, find polling places, and request your ballot in one view.
            </h2>
            <p className="mt-3 text-sm leading-6 text-blue-50">
              We are currently tailoring this page for {locationLabel} so the next steps feel
              local and actionable.
            </p>
          </div>
        </div>

        <div className="-mt-4 px-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Am I ready to vote?
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900" style={headingFontStyle}>
                  Quick readiness check
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Review the essentials before you head out or request a ballot.
                </p>
              </div>
              <div className="rounded-2xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                3 steps
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {readinessItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl bg-slate-50 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                    </div>
                    <div className={`rounded-2xl px-3 py-2 text-xs font-semibold ${badgeClasses(item.tone)}`}>
                      {item.status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 pb-24 pt-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Polling locations
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900" style={headingFontStyle}>
                  Places near {locationLabel}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {profile.street_address?.trim()
                    ? "Based on your registered address."
                    : "Add your street address in your profile to see nearby polling places."}
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
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
                  <div key={i} className="rounded-2xl bg-slate-50 px-4 py-4">
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
                      <span className="shrink-0 rounded-xl bg-blue-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                        {loc.kind === "drop_off" ? "Drop-off" : loc.kind === "early_vote" ? "Early vote" : "Polls"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-700">Request your ballot</p>
                <h4 className="mt-1 text-lg font-semibold text-slate-900" style={headingFontStyle}>
                  Vote by mail if that works better for you
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Start with your state and city in your profile so we can direct you to the right
                  ballot request process.
                </p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm">
                Mail ballot
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {requestSteps.map((step, index) => (
                <div key={step} className="flex items-start gap-3 rounded-2xl bg-white/80 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="pt-1 text-sm leading-6 text-slate-700">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onOpenProfile}
                className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.01]"
              >
                Update location
              </button>
              <button
                type="button"
                className="rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
              >
                Request ballot
              </button>
            </div>
          </div>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
          <nav className="pointer-events-auto mx-auto max-w-md border-t border-slate-100 bg-white">
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
