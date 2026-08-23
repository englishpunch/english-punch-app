import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const rootPackage = await readJson(new URL("../package.json", import.meta.url));
const mcpPackage = await readJson(
  new URL("../mcp-server/package.json", import.meta.url)
);
const version = rootPackage.version;

if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
  throw new Error("Root package version must use x.x.x format");
}

if (mcpPackage.version !== version) {
  throw new Error(
    `MCP package version ${mcpPackage.version} does not match ${version}`
  );
}

console.log(`English Punch version ${version} is consistent`);
