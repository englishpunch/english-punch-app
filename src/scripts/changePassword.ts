import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "dotenv";

export function buildConvexRunArgs(email: string, newPassword: string) {
  return [
    "convex",
    "run",
    "internal.admin.changePassword",
    JSON.stringify({ email, newPassword }),
  ];
}

export function buildConvexRunEnv(
  env: NodeJS.ProcessEnv = process.env,
  selfhostEnvPath = ".env.convex-selfhost"
) {
  const runEnv: NodeJS.ProcessEnv = { ...env };

  if (existsSync(selfhostEnvPath)) {
    Object.assign(runEnv, parse(readFileSync(selfhostEnvPath)));
  }

  delete runEnv.CONVEX_DEPLOYMENT;
  delete runEnv.CONVEX_DEPLOY_KEY;

  if (!runEnv.CONVEX_SELF_HOSTED_URL || !runEnv.CONVEX_SELF_HOSTED_ADMIN_KEY) {
    throw new Error(
      "Missing CONVEX_SELF_HOSTED_URL or CONVEX_SELF_HOSTED_ADMIN_KEY. Create .env.convex-selfhost first."
    );
  }

  return runEnv;
}

export function runChangePassword(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
  spawn: typeof spawnSync = spawnSync,
  selfhostEnvPath = ".env.convex-selfhost"
): SpawnSyncReturns<Buffer> {
  const [email, newPassword] = argv;

  if (!email || !newPassword) {
    throw new Error("Usage: change-password <email> <newPassword>");
  }

  const result = spawn("npx", buildConvexRunArgs(email, newPassword), {
    stdio: "inherit",
    env: buildConvexRunEnv(env, selfhostEnvPath),
  });

  if (result.status !== 0) {
    throw new Error("convex run failed");
  }

  return result;
}

async function main() {
  runChangePassword();
}

const thisFile = fileURLToPath(import.meta.url);
if (
  process.argv[1] === thisFile ||
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  void main();
}
