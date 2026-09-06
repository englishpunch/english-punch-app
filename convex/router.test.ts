// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("reports the canonical English Punch version from backend health", async () => {
  const t = convexTest(schema, modules);

  const response = await t.fetch("/health");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    status: "ok",
    version: "0.3.7",
    timestamp: expect.any(Number),
  });
});

it("exposes the canonical version at the ingress rewrite target", async () => {
  const t = convexTest(schema, modules);

  const response = await t.fetch("/api/version");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ version: "0.3.7" });
});
