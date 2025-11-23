import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { VocabularyApp } from "./components/VocabularyApp";
import "@/assets/pretendard-variable-gov/pretendardvariable-gov-dynamic-subset.css";
import "./global.css";
import { Loader2 } from "lucide-react";

export default function App() {
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
        <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full">
      <Authenticated>
        {loggedInUser ? (
          <VocabularyApp userId={loggedInUser._id} />
        ) : (
          <div className="flex justify-center items-center min-h-[400px]">
            <Loader2 className="w-10 h-10 text-primary-600 animate-spin" />
          </div>
        )}
      </Authenticated>
      <Unauthenticated>
        <div className="flex flex-col items-center justify-center min-h-[400px] px-4">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-primary mb-4">
              English Punch 🥊
            </h1>
            <p className="text-xl text-gray-500">
              Master vocabulary with spaced repetition
            </p>
          </div>
          <div className="w-full max-w-md">
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
    </div>
  );
}
