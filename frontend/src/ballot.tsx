import type { UserProfile } from "./profile";

type BallotPageProps = {
  profile: UserProfile;
  onOpenProfile: () => void;
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

const pollingLocations = [
  {
    name: "Civic Center Library",
    address: "1200 Main Street",
    distance: "0.8 mi",
    waitTime: "12 min",
  },
  {
    name: "Community Recreation Hall",
    address: "48 Park Avenue",
    distance: "1.6 mi",
    waitTime: "24 min",
  },
  {
    name: "Northside High School Gym",
    address: "800 Lincoln Drive",
    distance: "2.4 mi",
    waitTime: "7 min",
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
  onOpenBallot,
  onOpenHome,
}: BallotPageProps) {
  const locationLabel =
    profile.city && profile.state
      ? `${profile.city}, ${profile.state}`
      : profile.state || profile.city || "your area";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white shadow-2xl">
        <div className="bg-gradient-to-b from-blue-700 via-blue-600 to-cyan-500 px-6 pb-8 pt-8 text-white">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Your voting plan</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Ballot hub</h1>
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
            <h2 className="mt-2 text-2xl font-semibold leading-tight">
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
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
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
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  Places near {locationLabel}
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Election Day wait times are sample placeholders for now and can be replaced with
                  live data later.
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                Election Day
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {pollingLocations.map((location) => (
                <div
                  key={location.name}
                  className="rounded-2xl bg-slate-50 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{location.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{location.address}</p>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {location.distance} away
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm">
                      {location.waitTime}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-3xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-700">Request your ballot</p>
                <h4 className="mt-1 text-lg font-semibold text-slate-900">
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

        <div className="fixed bottom-0 mx-auto flex w-full max-w-md items-center justify-around border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={onOpenHome}
            className="flex flex-col items-center gap-1 text-xs text-slate-500 transition hover:text-blue-600"
          >
            <span className="text-lg">🏠</span>
            Home
          </button>
          <button type="button" className="flex flex-col items-center gap-1 text-xs text-slate-500">
            <span className="text-lg">🔎</span>
            Explore
          </button>
          <button
            type="button"
            onClick={onOpenBallot}
            className="flex flex-col items-center gap-1 text-xs font-semibold text-blue-600"
          >
            <span className="text-lg">🗂️</span>
            Ballot
          </button>
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex flex-col items-center gap-1 text-xs text-slate-500 transition hover:text-blue-600"
          >
            <span className="text-lg">👤</span>
            Profile
          </button>
        </div>
      </div>
    </div>
  );
}
