import { describe, expect, it, vi } from "vitest";

import { buildConvexRunArgs, runChangePassword } from "./changePassword";

describe("buildConvexRunArgs", () => {
  it("creates a convex run command with JSON arguments", () => {
    expect(buildConvexRunArgs("a@example.com", "supersafe")).toEqual([
      "convex",
      "run",
      "internal.admin.changePassword",
      JSON.stringify({ email: "a@example.com", newPassword: "supersafe" }),
    ]);
  });
});

describe("runChangePassword", () => {
  it("throws when required arguments are missing", () => {
    expect(() => runChangePassword([], {}, vi.fn())).toThrow(
      /Usage: change-password <email> <newPassword>/,
    );
  });

  it("delegates to npx convex run with provided env", () => {
    const spawn = vi.fn().mockReturnValue({ status: 0 });
    const env = { CONVEX_DEPLOYMENT: "dev-123" } as NodeJS.ProcessEnv;

    runChangePassword(["user@example.com", "hunter2"], env, spawn);

    expect(spawn).toHaveBeenCalledWith(
      "npx",
      buildConvexRunArgs("user@example.com", "hunter2"),
      { stdio: "inherit", env },
    );
  });

  it("raises when convex run fails", () => {
    const spawn = vi.fn().mockReturnValue({ status: 1 });

    expect(() =>
      runChangePassword(["user@example.com", "nope"], process.env, spawn),
    ).toThrow(/convex run failed/);
  });
});
