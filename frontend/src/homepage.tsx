import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";

const ageOptions = [
  "Under 18",
  "18-24",
  "25-34",
  "35-44",
  "45-54",
  "55-64",
  "65+",
];

const salaryOptions = [
  "Under $25k",
  "$25k-$50k",
  "$50k-$100k",
  "$100k-$200k",
  "$200k+",
  "Prefer not to say",
];

const genderOptions = [
  "Male",
  "Female",
  "Nonbinary",
  "Other",
  "Prefer not to say",
];

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

const defaultFormState = {
  name: "",
  age_range: "",
  ethnicity: "",
  interests: "",
  salary_range: "",
  gender: "",
  state: "",
  city: "",
  language_preference: "en",
};

interface UserRecord {
  id: string;
  name?: string | null;
  age_range?: string | null;
  ethnicity?: string | null;
  interests?: string[];
  salary_range?: string | null;
  gender?: string | null;
  state: string;
  city: string;
  language_preference: string;
  derived_traits?: string[];
  updated_at?: string;
}

interface UserFormState {
  name: string;
  age_range: string;
  ethnicity: string;
  interests: string;
  salary_range: string;
  gender: string;
  state: string;
  city: string;
  language_preference: string;
}

export default function VotingAssistantHomepage() {
  const [activeTab, setActiveTab] = useState<"home" | "profile">("home");
  const [user, setUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserFormState>(defaultFormState);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadUser();
  }, []);

  async function loadUser() {
    setLoading(true);
    try {
      const response = await fetch("/users");
      if (!response.ok) {
        throw new Error("Could not load users from the server.");
      }

      const users = await response.json();
      let currentUser: UserRecord | null = Array.isArray(users) && users.length ? users[0] : null;

      if (!currentUser) {
        const createResponse = await fetch("/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state: "California", city: "San Francisco" }),
        });
        if (!createResponse.ok) {
          throw new Error("Could not create a default profile.");
        }
        currentUser = await createResponse.json();
      }

      setUser(currentUser);
      setForm(mapUserToForm(currentUser));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error loading profile.";
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  }

  function mapUserToForm(user: UserRecord): UserFormState {
    return {
      name: user.name ?? "",
      age_range: user.age_range ?? "",
      ethnicity: user.ethnicity ?? "",
      interests: (user.interests ?? []).join(", "),
      salary_range: user.salary_range ?? "",
      gender: user.gender ?? "",
      state: user.state ?? "",
      city: user.city ?? "",
      language_preference: user.language_preference ?? "en",
    };
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) {
      setStatusMessage("No user selected to update.");
      return;
    }

    setLoading(true);
    try {
      const interestsArray = form.interests
        .split(/[,;]+/)
        .map((item) => item.trim())
        .filter(Boolean);

      const payload = {
        ...form,
        interests: interestsArray,
      };

      const response = await fetch(`/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Unable to save profile updates.");
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      setForm(mapUserToForm(updatedUser));
      setStatusMessage("Profile saved successfully.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error saving profile.";
      setStatusMessage(message);
    } finally {
      setLoading(false);
      window.setTimeout(() => setStatusMessage(""), 3500);
    }
  }

  const isProfileTab = activeTab === "profile";

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
              {isProfileTab ? "Manage your profile data." : "Understand your ballot in clear, simple language."}
            </h2>
            <p className="mt-3 text-sm leading-6 text-blue-50">
              {isProfileTab
                ? "Update your name, location, interests, and voting preferences here. Changes are saved to the backend profile data."
                : "Get trusted voting information, personalized guidance, and community-focused explanations in minutes."}
            </p>
          </div>
        </div>

        <div className="-mt-4 px-6 pb-6">
          {isProfileTab ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                    Profile settings
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-slate-900">Edit your personal data</h3>
                </div>
                <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
                  {user?.updated_at ? "Updated" : "New"}
                </div>
              </div>

              {statusMessage ? (
                <div className="mb-4 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                  {statusMessage}
                </div>
              ) : null}

              <form onSubmit={saveProfile} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Name</span>
                    <input
                      name="name"
                      value={form.name}
                      onChange={handleInputChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                      placeholder="Your name"
                    />
                  </label>

                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Location</span>
                    <div className="mt-2 grid gap-3 sm:grid-cols-2">
                      <input
                        name="city"
                        value={form.city}
                        onChange={handleInputChange}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                        placeholder="City"
                      />
                      <input
                        name="state"
                        value={form.state}
                        onChange={handleInputChange}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                        placeholder="State"
                      />
                    </div>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Age range</span>
                    <select
                      name="age_range"
                      value={form.age_range}
                      onChange={handleInputChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select age range</option>
                      {ageOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Salary range</span>
                    <select
                      name="salary_range"
                      value={form.salary_range}
                      onChange={handleInputChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select salary range</option>
                      {salaryOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Gender</span>
                    <select
                      name="gender"
                      value={form.gender}
                      onChange={handleInputChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select gender</option>
                      {genderOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold text-slate-700">Ethnicity</span>
                    <select
                      name="ethnicity"
                      value={form.ethnicity}
                      onChange={handleInputChange}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">Select ethnicity</option>
                      {ethnicityOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Interests</span>
                  <textarea
                    name="interests"
                    value={form.interests}
                    onChange={handleInputChange}
                    className="mt-2 h-24 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                    placeholder="Add comma-separated interests, e.g. Taxes, Housing, Education"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Language preference</span>
                  <input
                    name="language_preference"
                    value={form.language_preference}
                    onChange={handleInputChange}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                    placeholder="en"
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Saving..." : "Save Profile"}
                </button>
              </form>

              {user?.derived_traits?.length ? (
                <div className="mt-6 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-800">Current profile traits</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {user.derived_traits.map((trait) => (
                      <li key={trait}>{trait}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <>
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

              <div className="mt-6 rounded-3xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">Impact mode</p>
                    <h4 className="mt-1 text-lg font-semibold text-slate-900">
                      Explore what matters to your community
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-slate-700">
                      View ballot measures through lenses like students, renters, families, and public transit users.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm">
                    New
                  </div>
                </div>
                <button className="mt-4 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.01]">
                  Try community impact view
                </button>
              </div>
            </>
          )}
        </div>

        <div className="fixed bottom-0 mx-auto flex w-full max-w-md items-center justify-around border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-1 text-xs font-semibold ${isProfileTab ? "text-slate-500" : "text-blue-600"}`}
          >
            <span className="text-lg">🏠</span>
            Home
          </button>
          <button type="button" className="flex flex-col items-center gap-1 text-xs text-slate-500">
            <span className="text-lg">🔎</span>
            Explore
          </button>
          <button type="button" className="flex flex-col items-center gap-1 text-xs text-slate-500">
            <span className="text-lg">🗂️</span>
            Ballot
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col items-center gap-1 text-xs font-semibold ${isProfileTab ? "text-blue-600" : "text-slate-500"}`}
          >
            <span className="text-lg">👤</span>
            Profile
          </button>
        </div>
      </div>
    </div>
  );
}
