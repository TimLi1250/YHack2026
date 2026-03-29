import { useState, type KeyboardEvent } from "react";

type ProfilePageProps = {
  profile: UserProfile;
  onChange: (profile: UserProfile) => void;
  onOpenProfile: () => void;
  onOpenExplore: () => void;
  onOpenBallot: () => void;
  onOpenHome: () => void;
};

export type UserProfile = {
  id?: string;
  name: string;
  age_range: string;
  ethnicity: string;
  interests: string[];
  salary_range: string;
  gender: string;
  state: string;
  city: string;
  language_preference: string;
};

const ageOptions = ["Under 18", "18-24", "25-34", "35-44", "45-54", "55-64", "65+"];

const salaryOptions = [
  "Under $25k",
  "$25k-$50k",
  "$50k-$100k",
  "$100k-$200k",
  "$200k+",
  "Prefer not to say",
];

const genderOptions = ["Male", "Female", "Nonbinary", "Other", "Prefer not to say"];

const ethnicityOptions = [
  "East Asian",
  "South Asian / Indian",
  "White",
  "Black",
  "Indigenous",
  "Latino / Hispanic",
  "Middle Eastern / North African",
  "Pacific Islander",
  "Multiracial",
  "Other",
  "Prefer not to say",
];

const interestOptions = [
  "Taxes",
  "Abortion",
  "Voting Rights",
  "Housing",
  "Education",
  "Healthcare",
  "Transportation",
  "Climate",
  "Economy",
  "Immigration",
  "Public Safety",
  "Reproductive Rights",
  "Labor",
  "Student Debt",
];

const languageOptions = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "zh", label: "Chinese" },
  { value: "tl", label: "Tagalog" },
  { value: "vi", label: "Vietnamese" },
];

const headingFontStyle = {
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

function parseInterests(value: string) {
  return value
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ProfilePage({
  profile,
  onChange,
  onOpenProfile,
  onOpenExplore,
  onOpenBallot,
  onOpenHome,
}: ProfilePageProps) {
  const [interestDraft, setInterestDraft] = useState("");

  const updateField = (field: keyof UserProfile, value: string | string[]) => {
    onChange({
      ...profile,
      [field]: value,
    });
  };

  const toggleInterest = (interest: string) => {
    const nextInterests = profile.interests.includes(interest)
      ? profile.interests.filter((item) => item !== interest)
      : [...profile.interests, interest];

    updateField("interests", nextInterests);
  };

  const addInterest = (rawValue: string) => {
    const next = rawValue.trim();
    if (!next) return;
    if (profile.interests.includes(next)) {
      setInterestDraft("");
      return;
    }
    updateField("interests", [...profile.interests, next]);
    setInterestDraft("");
  };

  const removeInterest = (interest: string) => {
    updateField(
      "interests",
      profile.interests.filter((item) => item !== interest),
    );
  };

  const handleInterestKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addInterest(interestDraft);
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
            Voter Setup
          </span>
          <h1 className="text-4xl font-black tracking-tight" style={headingFontStyle}>
            Build your voter profile.
          </h1>
          <p className="mt-4 max-w-[28rem] text-base leading-relaxed text-slate-500">
            Tailor your ballot information by sharing your priorities.
          </p>
        </div>

        <div className="space-y-6">
          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-lg text-slate-900">
                ☺︎
              </div>
              <div>
                <h2 className="text-lg font-bold" style={headingFontStyle}>
                  Demographics
                </h2>
                <p className="text-xs text-slate-400">General information about you</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <label className="space-y-1.5">
                <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Age Range
                </span>
                <div className="relative group">
                  <select
                    value={profile.age_range}
                    onChange={(event) => updateField("age_range", event.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 transition-all focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/5"
                  >
                    <option value="">Select age range</option>
                    {ageOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-slate-900">
                    ˅
                  </span>
                </div>
              </label>

              <label className="space-y-1.5">
                <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Salary Range
                </span>
                <div className="relative group">
                  <select
                    value={profile.salary_range}
                    onChange={(event) => updateField("salary_range", event.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 transition-all focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/5"
                  >
                    <option value="">Select salary range</option>
                    {salaryOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-slate-900">
                    ˅
                  </span>
                </div>
              </label>

              <label className="space-y-1.5">
                <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Ethnicity
                </span>
                <div className="relative group">
                  <select
                    value={profile.ethnicity}
                    onChange={(event) => updateField("ethnicity", event.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 transition-all focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/5"
                  >
                    <option value="">Select ethnicity</option>
                    {ethnicityOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-slate-900">
                    ˅
                  </span>
                </div>
              </label>

              <label className="space-y-1.5">
                <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Gender
                </span>
                <div className="relative group">
                  <select
                    value={profile.gender}
                    onChange={(event) => updateField("gender", event.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 transition-all focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/5"
                  >
                    <option value="">Select gender</option>
                    {genderOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-slate-900">
                    ˅
                  </span>
                </div>
              </label>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-lg text-slate-900">
                ⌖
              </div>
              <div>
                <h2 className="text-lg font-bold" style={headingFontStyle}>
                  Location
                </h2>
                <p className="text-xs text-slate-400">Where you'll be voting</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <label className="space-y-1.5">
                <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  State
                </span>
                <input
                  type="text"
                  value={profile.state}
                  onChange={(event) => updateField("state", event.target.value)}
                  placeholder="e.g. California"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 transition-all placeholder:text-slate-300 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/5"
                />
              </label>

              <label className="space-y-1.5">
                <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  City
                </span>
                <input
                  type="text"
                  value={profile.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  placeholder="e.g. Los Angeles"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 transition-all placeholder:text-slate-300 focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/5"
                />
              </label>

              <label className="space-y-1.5">
                <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Language
                </span>
                <div className="relative group">
                  <select
                    value={profile.language_preference}
                    onChange={(event) => updateField("language_preference", event.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-900 transition-all focus:border-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-900/5"
                  >
                    {languageOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors group-focus-within:text-slate-900">
                    ˅
                  </span>
                </div>
              </label>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-lg text-slate-900">
                ♡
              </div>
              <div>
                <h2 className="text-lg font-bold" style={headingFontStyle}>
                  Interests & Priorities
                </h2>
                <p className="text-xs text-slate-400">Issues that matter most to you</p>
              </div>
            </div>

            <label className="space-y-1.5">
              <span className="ml-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Focus Areas
              </span>
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 transition-all focus-within:border-slate-900 focus-within:ring-4 focus-within:ring-slate-900/5">
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((interest) => (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => removeInterest(interest)}
                      className="rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-slate-700"
                    >
                      {interest} ×
                    </button>
                  ))}
                  <input
                    type="text"
                    value={interestDraft}
                    onChange={(event) => setInterestDraft(event.target.value)}
                    onKeyDown={handleInterestKeyDown}
                    onBlur={() => addInterest(interestDraft)}
                    placeholder={profile.interests.length ? "Add another focus area" : "Education, housing, transit, climate change..."}
                    className="min-w-[10rem] flex-1 border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-300"
                  />
                </div>
              </div>
            </label>

            <div className="mt-6 flex flex-wrap gap-2">
              {interestOptions.map((interest) => {
                const isSelected = profile.interests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all active:scale-95 ${
                      isSelected
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-900 hover:text-slate-900"
                    }`}
                  >
                    {isSelected ? "✓ " : "+ "}
                    {interest}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex flex-col items-center justify-between gap-6 border-t border-slate-100 pt-8">
            <button
              type="button"
              onClick={() =>
                onChange({
                  id: profile.id,
                  name: "",
                  age_range: "",
                  ethnicity: "",
                  interests: [],
                  salary_range: "",
                  gender: "",
                  state: "",
                  city: "",
                  language_preference: profile.language_preference || "en",
                })
              }
              className="px-4 py-2 text-sm font-bold text-slate-400 transition-colors hover:text-slate-900"
            >
              Clear all fields
            </button>

            <div className="w-full">
              <button
                type="button"
                className="w-full rounded-xl bg-[#0F172A] px-8 py-4 text-sm font-bold tracking-tight text-white shadow-lg shadow-slate-200 transition-all hover:bg-slate-800 active:scale-[0.98]"
              >
                Save Profile & Continue
              </button>
            </div>
          </div>
        </div>

      </main>

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
            className="flex flex-col items-center gap-1 px-4 py-2 text-slate-400 transition-colors hover:text-slate-600"
          >
            <span className="text-xl sm:text-2xl">☑</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.18em]">Ballot</span>
          </button>
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex flex-col items-center gap-1 px-4 py-2 text-[#0F172A]"
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
