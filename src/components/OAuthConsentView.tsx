import { Button } from "./Button";
import { Check } from "lucide-react";

const SCOPE_LABELS: Record<string, string> = {
  "profile:read": "Read your basic English Punch profile",
  "bags:read": "View your vocabulary bags",
  "bags:write": "Create and delete vocabulary bags",
  "cards:read": "Read your vocabulary cards",
  "cards:write": "Create, update, and delete vocabulary cards",
  "reviews:read": "View review status and history",
  "reviews:write": "Run and rate vocabulary reviews",
};

export default function OAuthConsentView({
  scopes,
  isSubmitting,
  error,
  onDecision,
}: {
  scopes: string[];
  isSubmitting: boolean;
  error: string | null;
  onDecision: (approved: boolean) => void;
}) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <section className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <p className="text-primary-600 text-sm font-semibold tracking-wide uppercase">
            English Punch
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">
            Connect ChatGPT
          </h1>
          <p className="text-sm leading-6 text-gray-600">
            ChatGPT is requesting access to your English Punch account.
          </p>
        </div>

        <ul className="space-y-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-700">
          {scopes.map((scope) => (
            <li key={scope} className="flex gap-2">
              <Check className="h-4 w-4 shrink-0" aria-hidden />
              <span>{SCOPE_LABELS[scope] ?? scope}</span>
            </li>
          ))}
        </ul>

        <p className="text-xs leading-5 text-gray-500">
          English Punch will issue a short-lived token. ChatGPT will not receive
          your password.
        </p>

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={isSubmitting}
            onClick={() => onDecision(false)}
          >
            Deny
          </Button>
          <Button
            type="button"
            loading={isSubmitting}
            onClick={() => onDecision(true)}
          >
            Allow access
          </Button>
        </div>
      </section>
    </main>
  );
}
