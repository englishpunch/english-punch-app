// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("includes the past calendar year and aligns its first column to Sunday", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const heatmap = await t
    .withIdentity({ subject: userId })
    .query(api.activities.getActivityHeatmap, { toDate: "2026-09-06" });
  expect(heatmap.fromDate).toBe("2025-08-31");
  expect(heatmap.toDate).toBe("2026-09-06");
  expect(heatmap.days).toHaveLength(372);
  expect(heatmap.days[heatmap.days.length - 1]?.date).toBe(heatmap.toDate);
});

it("preserves explicit date ranges, including leap day", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const heatmap = await t
    .withIdentity({ subject: userId })
    .query(api.activities.getActivityHeatmap, {
      fromDate: "2024-02-28",
      toDate: "2024-03-01",
    });
  expect(heatmap.days.map((day) => day.date)).toEqual([
    "2024-02-28",
    "2024-02-29",
    "2024-03-01",
  ]);
});
