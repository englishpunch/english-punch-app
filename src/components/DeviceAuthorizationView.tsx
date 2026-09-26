import { Button } from "./Button";

export default function DeviceAuthorizationView({
  email,
  code,
  onCodeChange,
  pending,
  result,
  error,
  onDecision,
}: {
  email?: string;
  code: string;
  onCodeChange: (code: string) => void;
  pending: boolean;
  result: "approved" | "denied" | null;
  error: string | null;
  onDecision: (approved: boolean) => void;
}) {
  const valid = /^[A-HJ-NP-Z2-9]{8}$/.test(
    code.toUpperCase().replace(/[-\s]/g, "")
  );
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-16">
      <section className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-2 text-center">
          <p className="text-primary-600 text-sm font-semibold tracking-wide uppercase">
            English Punch
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">
            {result === "approved"
              ? "CLI connected"
              : result === "denied"
                ? "Access denied"
                : "Connect English Punch CLI"}
          </h1>
        </div>
        {result ? (
          <p role="status" className="text-sm leading-6 text-gray-600">
            {result === "approved"
              ? "Your CLI can now access your account. Return to your terminal to finish signing in."
              : "You denied this login. No access was granted. You can close this page."}
          </p>
        ) : (
          <>
            <p className="text-sm leading-6 text-gray-600">
              Signed in as{" "}
              <strong>{email ?? "your English Punch account"}</strong>. The CLI
              will be able to read and manage your bags, cards, and reviews.
            </p>
            <p className="rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-700">
              Only approve a login you started. Check that this code matches the
              one shown in your terminal.
            </p>
            <div className="space-y-2">
              <label
                htmlFor="device-code"
                className="block text-sm font-medium text-gray-900"
              >
                One-time code
              </label>
              <input
                id="device-code"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={16}
                value={code}
                onChange={(event) =>
                  onCodeChange(event.target.value.toUpperCase())
                }
                disabled={pending}
                placeholder="ABCD-EFGH"
                className="focus:border-primary-500 focus:ring-primary-200 w-full rounded-lg border border-gray-300 px-3 py-3 text-center font-mono text-xl tracking-widest focus:ring-2 focus:outline-none"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !valid}
                onClick={() => onDecision(false)}
              >
                Deny
              </Button>
              <Button
                type="button"
                loading={pending}
                disabled={pending || !valid}
                onClick={() => onDecision(true)}
              >
                Allow access
              </Button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
