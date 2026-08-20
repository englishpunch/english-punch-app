import { describe, expect, it } from "vitest";
import { updateEnglishPunchValues } from "./update-infra-images.mjs";

const values = `frontend:
  image:
    repository: ghcr.io/englishpunch/english-punch-app
    tag: sha-1111111
    pullPolicy: IfNotPresent

mcp:
  enabled: false
  image:
    repository: ghcr.io/englishpunch/english-punch-mcp
    tag: sha-1111111
    pullPolicy: IfNotPresent

backend:
  image:
    tag: unchanged
`;

describe("updateEnglishPunchValues", () => {
  it("updates frontend and MCP together and enables MCP", () => {
    const updated = updateEnglishPunchValues(values, "sha-deadbee");

    expect(updated.match(/tag: sha-deadbee/g)).toHaveLength(2);
    expect(updated).toContain("mcp:\n  enabled: true");
    expect(updated).toContain("backend:\n  image:\n    tag: unchanged");
  });

  it("fails instead of opening a partial deployment PR", () => {
    expect(() =>
      updateEnglishPunchValues(values.replace("mcp:", "worker:"), "sha-deadbee")
    ).toThrow("Image tag fields not found for: mcp");
  });

  it("rejects mutable or malformed tags", () => {
    expect(() => updateEnglishPunchValues(values, "main")).toThrow(
      "Invalid image tag"
    );
  });
});
