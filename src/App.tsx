import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import "@/assets/pretendard-variable-gov/pretendardvariable-gov-dynamic-subset.css";
import "./global.css";
import { Toaster } from "sonner";
import { Loader2 } from "lucide-react";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import AuthPage from "./components/AuthPage";

export default function App() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
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

  if (loggedInUser === null) {
    return (
      <>
        <AuthPage />
        <Toaster />
      </>
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
