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

type PanelMode = "chat" | "voice" | null;

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

  return `Here is a simple starting point for "${prompt}" in ${location}. I would identify the offices and measures on your ballot, explain them in plain language, flag deadlines or ID rules, and point you to official verification sources.${interests} This page is currently a frontend AI prototype.`;
}

export default function ExplorePage({
  profile,
  onOpenProfile,
  onOpenExplore,
  onOpenBallot,
  onOpenHome,
}: ExplorePageProps) {
  const [draft, setDraft] = useState("");
  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text:
        "Ask me anything about the ballot. I can help explain measures, candidate races, deadlines, polling places, and what to expect before Election Day.",
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
    setPanelMode("chat");
  };

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
              Ballot Q&A
            </span>
            <h1 className="text-4xl font-black tracking-tight" style={headingFontStyle}>
              Explore your ballot with AI.
            </h1>
            <p className="mt-4 max-w-[28rem] text-base leading-relaxed text-slate-500">
              Ask questions in plain language, get quick guidance, and explore voting information
              tailored to {locationLabel}.
            </p>
          </div>

          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-lg text-slate-900">
                  ◌
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={headingFontStyle}>
                    Chat assistant
                  </h2>
                  <p className="text-xs text-slate-400">Ask me anything about the ballot</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Here are some things you could do
                </p>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">Understand measures quickly</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Ask for plain-language explanations, arguments, and likely impact.
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">Get voting logistics help</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Ask about deadlines, ID rules, polling locations, and mail ballot steps.
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">Tie answers to your profile</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Your city, state, and priorities help make responses more relevant.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setPanelMode("voice")}
                className="mt-4 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-4 text-left transition-all hover:border-slate-900 hover:ring-4 hover:ring-slate-900/5"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Voice chat
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    Speak a ballot question and open the AI assistant in voice mode.
                  </p>
                </div>
                <span className="text-xl text-slate-900">◉</span>
              </button>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-4 transition-all focus-within:border-slate-900 focus-within:ring-4 focus-within:ring-slate-900/5">
                <button
                  type="button"
                  onClick={() => setPanelMode("chat")}
                  className="w-full text-left text-sm text-slate-400"
                >
                  Ask me anything about the ballot...
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:border-slate-900 hover:text-slate-900"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-lg text-slate-900">
                  ⌖
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={headingFontStyle}>
                    Better answers start with context
                  </h2>
                  <p className="text-xs text-slate-400">Make your ballot guidance more local</p>
                </div>
              </div>

              <p className="text-sm leading-6 text-slate-600">
                Add your city and state in profile so the assistant can focus on local races,
                polling rules, and ballot language that actually applies to you.
              </p>
              <button
                type="button"
                onClick={onOpenProfile}
                className="mt-4 w-full rounded-xl bg-[#0F172A] px-8 py-4 text-sm font-bold tracking-tight text-white shadow-lg shadow-slate-200 transition-all hover:bg-slate-800 active:scale-[0.98]"
              >
                Update profile
              </button>
            </section>
          </div>
        </main>

        {panelMode ? (
          <div className="absolute inset-0 z-40 bg-black/20 px-4 py-6 backdrop-blur-[2px]">
            <div className="mx-auto flex h-full max-w-md flex-col rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    AI Assistant
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900" style={headingFontStyle}>
                    {panelMode === "voice" ? "Voice mode" : "Ask me anything"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setPanelMode(null)}
                  className="rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
                >
                  Close
                </button>
              </div>

              {panelMode === "voice" ? (
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-900 text-3xl text-white">
                    ●
                  </div>
                  <h4 className="mt-6 text-2xl font-bold text-slate-900" style={headingFontStyle}>
                    Start speaking
                  </h4>
                  <p className="mt-3 max-w-xs text-sm leading-6 text-slate-500">
                    Voice chat is a UI prototype for now. This is where live speech input and
                    spoken AI responses would appear.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMessages((current) => [
                        ...current,
                        { role: "user", text: "Voice question placeholder" },
                        {
                          role: "assistant",
                          text:
                            "This is a placeholder response for voice mode. You can wire live speech here next.",
                        },
                      ]);
                      setPanelMode("chat");
                    }}
                    className="mt-6 rounded-xl bg-[#0F172A] px-8 py-4 text-sm font-bold tracking-tight text-white shadow-lg shadow-slate-200 transition-all hover:bg-slate-800 active:scale-[0.98]"
                  >
                    Simulate voice question
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
                    {messages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        className={`rounded-3xl px-4 py-4 text-sm leading-6 ${
                          message.role === "assistant"
                            ? "bg-slate-50 text-slate-700"
                            : "ml-8 bg-[#0F172A] text-white"
                        }`}
                      >
                        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] opacity-70">
                          {message.role === "assistant" ? "BallotBridge" : "You"}
                        </p>
                        <p>{message.text}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 p-4">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 transition-all focus-within:border-slate-900 focus-within:ring-4 focus-within:ring-slate-900/5">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder="Ask me anything about the ballot..."
                        className="min-h-20 w-full resize-none border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-300"
                      />
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">Try races, measures, deadlines, or logistics.</p>
                        <button
                          type="button"
                          onClick={() => sendMessage(draft)}
                          className="rounded-xl bg-[#0F172A] px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : null}

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
