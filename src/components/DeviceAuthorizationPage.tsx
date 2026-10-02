import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import AccountSwitcher from "./AccountSwitcher";
import DeviceAuthorizationView from "./DeviceAuthorizationView";

export default function DeviceAuthorizationPage({
  email,
  user,
}: {
  email?: string;
  user?: { _id: string; email?: string };
}) {
  const decide = useMutation(api.oauthDevice.decide);
  const [code, setCode] = useState(() => {
    const values = new URLSearchParams(window.location.search).getAll(
      "user_code"
    );
    return values.length === 1 ? values[0].slice(0, 16) : "";
  });
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<"approved" | "denied" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submit = async (approved: boolean) => {
    setPending(true);
    setError(null);
    try {
      const response = await decide({ userCode: code, approved });
      if (response === "approved" || response === "denied") {
        setResult(response);
      } else {
        setError(
          response === "slow_down"
            ? "Too many attempts. Wait a minute before trying again."
            : "This code is invalid, expired, or already used. Start a new CLI login."
        );
      }
    } catch {
      setError(
        "Could not submit your decision. Check your connection and try again."
      );
    } finally {
      setPending(false);
    }
  };
  return (
    <DeviceAuthorizationView
      accountSwitcher={
        user && !result ? (
          <AccountSwitcher user={user} disabled={pending} />
        ) : undefined
      }
      email={email}
      code={code}
      onCodeChange={(value) => {
        setCode(value);
        const url = new URL(window.location.href);
        url.searchParams.set("user_code", value);
        window.history.replaceState({}, "", url);
      }}
      pending={pending}
      result={result}
      error={error}
      onDecision={(approved) => void submit(approved)}
    />
  );
}
