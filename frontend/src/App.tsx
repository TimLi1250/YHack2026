import { useState } from "react";
import BallotPage from "./ballot";
import VotingAssistantHomepage from "./homepage";
import ProfilePage, { type UserProfile } from "./profile";

type Screen = "home" | "ballot" | "profile";

const initialProfile: UserProfile = {
  age: "",
  ethnicity: "",
  interests: "",
  salary: "",
  gender: "",
  state: "",
  city: "",
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [profile, setProfile] = useState<UserProfile>(initialProfile);

  return screen === "home" ? (
    <VotingAssistantHomepage
      onOpenProfile={() => setScreen("profile")}
      onOpenBallot={() => setScreen("ballot")}
      onOpenHome={() => setScreen("home")}
    />
  ) : screen === "ballot" ? (
    <BallotPage
      profile={profile}
      onOpenProfile={() => setScreen("profile")}
      onOpenBallot={() => setScreen("ballot")}
      onOpenHome={() => setScreen("home")}
    />
  ) : (
    <ProfilePage
      profile={profile}
      onChange={setProfile}
      onOpenProfile={() => setScreen("profile")}
      onOpenBallot={() => setScreen("ballot")}
      onOpenHome={() => setScreen("home")}
    />
  );
}
