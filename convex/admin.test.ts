import { describe, expect, it, vi } from "vitest";

import type { Id } from "./_generated/dataModel";
import { changePasswordWithDeps } from "./admin";

const userId = "user_1" as Id<"users">;
const account = { _id: "account_1", userId } as const;

const buildDeps = (foundAccount: typeof account | null) => {
  return {
    findAccountByEmail: vi.fn().mockResolvedValue(foundAccount),
    updateSecret: vi.fn().mockResolvedValue(undefined),
    invalidateUserSessions: vi.fn().mockResolvedValue(undefined),
  };
};

describe("changePasswordWithDeps", () => {
  it("rejects passwords shorter than 8 characters", async () => {
    const deps = buildDeps(account);

    await expect(
      changePasswordWithDeps(deps, {
        email: "user@example.com",
        newPassword: "short",
      }),
    ).rejects.toThrow(/at least 8 characters/);
  });

  it("throws when account is missing", async () => {
    const deps = buildDeps(null);

    await expect(
      changePasswordWithDeps(deps, {
        email: "missing@example.com",
        newPassword: "supersecret",
      }),
    ).rejects.toThrow(/Account.*missing@example.com/);
  });

  it("updates credentials and invalidates sessions", async () => {
    const deps = buildDeps(account);

    await changePasswordWithDeps(deps, {
      email: "user@example.com",
      newPassword: "supersecret",
    });

    expect(deps.findAccountByEmail).toHaveBeenCalledWith("user@example.com");
    expect(deps.updateSecret).toHaveBeenCalledWith(
      "user@example.com",
      "supersecret",
    );
    expect(deps.invalidateUserSessions).toHaveBeenCalledWith(userId);
  });
});
