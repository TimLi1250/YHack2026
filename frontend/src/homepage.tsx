type VotingAssistantHomepageProps = {
  onOpenProfile: () => void;
  onOpenExplore: () => void;
  onOpenBallot: () => void;
  onOpenHome: () => void;
};

export default function VotingAssistantHomepage({
  onOpenProfile,
  onOpenExplore,
  onOpenBallot,
  onOpenHome,
}: VotingAssistantHomepageProps) {
  const features = [
    {
      title: "Explain My Ballot",
      desc: "Get plain-language summaries of races and ballot measures.",
      icon: "🗳️",
    },
    {
      title: "Voting Info Near Me",
      desc: "Find registration help, deadlines, polling places, and ID requirements.",
      icon: "📍",
    },
    {
      title: "Community Impact",
      desc: "See how an issue could affect students, renters, families, and seniors.",
      icon: "🌍",
    },
  ];

  const upcomingItems = [
    {
      label: "Registration deadline",
      date: "Oct 7",
      detail: "Check your status before the deadline.",
    },
    {
      label: "Early voting begins",
      date: "Oct 21",
      detail: "Plan where and when you want to vote.",
    },
    {
      label: "Election Day",
      date: "Nov 5",
      detail: "Polling places open from 6 AM to 9 PM.",
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white shadow-2xl">
        <div className="bg-gradient-to-b from-blue-700 via-blue-600 to-cyan-500 px-6 pb-8 pt-8 text-white">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Civic access for everyone</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">BallotBridge</h1>
            </div>
            <div className="rounded-2xl bg-white/15 px-3 py-2 text-sm font-medium backdrop-blur">
              Nonpartisan
            </div>
          </div>

          <div className="rounded-3xl bg-white/12 p-5 backdrop-blur">
            <p className="text-sm font-medium text-blue-100">Welcome back</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight">
              Understand your ballot in clear, simple language.
            </h2>
            <p className="mt-3 text-sm leading-6 text-blue-50">
              Get trusted voting information, personalized guidance, and community-focused
              explanations in minutes.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-blue-700 shadow-sm transition hover:scale-[1.01]">
                Get started
              </button>
              <button
                type="button"
                onClick={onOpenBallot}
                className="rounded-2xl border border-white/40 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                View sample ballot
              </button>
            </div>
          </div>
        </div>

        <div className="-mt-4 px-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Your election check-in
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  Stay ready for the next election
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Track important dates, upcoming reminders, and what to do next before voting.
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
                3 upcoming
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {upcomingItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-start justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.detail}</p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-blue-700 shadow-sm">
                    {item.date}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.01]">
                Set reminders
              </button>
              <button className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                View full timeline
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-24 pt-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">How we help</h3>
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
                className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
                    {feature.icon}
                  </div>
                  <div>
                    <h4 className="text-base font-semibold">{feature.title}</h4>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{feature.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-3xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-700">Impact mode</p>
                <h4 className="mt-1 text-lg font-semibold text-slate-900">
                  Explore what matters to your community
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  View ballot measures through lenses like students, renters, families, and public
                  transit users.
                </p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm">
                New
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenExplore}
              className="mt-4 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.01]"
            >
              Ask about your ballot
            </button>
          </div>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
          <div className="pointer-events-auto mx-auto flex w-full max-w-md items-center justify-around border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={onOpenHome}
            className="flex flex-col items-center gap-1 text-xs font-semibold text-blue-600"
          >
            <span className="text-lg">⌂</span>
            Home
          </button>
          <button
            type="button"
            onClick={onOpenExplore}
            className="flex flex-col items-center gap-1 text-xs text-slate-500 transition hover:text-blue-600"
          >
            <span className="text-lg">⌕</span>
            Explore
          </button>
          <button
            type="button"
            onClick={onOpenBallot}
            className="flex flex-col items-center gap-1 text-xs text-slate-500 transition hover:text-blue-600"
          >
            <span className="text-lg">☑</span>
            Ballot
          </button>
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex flex-col items-center gap-1 text-xs text-slate-500 transition hover:text-blue-600"
          >
            <span className="text-lg">◉</span>
            Profile
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
