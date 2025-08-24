import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Dashboard } from "./Dashboard";
import { StudySession } from "./StudySession";
import { WordLists } from "./WordLists";
import { Progress } from "./Progress";
import DeckManager from "./DeckManager";

type View = "dashboard" | "study" | "lists" | "progress" | "fsrs";

export function VocabularyApp() {
  const [currentView, setCurrentView] = useState<View>("dashboard");
  const [studyMode, setStudyMode] = useState<"flashcards" | "quiz" | "spelling" | "definition_match">("flashcards");
  const [selectedWordListId, setSelectedWordListId] = useState<string | null>(null);

  const loggedInUser = useQuery(api.auth.loggedInUser);
  const userStats = useQuery(api.studySessions.getUserStats);

  const renderView = () => {
    switch (currentView) {
      case "dashboard":
        return (
          <Dashboard
            onStartStudy={(mode, wordListId) => {
              setStudyMode(mode);
              setSelectedWordListId(wordListId || null);
              setCurrentView("study");
            }}
            onViewLists={() => setCurrentView("lists")}
            onViewProgress={() => setCurrentView("progress")}
            onStartFSRS={() => setCurrentView("fsrs")}
          />
        );
      case "study":
        return (
          <StudySession
            mode={studyMode}
            wordListId={selectedWordListId}
            onComplete={() => setCurrentView("dashboard")}
            onBack={() => setCurrentView("dashboard")}
          />
        );
      case "lists":
        return (
          <WordLists
            onBack={() => setCurrentView("dashboard")}
            onStartStudy={(mode, wordListId) => {
              setStudyMode(mode);
              setSelectedWordListId(wordListId || null);
              setCurrentView("study");
            }}
          />
        );
      case "progress":
        return (
          <Progress
            onBack={() => setCurrentView("dashboard")}
          />
        );
      case "fsrs":
        return (
          <DeckManager
            userId={loggedInUser?._id || ""}
            onBack={() => setCurrentView("dashboard")}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      {renderView()}
    </div>
  );
}
