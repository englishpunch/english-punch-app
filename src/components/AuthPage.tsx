import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "./Button";

const PASSWORD_MIN_LENGTH = 8;

type AuthMode = "signIn" | "signUp";

export default function AuthPage() {
  const { t } = useTranslation();
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignUp = mode === "signUp";
  const trimmedEmail = email.trim();
  const hasPasswordMismatch =
    isSignUp && passwordConfirm.length > 0 && password !== passwordConfirm;
  const validationMessage = hasPasswordMismatch
    ? t("auth.errors.passwordMismatch")
    : null;
  const errorMessage = error ?? validationMessage;
  const canSubmit =
    trimmedEmail.length > 0 &&
    password.length > 0 &&
    (!isSignUp || passwordConfirm.length > 0) &&
    !hasPasswordMismatch &&
    !isSubmitting;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const submit = async () => {
    setError(null);

    if (isSignUp && password !== passwordConfirm) {
      setError(t("auth.errors.passwordMismatch"));
      return;
    }

    const formData = new FormData();
    formData.set("email", trimmedEmail);
    formData.set("password", password);
    formData.set("flow", isSignUp ? "signUp" : "signIn");

    setIsSubmitting(true);
    try {
      await signIn("password", formData);
      toast.success(
        isSignUp ? t("auth.signUpSuccess") : t("auth.signInSuccess")
      );
    } catch (submitError) {
      console.error(
        `${isSignUp ? "Sign-up" : "Sign-in"} error:`,
        submitError
      );
      setError(
        isSignUp ? t("auth.errors.signUpFailed") : t("auth.errors.signInFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode(isSignUp ? "signIn" : "signUp");
    setError(null);
    setPassword("");
    setPasswordConfirm("");
  };

  return (
    <div className="min-h-screen bg-white px-4 py-16">
      <div className="mx-auto w-full max-w-md space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">
            English Punch
          </p>
          <h1 className="text-3xl font-semibold text-gray-900">
            {t("auth.title")}
          </h1>
          <p className="text-base leading-6 text-gray-600">
            {t("auth.description")}
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {isSignUp ? t("auth.signUpTitle") : t("auth.signInTitle")}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-11"
              onClick={toggleMode}
            >
              {isSignUp ? t("auth.switchToSignIn") : t("auth.switchToSignUp")}
            </Button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="email">
                {t("common.labels.email")}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className="auth-input-field h-11"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) setError(null);
                }}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium text-gray-700"
                htmlFor="password"
              >
                {t("common.labels.password")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                className="auth-input-field h-11"
                minLength={isSignUp ? PASSWORD_MIN_LENGTH : undefined}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError(null);
                }}
                required
                disabled={isSubmitting}
              />
              <p className="text-xs text-gray-500">
                {t("auth.passwordHint")}
              </p>
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-gray-700"
                  htmlFor="password-confirm"
                >
                  {t("auth.confirmPasswordLabel")}
                </label>
                <input
                  id="password-confirm"
                  name="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  className="auth-input-field h-11"
                  minLength={PASSWORD_MIN_LENGTH}
                  value={passwordConfirm}
                  onChange={(event) => {
                    setPasswordConfirm(event.target.value);
                    if (error) setError(null);
                  }}
                  required
                  disabled={isSubmitting}
                  aria-invalid={hasPasswordMismatch}
                />
              </div>
            )}

            <p
              className="min-h-6 text-sm text-red-600"
              role="alert"
              aria-live="polite"
            >
              {errorMessage ?? ""}
            </p>

            <Button
              type="submit"
              fullWidth
              className="h-11"
              disabled={!canSubmit}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {t("auth.submitting")}
                </>
              ) : (
                <>{isSignUp ? t("common.actions.signUp") : t("common.actions.signIn")}</>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
