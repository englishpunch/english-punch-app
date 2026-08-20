import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import OAuthConsentView from "./OAuthConsentView";

type AuthorizationRequest = {
  responseType: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  scope: string;
  state?: string;
  codeChallenge: string;
  codeChallengeMethod: string;
};

const readSingle = (search: URLSearchParams, name: string) => {
  const values = search.getAll(name);
  return values.length === 1 && values[0].length > 0 ? values[0] : null;
};

const parseOAuthAuthorizationRequest = (
  searchString: string
): AuthorizationRequest | null => {
  const search = new URLSearchParams(searchString);
  const responseType = readSingle(search, "response_type");
  const clientId = readSingle(search, "client_id");
  const redirectUri = readSingle(search, "redirect_uri");
  const resource = readSingle(search, "resource");
  const scope = readSingle(search, "scope");
  const codeChallenge = readSingle(search, "code_challenge");
  const codeChallengeMethod = readSingle(search, "code_challenge_method");
  const stateValues = search.getAll("state");

  if (
    !responseType ||
    !clientId ||
    !redirectUri ||
    !resource ||
    !scope ||
    !codeChallenge ||
    !codeChallengeMethod ||
    stateValues.length > 1
  ) {
    return null;
  }

  return {
    responseType,
    clientId,
    redirectUri,
    resource,
    scope,
    ...(stateValues[0] ? { state: stateValues[0] } : {}),
    codeChallenge,
    codeChallengeMethod,
  };
};

export default function OAuthConsentPage() {
  const completeAuthorization = useAction(
    api.oauthActions.completeAuthorization
  );
  const [request] = useState(() =>
    parseOAuthAuthorizationRequest(window.location.search)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!request) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <p className="rounded-xl bg-white p-6 text-sm text-red-600 shadow-sm">
          This OAuth authorization request is invalid.
        </p>
      </main>
    );
  }

  const decide = async (approved: boolean) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const redirect = await completeAuthorization({ approved, ...request });
      window.location.assign(redirect);
    } catch (authorizationError) {
      console.error("OAuth authorization failed", authorizationError);
      setError("The ChatGPT connection could not be authorized.");
      setIsSubmitting(false);
    }
  };

  return (
    <OAuthConsentView
      scopes={request.scope.split(/\s+/).filter(Boolean)}
      isSubmitting={isSubmitting}
      error={error}
      onDecision={(approved) => void decide(approved)}
    />
  );
}
