import { Eye, EyeOff } from "lucide-react";
import AccountSwitcher from "./AccountSwitcher";
import { useAccountSessions } from "@/lib/accountSessionsContext";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "./Button";
import { Input } from "./Input";

const PASSWORD_MIN_LENGTH = 8;
const emptyAccounts: { session: string }[] = [];
const emptySnapshot = () => emptyAccounts;
const noSubscription = () => () => {};

type AuthMode = "signIn" | "signUp";

export default function AuthPage() {
  const { t } = useTranslation();
  const { signIn } = useAuthActions();
  const sessions = useAccountSessions();
  const savedAccounts = useSyncExternalStore<{ session: string }[]>(
    sessions?.subscribe ?? noSubscription,
    sessions?.getSnapshot ?? emptySnapshot
  );
  const hasSavedAccounts = savedAccounts.length > 0;
  const addingAccount =
    hasSavedAccounts &&
    !savedAccounts.some((account) => account.session === sessions?.session);
  const [showPassword, setShowPassword] = useState(false);
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
      const result = await signIn("password", formData);
      if (!result.signingIn) {
        setError(t("auth.errors.signInFailed"));
        return;
      }
      toast.success(
        isSignUp ? t("auth.signUpSuccess") : t("auth.signInSuccess")
      );
    } catch (submitError) {
      console.error(`${isSignUp ? "Sign-up" : "Sign-in"} error:`, submitError);
      setError(
        isSignUp ? t("auth.errors.signUpFailed") : t("auth.errors.signInFailed")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode(isSignUp ? "signIn" : "signUp");
    setShowPassword(false);
    setError(null);
    setPassword("");
    setPasswordConfirm("");
  };

  return (
    <main className="flex min-h-dvh items-center bg-gray-50 px-5 py-12 sm:py-16">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 space-y-3">
          <p className="text-primary-700 mb-8 text-lg font-bold tracking-tight">
            English Punch<span aria-hidden="true">.</span>
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900">
            {isSignUp
              ? t("auth.signUpTitle")
              : addingAccount
                ? t("accounts.add")
                : t("auth.signInTitle")}
          </h1>
          <p className="text-sm leading-6 text-gray-600">
            {addingAccount
              ? t("accounts.addDescription")
              : t("auth.description")}
          </p>
        </div>

        <div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-gray-700"
                htmlFor="email"
              >
                {t("common.labels.email")}
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                className="h-12 bg-white"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (error) {
                    setError(null);
                  }
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
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  className="h-12 bg-white pr-12"
                  minLength={isSignUp ? PASSWORD_MIN_LENGTH : undefined}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) {
                      setError(null);
                    }
                  }}
                  required
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="focus-visible:outline-primary-500 absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-gray-500 hover:text-gray-900 focus-visible:outline-2"
                  aria-label={t(
                    showPassword ? "auth.hidePassword" : "auth.showPassword"
                  )}
                  aria-pressed={showPassword}
                  disabled={isSubmitting}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden />
                  ) : (
                    <Eye size={18} aria-hidden />
                  )}
                </button>
              </div>
              {isSignUp && (
                <p className="text-xs text-gray-500">
                  {t("auth.passwordHint")}
                </p>
              )}
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <label
                  className="text-sm font-medium text-gray-700"
                  htmlFor="password-confirm"
                >
                  {t("auth.confirmPasswordLabel")}
                </label>
                <Input
                  id="password-confirm"
                  name="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  className="h-12 bg-white"
                  minLength={PASSWORD_MIN_LENGTH}
                  value={passwordConfirm}
                  onChange={(event) => {
                    setPasswordConfirm(event.target.value);
                    if (error) {
                      setError(null);
                    }
                  }}
                  required
                  disabled={isSubmitting}
                  aria-invalid={hasPasswordMismatch}
                />
              </div>
            )}

            <p
              className="text-sm text-red-600 empty:hidden"
              role="alert"
              aria-live="polite"
            >
              {errorMessage ?? ""}
            </p>

            <Button
              type="submit"
              fullWidth
              className="h-12"
              loading={isSubmitting}
              disabled={!canSubmit}
            >
              {isSignUp
                ? t("common.actions.signUp")
                : t("common.actions.signIn")}
            </Button>
          </form>
          <div className="mt-5 flex items-center justify-center gap-1 text-sm text-gray-600">
            <span>{t(isSignUp ? "auth.haveAccount" : "auth.newHere")}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isSubmitting}
              onClick={toggleMode}
            >
              {isSignUp ? t("auth.switchToSignIn") : t("auth.switchToSignUp")}
            </Button>
          </div>
          {hasSavedAccounts && (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <AccountSwitcher user={null} disabled={isSubmitting} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
