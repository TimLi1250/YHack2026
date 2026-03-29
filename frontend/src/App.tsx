import { useState } from "react";
import BallotPage from "./ballot";
import CongressPage from "./congress";
import ExplorePage from "./explore";
import VotingAssistantHomepage from "./homepage";
import ProfilePage, { type UserProfile } from "./profile";

type Screen = "home" | "explore" | "ballot" | "congress" | "profile";

const initialProfile: UserProfile = {
  name: "",
  age_range: "",
  ethnicity: "",
  interests: [],
  salary_range: "",
  gender: "",
  state: "",
  city: "",
  street_address: "",
  language_preference: "en",
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [initialExplorePrompt, setInitialExplorePrompt] = useState("");

  function openExploreWithPrompt(prompt: string) {
    setInitialExplorePrompt(prompt);
    setScreen("explore");
  }

  return screen === "home" ? (
    <VotingAssistantHomepage
      profile={profile}
      onOpenProfile={() => setScreen("profile")}
      onOpenExplore={() => setScreen("explore")}
      onOpenExploreWithPrompt={openExploreWithPrompt}
      onOpenBallot={() => setScreen("ballot")}
      onOpenCongress={() => setScreen("congress")}
      onOpenHome={() => setScreen("home")}
    />
  ) : screen === "explore" ? (
    <ExplorePage
      profile={profile}
      initialPrompt={initialExplorePrompt}
      onPromptConsumed={() => setInitialExplorePrompt("")}
      onOpenProfile={() => setScreen("profile")}
      onOpenExplore={() => setScreen("explore")}
      onOpenBallot={() => setScreen("ballot")}
      onOpenCongress={() => setScreen("congress")}
      onOpenHome={() => setScreen("home")}
    />
  ) : screen === "ballot" ? (
    <BallotPage
      profile={profile}
      onOpenProfile={() => setScreen("profile")}
      onOpenExplore={() => setScreen("explore")}
      onOpenBallot={() => setScreen("ballot")}
      onOpenCongress={() => setScreen("congress")}
      onOpenHome={() => setScreen("home")}
    />
  ) : screen === "congress" ? (
    <CongressPage
      profile={profile}
      onOpenProfile={() => setScreen("profile")}
      onOpenExplore={() => setScreen("explore")}
      onOpenBallot={() => setScreen("ballot")}
      onOpenCongress={() => setScreen("congress")}
      onOpenHome={() => setScreen("home")}
    />
  ) : (
    <ProfilePage
      profile={profile}
      onChange={setProfile}
      onOpenProfile={() => setScreen("profile")}
      onOpenExplore={() => setScreen("explore")}
      onOpenBallot={() => setScreen("ballot")}
      onOpenCongress={() => setScreen("congress")}
      onOpenHome={() => setScreen("home")}
    />
  );
}
