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
    return "bg-slate-100 text-slate-700";
  }
  if (tone === "amber") {
    return "bg-slate-100 text-slate-700";
  }
  return "bg-slate-100 text-slate-700";
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

          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
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
              {readinessItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[1.5rem] bg-slate-50 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${badgeClasses(item.tone)}`}>
                      {item.status}
                    </div>
                  </div>
                </div>
              ))}
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

          <div className="mt-6 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">Request your ballot</p>
                <h4 className="mt-2 text-xl font-bold text-slate-900" style={headingFontStyle}>
                  Vote by mail if that works better for you
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Start with your state and city in your profile so we can direct you to the right
                  ballot request process.
                </p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
                Mail ballot
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {requestSteps.map((step, index) => (
                <div key={step} className="flex items-start gap-3 rounded-[1.5rem] bg-slate-50 px-4 py-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                    {index + 1}
                  </div>
                  <p className="pt-1 text-sm leading-6 text-slate-600">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={onOpenProfile}
                className="rounded-[1.5rem] bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Update location
              </button>
              <button
                type="button"
                className="rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Request ballot
              </button>
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
