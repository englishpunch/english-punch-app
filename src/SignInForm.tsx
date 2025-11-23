"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./components/Button";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="w-full bg-white border border-gray-200 rounded-lg shadow p-6 space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-semibold text-gray-900">
          {flow === "signIn" ? "Welcome back" : "Create your account"}
        </h2>
        <p className="text-sm text-gray-600 leading-5">
          Use your email and a password to continue. You can explore quickly with the anonymous option below.
        </p>
      </div>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData).catch((error) => {
            let toastTitle = "";
            if (error.message.includes("Invalid password")) {
              toastTitle = "Invalid password. Please try again.";
            } else {
              toastTitle =
                flow === "signIn"
                  ? "Could not sign in, did you mean to sign up?"
                  : "Could not sign up, did you mean to sign in?";
            }
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            className="auth-input-field"
            type="email"
            name="email"
            placeholder="name@example.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            className="auth-input-field"
            type="password"
            name="password"
            placeholder="At least 8 characters"
            required
            autoComplete={flow === "signUp" ? "new-password" : "current-password"}
          />
          <p className="text-xs text-gray-500">Use 8+ characters with letters and numbers.</p>
        </div>

        <Button fullWidth type="submit" disabled={submitting}>
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </Button>

        <div className="text-center text-sm text-gray-600">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-1 font-semibold text-primary-700 hover:underline"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </Button>
        </div>
      </form>
      <div className="flex items-center justify-center my-3">
        <hr className="my-4 grow border-gray-200" />
        <span className="mx-4 text-gray-500">or</span>
        <hr className="my-4 grow border-gray-200" />
      </div>
      <Button fullWidth onClick={() => void signIn("anonymous")} type="button">
        Explore anonymously
      </Button>
    </div>
  );
}
