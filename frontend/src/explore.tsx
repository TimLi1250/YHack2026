import { useMemo, useState } from "react";
import type { UserProfile } from "./profile";
import { ai, type FactCheckEvidence, type FactCheckVerdict } from "./api";

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
  messageType?: "chat" | "fact-check";
  citations?: { id: string; label: string; url: string; snippet?: string | null }[];
  uncertainties?: string[];
  claim?: string;
  verdict?: FactCheckVerdict;
  evidence_for?: FactCheckEvidence[];
  evidence_against?: FactCheckEvidence[];
};

type PanelMode = "chat" | "voice" | null;
type AssistantMode = "chat" | "fact-check";

const starterPrompts = [
  "What should I know before voting in my city?",
  "Can you explain a ballot measure in simple language?",
  "What documents should I bring on Election Day?",
];

const factCheckPrompts = [
  "This ballot measure raises taxes for every resident.",
  "My city requires photo ID to vote in person.",
  "This candidate supports expanding public transit funding.",
];

const verdictLabels: Record<FactCheckVerdict, string> = {
  supported: "Supported",
  contradicted: "Contradicted",
  mixed: "Mixed evidence",
  not_enough_evidence: "Not enough evidence",
};

const verdictStyles: Record<FactCheckVerdict, string> = {
  supported: "bg-emerald-50 text-emerald-700",
  contradicted: "bg-rose-50 text-rose-700",
  mixed: "bg-amber-50 text-amber-700",
  not_enough_evidence: "bg-slate-100 text-slate-600",
};

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

function buildFactCheckFallback(claim: string) {
  return `I could not complete a live fact-check for "${claim}" right now. Review the attached sources or try a more specific claim.`;
}

function buildProfileContext(profile: UserProfile) {
  return {
    name: profile.name,
    age_range: profile.age_range,
    ethnicity: profile.ethnicity,
    interests: profile.interests,
    salary_range: profile.salary_range,
    gender: profile.gender,
    state: profile.state,
    city: profile.city,
    language_preference: profile.language_preference,
  };
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
  const [assistantMode, setAssistantMode] = useState<AssistantMode>("chat");
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text:
        "Ask me anything about the ballot. I can help explain measures, candidate races, deadlines, polling places, and what to expect before Election Day.",
      messageType: "chat",
    },
  ]);

  const locationLabel = useMemo(() => {
    if (profile.city && profile.state) {
      return `${profile.city}, ${profile.state}`;
    }
    return profile.state || profile.city || "your area";
  }, [profile.city, profile.state]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const conversation = messages
      .filter((message) => message.messageType !== "fact-check")
      .map((message) => ({
        role: message.role,
        text: message.text,
      }));

    setMessages((current) => [...current, { role: "user", text: trimmed, messageType: "chat" }]);
    setDraft("");
    setAssistantMode("chat");
    setPanelMode("chat");
    setIsSending(true);

    try {
      const response = await ai.chat({
        user_id: profile.id,
        message: trimmed,
        language_preference: profile.language_preference,
        profile_context: buildProfileContext(profile),
        conversation,
      });

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: response.answer,
          messageType: "chat",
          citations: response.citations,
          uncertainties: response.uncertainties,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", text: buildAssistantReply(trimmed, profile), messageType: "chat" },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const sendFactCheck = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((current) => [...current, { role: "user", text: trimmed, messageType: "fact-check" }]);
    setDraft("");
    setAssistantMode("fact-check");
    setPanelMode("chat");
    setIsSending(true);

    try {
      const response = await ai.factCheck({
        user_id: profile.id,
        claim: trimmed,
        language_preference: profile.language_preference,
        profile_context: buildProfileContext(profile),
      });

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: response.summary,
          messageType: "fact-check",
          claim: response.claim,
          verdict: response.verdict,
          evidence_for: response.evidence_for,
          evidence_against: response.evidence_against,
          citations: response.citations,
          uncertainties: response.uncertainties,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: buildFactCheckFallback(trimmed),
          messageType: "fact-check",
          claim: trimmed,
          verdict: "not_enough_evidence",
          uncertainties: ["Live fact-check unavailable; try a more specific local claim."],
        },
      ]);
    } finally {
      setIsSending(false);
    }
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
                <button
                  type="button"
                  onClick={() => {
                    setAssistantMode("fact-check");
                    setPanelMode("chat");
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition-all hover:border-slate-900 hover:ring-4 hover:ring-slate-900/5"
                >
                  <p className="text-sm font-semibold text-slate-900">Fact-check a claim</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Check whether a ballot or candidate claim is supported, contradicted, or still unverified.
                  </p>
                </button>
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
                  onClick={() => {
                    setAssistantMode("chat");
                    setPanelMode("chat");
                  }}
                  className="w-full text-left text-sm text-slate-400"
                >
                  Ask me anything about the ballot...
                </button>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Chat starters
                </p>
                <div className="flex flex-wrap gap-2">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:border-slate-900 hover:text-slate-900"
                  >
                    {prompt}
                  </button>
                ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Fact-check starters
                </p>
                <div className="flex flex-wrap gap-2">
                  {factCheckPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void sendFactCheck(prompt)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 transition-all hover:border-slate-900 hover:text-slate-900"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
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
                    {panelMode === "voice"
                      ? "Voice mode"
                      : assistantMode === "fact-check"
                        ? "Fact-check a claim"
                        : "Ask me anything"}
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
                        { role: "user", text: "Voice question placeholder", messageType: "chat" },
                        {
                          role: "assistant",
                          text:
                            "This is a placeholder response for voice mode. You can wire live speech here next.",
                          messageType: "chat",
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
                  <div className="border-b border-slate-100 px-5 py-3">
                    <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
                      <button
                        type="button"
                        onClick={() => setAssistantMode("chat")}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                          assistantMode === "chat"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        Chat
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssistantMode("fact-check")}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                          assistantMode === "fact-check"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-500 hover:text-slate-900"
                        }`}
                      >
                        Fact check
                      </button>
                    </div>
                  </div>

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
                        {message.verdict ? (
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${verdictStyles[message.verdict]}`}
                            >
                              {verdictLabels[message.verdict]}
                            </span>
                            {message.claim ? (
                              <span className="text-xs text-slate-500">{message.claim}</span>
                            ) : null}
                          </div>
                        ) : null}
                        <p>{message.text}</p>
                        {message.uncertainties?.length ? (
                          <div className="mt-3 rounded-2xl bg-white/70 px-3 py-2 text-xs text-slate-500">
                            {message.uncertainties.join(" ")}
                          </div>
                        ) : null}
                        {message.citations?.length ? (
                          <div className="mt-3">
                            <a
                              href={message.citations[0].url}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-xs font-semibold text-blue-600 underline-offset-2 hover:underline"
                            >
                              {message.citations[0].label}
                            </a>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    {isSending ? (
                      <div className="rounded-3xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                        {assistantMode === "fact-check"
                          ? "BallotBridge is checking web and local sources..."
                          : "BallotBridge is thinking..."}
                      </div>
                    ) : null}
                  </div>

                  <div className="border-t border-slate-100 p-4">
                    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 transition-all focus-within:border-slate-900 focus-within:ring-4 focus-within:ring-slate-900/5">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        placeholder={
                          assistantMode === "fact-check"
                            ? "Paste a ballot, candidate, or voting claim to verify..."
                            : "Ask me anything about the ballot..."
                        }
                        className="min-h-20 w-full resize-none border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-300"
                      />
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-slate-500">
                          {assistantMode === "fact-check"
                            ? "Try a specific claim so the verdict can stay grounded."
                            : "Try races, measures, deadlines, or logistics."}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            void (assistantMode === "fact-check"
                              ? sendFactCheck(draft)
                              : sendMessage(draft))
                          }
                          disabled={isSending || !draft.trim()}
                          className="rounded-xl bg-[#0F172A] px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                        >
                          {isSending ? "Sending..." : assistantMode === "fact-check" ? "Check" : "Send"}
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
