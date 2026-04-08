import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex-generated/api.js";
import type { Id } from "./convex-generated/dataModel.js";

const CONVEX_URL =
  process.env.CONVEX_URL ?? "https://strong-otter-914.convex.cloud";

let cachedClient: ConvexHttpClient | null = null;
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
let cachedUserId: Id<"users"> | null = null;

export function getUserId(): Id<"users"> {
  if (!cachedUserId) {
    throw new Error("getUserId() called before authentication.");
  }
  return cachedUserId;
}

export async function getConvexClient(): Promise<ConvexHttpClient> {
  if (cachedClient) {
    return cachedClient;
  }

  const email = process.env.CONVEX_USER_EMAIL;
  if (!email) {
    throw new Error("CONVEX_USER_EMAIL environment variable is required.");
  }

  const password = process.env.CONVEX_USER_PASSWORD;
  if (!password) {
    throw new Error("CONVEX_USER_PASSWORD environment variable is required.");
  }

  const client = new ConvexHttpClient(CONVEX_URL);

  // Authenticate as a real user via the Password provider.
  // This calls the same signIn action the web app uses.
  const result = await client.action(api.auth.signIn, {
    provider: "password",
    params: { email, password, flow: "signIn" },
  });

  // result contains { tokens?: { token, refreshToken } }
  // Set the JWT so all subsequent queries/mutations use this user's session.
  const token = result.tokens?.token;
  if (!token) {
    throw new Error("Authentication failed: no token received.");
  }
  client.setAuth(token);

  const user = await client.query(api.auth.loggedInUser);
  if (!user) {
    throw new Error("Authentication succeeded but user not found.");
  }
  cachedUserId = user._id;

  cachedClient = client;
  return client;
}
