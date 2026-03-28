type ProfilePageProps = {
  profile: UserProfile;
  onChange: (profile: UserProfile) => void;
  onOpenProfile: () => void;
  onOpenHome: () => void;
};

export type UserProfile = {
  age: string;
  ethnicity: string;
  interests: string;
  salary: string;
  gender: string;
  state: string;
  city: string;
};

const fields: Array<{
  id: keyof UserProfile;
  label: string;
  placeholder: string;
  type?: string;
}> = [
  { id: "age", label: "Age", placeholder: "Enter your age", type: "number" },
  { id: "ethnicity", label: "Ethnicity", placeholder: "How do you identify?" },
  {
    id: "interests",
    label: "Interests",
    placeholder: "Education, housing, transit, climate...",
  },
  { id: "salary", label: "Salary", placeholder: "Annual income", type: "number" },
  { id: "gender", label: "Gender", placeholder: "Enter your gender" },
  { id: "state", label: "State", placeholder: "State for voting information" },
  { id: "city", label: "City", placeholder: "City for voting information" },
];

export default function ProfilePage({
  profile,
  onChange,
  onOpenProfile,
  onOpenHome,
}: ProfilePageProps) {
  const updateField = (field: keyof UserProfile, value: string) => {
    onChange({
      ...profile,
      [field]: value,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white shadow-2xl">
        <div className="bg-gradient-to-b from-blue-700 via-blue-600 to-cyan-500 px-6 pb-8 pt-8 text-white">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100">Your voter profile</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Profile setup</h1>
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
            <p className="text-sm font-medium text-blue-100">Tell us about you</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight">
              Personalize voting guidance around your community and priorities.
            </h2>
            <p className="mt-3 text-sm leading-6 text-blue-50">
              This profile is a simple starting point for tailoring ballot information by location
              and issues that matter to you.
            </p>
          </div>
        </div>

        <div className="-mt-4 px-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Profile details
                </p>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">
                  Fill out your voter snapshot
                </h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  You can update these details any time as we build out the rest of the app.
                </p>
              </div>
              <div className="rounded-2xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                7 fields
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {fields.map((field) => (
                <label key={field.id} className="block">
                  <span className="mb-2 block text-sm font-semibold text-slate-900">
                    {field.label}
                  </span>
                  <input
                    type={field.type ?? "text"}
                    value={profile[field.id]}
                    onChange={(event) => updateField(field.id, event.target.value)}
                    placeholder={field.placeholder}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:scale-[1.01]">
                Save profile
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    age: "",
                    ethnicity: "",
                    interests: "",
                    salary: "",
                    gender: "",
                    state: "",
                    city: "",
                  })
                }
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Clear form
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 pb-24 pt-6">
          <div className="rounded-3xl bg-emerald-50 p-5 ring-1 ring-emerald-100">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-emerald-700">Why this helps</p>
                <h4 className="mt-1 text-lg font-semibold text-slate-900">
                  Location and priorities shape what appears on your ballot
                </h4>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  City and state help us focus voting information. Interests and demographics can
                  later help explain community impact in more relevant terms.
                </p>
              </div>
              <div className="rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm">
                Draft
              </div>
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
          <button type="button" className="flex flex-col items-center gap-1 text-xs text-slate-500">
            <span className="text-lg">🗂️</span>
            Ballot
          </button>
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex flex-col items-center gap-1 text-xs font-semibold text-blue-600"
          >
            <span className="text-lg">👤</span>
            Profile
          </button>
        </div>
      </div>
    </div>
  );
}
