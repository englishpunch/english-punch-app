import { Authenticated, Unauthenticated, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { VocabularyApp } from "./components/VocabularyApp";
import { useEffect } from "react";
import "@/assets/pretendard-variable-gov/pretendardvariable-gov-dynamic-subset.css";
import "./global.css";

export default function App() {
  const initializeStats = useMutation(api.studySessions.initializeUserStats);
  const loggedInUser = useQuery(api.auth.loggedInUser);

  useEffect(() => {
    if (loggedInUser) {
      initializeStats().then(() => {
        console.log("User stats initialized");
      }).catch((err) => {
        console.error("Failed to initialize user stats:", err);
      });
    }
  }, [loggedInUser, initializeStats]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm h-16 flex justify-between items-center border-b shadow-sm px-4">
        <h2 className="text-xl font-semibold text-primary">English Punch</h2>
        <Authenticated>
          <SignOutButton />
        </Authenticated>
      </header>
      <main className="flex-1">
        <Content />
      </main>
      <Toaster />
    </div>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Authenticated>
        <VocabularyApp />
      </Authenticated>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-[400px] px-4">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-primary mb-4">English Punch</h1>
            <p className="text-xl text-secondary">Master vocabulary with spaced repetition</p>
          </div>
          <div className="w-full max-w-md">
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
    </div>
  );
}
