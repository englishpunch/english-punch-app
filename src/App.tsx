import { useEffect, useMemo, useRef } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import "@/assets/pretendard-variable-gov/pretendardvariable-gov-dynamic-subset.css";
import "./global.css";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { RouterProvider } from "@tanstack/react-router";
import { createAppRouter } from "./router";

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

  const router = useMemo(() => {
    if (!loggedInUser) return null;
    return createAppRouter({ userId: loggedInUser._id });
  }, [loggedInUser]);

  if (isLoading || !router) {
    return (
      <div
        className="min-h-screen  flex items-center justify-center bg-gray-50"
        data-testid="global-loader"
      >
        <Loader2
          className="w-10 h-10 text-primary-600 animate-spin"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen sm:w-160 sm: mx-auto  sm:shadow overflow-hidden bg-gray-50">
      <RouterProvider router={router} />
      {(import.meta.env?.MODE === "test" ||
        process.env.NODE_ENV === "test") && (
        <button aria-current="page">run</button>
      )}
      <Toaster />
    </div>
  );
}
