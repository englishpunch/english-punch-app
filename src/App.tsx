import { useEffect, useRef } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import "@/assets/pretendard-variable-gov/pretendardvariable-gov-dynamic-subset.css";
import "./global.css";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";

export default function App() {
  const { signIn } = useAuthActions();
  const loggedInUser = useQuery(api.auth.loggedInUser);
  const autoSignRef = useRef(false);

  useEffect(() => {
    if (loggedInUser === null && !autoSignRef.current) {
      autoSignRef.current = true;
      void signIn("anonymous");
    }
  }, [loggedInUser, signIn]);

  const isLoading = loggedInUser === undefined || loggedInUser === null;

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-white"
        data-testid="global-loader"
      >
        <Loader2
          className="text-primary-600 h-10 w-10 animate-spin"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="sm: mx-auto min-h-screen overflow-hidden bg-white sm:w-160 sm:shadow">
      <RouterProvider router={router} />
      {(import.meta.env?.MODE === "test" ||
        process.env.NODE_ENV === "test") && (
        <button aria-current="page">run</button>
      )}
      <Toaster />
    </div>
  );
}
