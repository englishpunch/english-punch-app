import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

export function buildConvexRunArgs(email: string, newPassword: string) {
  return [
    "convex",
    "run",
    "internal.admin.changePassword",
    JSON.stringify({ email, newPassword }),
  ];
}

export function runChangePassword(
  argv: string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
  spawn: typeof spawnSync = spawnSync
): SpawnSyncReturns<Buffer> {
  const [email, newPassword] = argv;

  if (!email || !newPassword) {
    throw new Error("Usage: change-password <email> <newPassword>");
  }

  const result = spawn("npx", buildConvexRunArgs(email, newPassword), {
    stdio: "inherit",
    env,
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
