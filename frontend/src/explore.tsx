import { useMemo, useState } from "react";
import type { UserProfile } from "./profile";

const headingFontStyle = {
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

type ExplorePageProps = {
  profile: UserProfile;
  onOpenProfile: () => void;
  onOpenExplore: () => void;
  onOpenBallot: () => void;
  onOpenHome: () => void;
};

type ChatMessage = {
  role: "assistant" | "user";
  text: string;
};

const starterPrompts = [
  "What should I know before voting in my city?",
  "Can you explain a ballot measure in simple language?",
  "What documents should I bring on Election Day?",
];

function buildAssistantReply(prompt: string, profile: UserProfile) {
  const location =
    profile.city && profile.state
      ? `${profile.city}, ${profile.state}`
      : profile.state || profile.city || "your area";

  const interestsSummary = profile.interests.join(", ");
  const interests = interestsSummary
    ? ` Based on your interests in ${interestsSummary}, I would prioritize those topics first.`
    : "";

  return `Here is a simple starting point for "${prompt}" in ${location}. I would first identify the offices and measures on your ballot, then explain each item in plain language, note any deadlines or ID rules that apply, and flag where to verify official details.${interests} This Explore chat is currently a frontend prototype, so the answers are mock responses for now.`;
}

export default function ExplorePage({
  profile,
  onOpenProfile,
  onOpenExplore,
  onOpenBallot,
  onOpenHome,
}: ExplorePageProps) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text:
        "Ask us anything about the ballot. I can help explain races, measures, voting logistics, and what to expect before Election Day.",
    },
  ]);

  const locationLabel = useMemo(() => {
    if (profile.city && profile.state) {
      return `${profile.city}, ${profile.state}`;
    }
    return profile.state || profile.city || "your area";
  }, [profile.city, profile.state]);

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((current) => [
      ...current,
      { role: "user", text: trimmed },
      { role: "assistant", text: buildAssistantReply(trimmed, profile) },
    ]);
    setDraft("");
  };

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900"
      style={{ fontFamily: "Roboto, sans-serif" }}
    >
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white shadow-2xl">
        <div className="bg-gradient-to-b from-blue-700 via-blue-600 to-cyan-500 px-6 pb-8 pt-8 text-white">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Ballot Q&A</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight" style={headingFontStyle}>
                Explore
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
            <p className="text-sm font-medium text-blue-100">Ask us anything about the ballot</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight" style={headingFontStyle}>
              A chat-style assistant for voting questions and ballot explanations.
            </h2>
            <p className="mt-3 text-sm leading-6 text-blue-50">
              Questions are currently answered with prototype responses tailored to {locationLabel}.
            </p>
          </div>
        </div>

        <div className="-mt-4 px-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Chat assistant
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900" style={headingFontStyle}>
                  Ask a ballot question
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Start with a race, policy issue, deadline, or voting logistics question.
                </p>
              </div>
              <div className="rounded-2xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                Prototype
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={`rounded-3xl px-4 py-4 text-sm leading-6 ${
                    message.role === "assistant"
                      ? "bg-slate-50 text-slate-700"
                      : "ml-8 bg-blue-600 text-white"
                  }`}
                >
                  <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                    {message.role === "assistant" ? "BallotBridge" : "You"}
                  </p>
                  <p>{message.text}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask us anything about the ballot..."
                className="min-h-24 w-full resize-none border-0 bg-transparent px-1 py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-slate-500">
                  Tip: ask about measures, candidates, polling places, or deadlines.
                </p>
                <button
                  type="button"
                  onClick={() => sendMessage(draft)}
                  className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.01]"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pb-24 pt-6">
          <div className="rounded-3xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-700">Better answers start here</p>
                <h4 className="mt-1 text-lg font-semibold text-slate-900" style={headingFontStyle}>
                  Add your city and state for more relevant ballot guidance
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Your profile helps this chat focus on the right location, deadlines, and ballot
                  context.
                </p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm">
                Context
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenProfile}
              className="mt-4 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.01]"
            >
              Update profile
            </button>
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
            className="flex flex-col items-center gap-1 px-4 py-2 text-[#0F172A]"
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
