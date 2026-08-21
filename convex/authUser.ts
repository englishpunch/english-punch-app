import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError } from "convex/values";

type AuthContext = Pick<QueryCtx, "auth"> | Pick<MutationCtx, "auth">;

export async function requireAuthenticatedUserId(
  ctx: AuthContext
): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Unauthorized");
  }
  return userId;
}
