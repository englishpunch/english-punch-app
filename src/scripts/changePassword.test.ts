import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  buildConvexRunArgs,
  buildConvexRunEnv,
  runChangePassword,
} from "./changePassword";

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

describe("buildConvexRunEnv", () => {
  it("loads the self-hosted env file and removes Cloud deployment selectors", () => {
    const dir = mkdtempSync(join(tmpdir(), "ep-change-password-"));
    const envPath = join(dir, ".env.convex-selfhost");

    try {
      writeFileSync(
        envPath,
        [
          "CONVEX_SELF_HOSTED_URL=https://ep-convex.echoja.com",
          "CONVEX_SELF_HOSTED_ADMIN_KEY='english-punch|test-key'",
        ].join("\n")
      );

      const env = {
        CONVEX_DEPLOYMENT: "dev-123",
        CONVEX_DEPLOY_KEY: "cloud-key",
      } as NodeJS.ProcessEnv;

      expect(buildConvexRunEnv(env, envPath)).toEqual({
        CONVEX_SELF_HOSTED_URL: "https://ep-convex.echoja.com",
        CONVEX_SELF_HOSTED_ADMIN_KEY: "english-punch|test-key",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("runChangePassword", () => {
  it("throws when required arguments are missing", () => {
    expect(() => runChangePassword([], {}, vi.fn())).toThrow(
      /Usage: change-password <email> <newPassword>/
    );
  });

  it("delegates to npx convex run with the self-hosted env", () => {
    const spawn = vi.fn().mockReturnValue({ status: 0 });
    const env = {
      CONVEX_DEPLOYMENT: "dev-123",
      CONVEX_SELF_HOSTED_URL: "https://ep-convex.echoja.com",
      CONVEX_SELF_HOSTED_ADMIN_KEY: "english-punch|test-key",
    } as NodeJS.ProcessEnv;

    runChangePassword(
      ["user@example.com", "hunter2"],
      env,
      spawn,
      "/tmp/missing-convex-selfhost-env"
    );

    expect(spawn).toHaveBeenCalledWith(
      "npx",
      buildConvexRunArgs("user@example.com", "hunter2"),
      {
        stdio: "inherit",
        env: {
          CONVEX_SELF_HOSTED_URL: "https://ep-convex.echoja.com",
          CONVEX_SELF_HOSTED_ADMIN_KEY: "english-punch|test-key",
        },
      }
    );
  });

  it("raises when convex run fails", () => {
    const spawn = vi.fn().mockReturnValue({ status: 1 });
    const env = {
      CONVEX_SELF_HOSTED_URL: "https://ep-convex.echoja.com",
      CONVEX_SELF_HOSTED_ADMIN_KEY: "english-punch|test-key",
    } as NodeJS.ProcessEnv;

    expect(() =>
      runChangePassword(
        ["user@example.com", "nope"],
        env,
        spawn,
        "/tmp/missing-convex-selfhost-env"
      )
    ).toThrow(/convex run failed/);
  });
});
