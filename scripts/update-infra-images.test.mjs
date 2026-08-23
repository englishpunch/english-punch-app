import { describe, expect, it } from "vitest";
import {
  updateEnglishPunchChart,
  updateEnglishPunchValues,
} from "./update-infra-images.mjs";

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

const chart = `apiVersion: v2
name: english-punch
version: 0.1.0
appVersion: "0.1.0"
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

describe("updateEnglishPunchChart", () => {
  it("updates the English Punch appVersion without changing the chart version", () => {
    expect(updateEnglishPunchChart(chart, "0.3.5")).toBe(`apiVersion: v2
name: english-punch
version: 0.1.0
appVersion: "0.3.5"
`);
  });

  it("rejects a non-SemVer product version", () => {
    expect(() => updateEnglishPunchChart(chart, "main")).toThrow(
      "Invalid English Punch version"
    );
  });

  it("rejects missing or duplicate appVersion fields", () => {
    expect(() =>
      updateEnglishPunchChart(chart.replace(/^appVersion:.*$/m, ""), "0.3.5")
    ).toThrow("Expected exactly one Helm appVersion field");
    expect(() =>
      updateEnglishPunchChart(`${chart}appVersion: "9.9.9"\n`, "0.3.5")
    ).toThrow("Expected exactly one Helm appVersion field");
  });
});
