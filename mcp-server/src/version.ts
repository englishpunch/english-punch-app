import { readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
) as { version?: unknown };

if (
  typeof packageJson.version !== "string" ||
  !/^\d+\.\d+\.\d+$/.test(packageJson.version)
) {
  throw new Error("English Punch package version must use x.x.x format");
}

export const ENGLISH_PUNCH_VERSION = packageJson.version;
