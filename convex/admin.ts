import {
  modifyAccountCredentials,
  invalidateSessions,
} from "@convex-dev/auth/server";
import { v } from "convex/values";

import type { Id } from "./_generated/dataModel";
import { internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

type PasswordAccount = { userId: Id<"users"> } | null;

type ChangePasswordDeps = {
  findAccountByEmail: (email: string) => Promise<PasswordAccount>;
  updateSecret: (email: string, newPassword: string) => Promise<void>;
  invalidateUserSessions: (userId: Id<"users">) => Promise<void>;
};

export async function changePasswordWithDeps(
  deps: ChangePasswordDeps,
  args: { email: string; newPassword: string },
) {
  const { email, newPassword } = args;

  if (newPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  const account = await deps.findAccountByEmail(email);
  if (!account) {
    throw new Error(`Account for ${email} not found`);
  }

  await deps.updateSecret(email, newPassword);
  await deps.invalidateUserSessions(account.userId);

  return { userId: account.userId };
}

export const getPasswordAccount = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    return await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();
  },
});

export const changePassword = internalAction({
  args: { email: v.string(), newPassword: v.string() },
  handler: async (ctx, args): Promise<{ userId: Id<"users"> }> => {
    return await changePasswordWithDeps(
      {
        findAccountByEmail: (email): Promise<PasswordAccount> =>
          ctx.runQuery(internal.admin.getPasswordAccount, { email }),
        updateSecret: (email, newPassword): Promise<void> =>
          modifyAccountCredentials(ctx, {
            provider: "password",
            account: { id: email, secret: newPassword },
          }),
        invalidateUserSessions: (userId): Promise<void> =>
          invalidateSessions(ctx, { userId }),
      },
      args,
    );
  },
});
