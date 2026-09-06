// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const paginationOpts = {
  numItems: 50,
  maximumRowsRead: 50,
  maximumBytesRead: 1_000_000,
  cursor: null,
};

it("removes only retired fields and is safe to rerun", async () => {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dueCards");
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const asUser = t.withIdentity({ subject: userId });
  const bagId = await asUser.mutation(api.learning.createSampleBag, {});
  const before = await t.run(async (ctx) => {
    const settings = await ctx.db.query("userSettings").first();
    const card = await ctx.db.query("cards").first();
    const bag = await ctx.db.get("bags", bagId);
    if (!settings || !card || !bag) {
      throw new Error("Missing test fixture");
    }
    await ctx.db.patch("userSettings", settings._id, {
      lastReviewDate: "2026-01-01",
    });
    await ctx.db.patch("bags", bagId, { sortOrder: 7 });
    await ctx.db.patch("cards", card._id, {
      tags: ["legacy"],
      source: "manual",
    });
    return {
      settings,
      bag,
      card,
    };
  });

  for (const table of ["userSettings", "bags", "cards"] as const) {
    const migrated = await t.mutation(
      internal.schemaCleanup.removeRetiredFields,
      {
        table,
        paginationOpts,
      }
    );
    expect(migrated.isDone).toBe(true);
    expect(migrated.changed).toBe(1);
    const repeated = await t.mutation(
      internal.schemaCleanup.removeRetiredFields,
      {
        table,
        paginationOpts,
      }
    );
    expect(repeated.changed).toBe(0);
  }

  const after = await t.run(async (ctx) => ({
    settings: await ctx.db.query("userSettings").first(),
    bag: await ctx.db.get("bags", bagId),
    card: await ctx.db.get("cards", before.card._id),
  }));
  expect(after.settings).toEqual(before.settings);
  expect(after.card).toEqual(before.card);
  expect(after.bag).toEqual(before.bag);
});

it("deletes legacy table rows in bounded, resumable batches", async () => {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    for (let index = 0; index < 61; index += 1) {
      await ctx.db.insert("cardTemplates", {
        category: "test",
        level: "beginner",
        question: `Question ${index}`,
        answer: "answer",
        tags: [],
        popularity: 0,
        difficulty: 0,
      });
    }
  });

  const first = await t.mutation(internal.schemaCleanup.emptyRetiredTable, {
    table: "cardTemplates",
    paginationOpts,
  });
  expect(first.changed).toBe(50);
  expect(first.isDone).toBe(false);
  const second = await t.mutation(internal.schemaCleanup.emptyRetiredTable, {
    table: "cardTemplates",
    paginationOpts: { ...paginationOpts, cursor: first.continueCursor },
  });
  expect(second.changed).toBe(11);
  expect(second.isDone).toBe(true);
  const repeated = await t.mutation(internal.schemaCleanup.emptyRetiredTable, {
    table: "cardTemplates",
    paginationOpts,
  });
  expect(repeated.changed).toBe(0);
  expect(
    await t.run((ctx) => ctx.db.query("cardTemplates").first())
  ).toBeNull();
});
