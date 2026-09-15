// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import migrationsTest from "@convex-dev/migrations/test";
import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { logActivity } from "./activities";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const setup = () => {
  const t = convexTest(schema, modules);
  migrationsTest.register(t);
  return t;
};
afterEach(() => vi.useRealTimers());

it("counts all event types once, across live writes, duplicates, and backfill restarts", async () => {
  const t = setup();
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const types = [
    "review_question_seen",
    "review_answer_revealed",
    "review_rated",
  ] as const;
  for (const eventType of types) {
    const args = {
      userId,
      eventType,
      source: "web" as const,
      dedupeKey: eventType,
      occurredAt: Date.parse("2026-09-15T16:00:00Z"),
    };
    const first = await t.run((ctx) => logActivity(ctx, args));
    expect(await t.run((ctx) => logActivity(ctx, args))).toBe(first);
  }
  for (let i = 0; i < 2; i++) {
    await t.mutation(internal.activityMigrations.backfillDailyCounts, {
      oneBatchOnly: true,
      cursor: null,
      dryRun: false,
    });
  }
  const days = await t.run((ctx) =>
    ctx.db.query("activityDailyCounts").collect()
  );
  expect(days).toHaveLength(1);
  expect(days[0]).toMatchObject({
    userId,
    localDate: "2026-09-16",
    questionSeenCount: 1,
    revealCount: 1,
    ratedCount: 1,
  });
});

it("preserves exact heatmap totals through partial backfill and interleaved writes", async () => {
  const t = setup();
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const otherUserId = await t.run((ctx) => ctx.db.insert("users", {}));
  await t.run(async (ctx) => {
    for (const [i, eventType] of [
      "review_question_seen",
      "review_answer_revealed",
      "review_rated",
      "review_answer_revealed",
    ].entries()) {
      await ctx.db.insert("activities", {
        userId,
        eventType: eventType as
          "review_question_seen" | "review_answer_revealed" | "review_rated",
        occurredAt: i,
        localDate: "2026-09-15",
        timezone: "America/Los_Angeles",
        source: "cli",
        dedupeKey: `legacy-${i}`,
        schemaVersion: 1,
      });
    }
    await logActivity(ctx, {
      userId: otherUserId,
      eventType: "review_rated",
      source: "web",
      dedupeKey: "other",
      occurredAt: Date.parse("2026-09-15T00:00:00Z"),
    });
  });
  const query = () =>
    t
      .withIdentity({ subject: userId })
      .query(api.activities.getActivityHeatmap, {
        fromDate: "2026-09-15",
        toDate: "2026-09-16",
      });
  const before = await query();
  const first = await t.mutation(
    internal.activityMigrations.backfillDailyCounts,
    { oneBatchOnly: true, cursor: null, dryRun: false, batchSize: 2 }
  );
  expect(await query()).toEqual(before);
  await t.run((ctx) =>
    logActivity(ctx, {
      userId,
      eventType: "review_rated",
      source: "web",
      dedupeKey: "live",
      occurredAt: Date.parse("2026-09-15T00:00:00Z"),
    })
  );
  const during = await query();
  expect(during.days[0]).toMatchObject({
    questionSeenCount: 1,
    revealCount: 2,
    ratedCount: 2,
  });
  // Resume from the component cursor, then restart to prove per-event idempotency.
  await t.mutation(internal.activityMigrations.backfillDailyCounts, {
    oneBatchOnly: true,
    cursor: first!.continueCursor,
    dryRun: false,
  });
  expect(await query()).toEqual(during);
  await t.mutation(internal.activityMigrations.backfillDailyCounts, {
    oneBatchOnly: true,
    cursor: null,
    dryRun: false,
  });
  expect(await query()).toEqual(during);
  const ownDays = await t.run((ctx) =>
    ctx.db
      .query("activityDailyCounts")
      .withIndex("by_userId_and_localDate", (q) => q.eq("userId", userId))
      .collect()
  );
  expect(ownDays).toHaveLength(1);
  expect(ownDays[0]).toMatchObject({
    localDate: "2026-09-15",
    questionSeenCount: 1,
    revealCount: 2,
    ratedCount: 2,
  });
  await t.mutation(internal.activityMigrations.verifyDayPage, {
    dayId: ownDays[0]._id,
    cursor: null,
    expected: null,
    counts: { questionSeenCount: 0, revealCount: 0, ratedCount: 0 },
  });
  expect(
    (await t.run((ctx) => ctx.db.get("activityDailyCounts", ownDays[0]._id)))
      ?.verified
  ).toBe(true);
  expect(await query()).toEqual(during);
});

it("rolls back counts and event markers during a migration dry run", async () => {
  const t = setup();
  await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {});
    await ctx.db.insert("activities", {
      userId,
      eventType: "review_rated",
      occurredAt: 0,
      localDate: "2026-09-15",
      timezone: "Asia/Seoul",
      source: "cli",
      dedupeKey: "legacy",
      schemaVersion: 1,
    });
  });
  await expect(
    t.mutation(internal.activityMigrations.backfillDailyCounts, {
      oneBatchOnly: true,
      cursor: null,
      dryRun: true,
    })
  ).rejects.toThrow();
  expect(
    await t.run((ctx) => ctx.db.query("activityDailyCounts").collect())
  ).toHaveLength(0);
  expect(
    (await t.run((ctx) => ctx.db.query("activities").first()))?.dailyCounted
  ).toBeUndefined();
});

it("finds the latest local activity date independently, within the visible year and user", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-09-15T16:00:00Z"));
  const t = setup();
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const otherUserId = await t.run((ctx) => ctx.db.insert("users", {}));
  const query = () =>
    t
      .withIdentity({ subject: userId })
      .query(api.activities.getLatestActivityDate, {});
  expect(await query()).toEqual({ date: "2026-09-16", hasActivity: false });
  await t.run(async (ctx) => {
    for (const [owner, date] of [
      [userId, "2026-09-14"],
      [userId, "2026-09-15"],
      [userId, "2027-01-01"],
      [otherUserId, "2026-09-16"],
    ] as const) {
      await ctx.db.insert("activities", {
        userId: owner,
        eventType: "review_question_seen",
        occurredAt: 0,
        localDate: date,
        timezone: "Asia/Seoul",
        source: "web",
        dedupeKey: date,
        schemaVersion: 1,
      });
    }
  });
  expect(await query()).toEqual({ date: "2026-09-15", hasActivity: true });
  await expect(
    t.query(api.activities.getLatestActivityDate, {})
  ).rejects.toThrow();
  const heatmap = await t
    .withIdentity({ subject: otherUserId })
    .query(api.activities.getActivityHeatmap, { userId });
  expect(
    heatmap.days.filter((d) => d.questionSeenCount > 0).map((d) => d.date)
  ).toEqual(["2026-09-16"]);
});

it("runs the resumable migration through its scheduled component runner", async () => {
  vi.useFakeTimers();
  const t = setup();
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  await t.run(async (ctx) => {
    for (let i = 0; i < 5; i++) {
      await ctx.db.insert("activities", {
        userId,
        eventType: "review_rated",
        occurredAt: i,
        localDate: "2026-09-15",
        timezone: "Asia/Seoul",
        source: "web",
        dedupeKey: `legacy-${i}`,
        schemaVersion: 1,
      });
    }
  });
  await t.mutation(internal.activityMigrations.runDailyCounts, {
    batchSize: 2,
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    await t.run((ctx) => ctx.db.query("activityDailyCounts").first())
  ).toMatchObject({ ratedCount: 5, verified: true });
  expect(
    await t.query(internal.activityMigrations.verificationStatus, {})
  ).toEqual({
    ready: true,
    backfillPending: false,
    verificationPending: false,
  });
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("activities")
        .withIndex("by_dailyCounted_and_userId", (q) =>
          q.eq("dailyCounted", undefined).eq("userId", userId)
        )
        .first()
    )
  ).toBeNull();
});

it("refuses to serve a historical summary whose verified totals do not match", async () => {
  const t = setup();
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  await t.run(async (ctx) => {
    await ctx.db.insert("activities", {
      userId,
      eventType: "review_rated",
      occurredAt: 0,
      localDate: "2026-09-15",
      timezone: "Asia/Seoul",
      source: "web",
      dedupeKey: "legacy",
      schemaVersion: 1,
    });
  });
  await t.mutation(internal.activityMigrations.backfillDailyCounts, {
    oneBatchOnly: true,
    cursor: null,
    dryRun: false,
  });
  const summary = await t.run((ctx) =>
    ctx.db.query("activityDailyCounts").first()
  );
  await t.run((ctx) =>
    ctx.db.patch("activityDailyCounts", summary!._id, { ratedCount: 2 })
  );
  await expect(
    t.mutation(internal.activityMigrations.verifyDayPage, {
      dayId: summary!._id,
      cursor: null,
      expected: null,
      counts: { questionSeenCount: 0, revealCount: 0, ratedCount: 0 },
    })
  ).rejects.toThrow("Daily activity totals differ");
  const heatmap = await t
    .withIdentity({ subject: userId })
    .query(api.activities.getActivityHeatmap, {
      fromDate: "2026-09-15",
      toDate: "2026-09-15",
    });
  expect(heatmap.days[0].ratedCount).toBe(1);
  expect(
    await t.query(internal.activityMigrations.verificationStatus, {})
  ).toEqual({
    ready: false,
    backfillPending: false,
    verificationPending: true,
  });
});

it("restarts a paginated verification when a backdated live write arrives between pages", async () => {
  vi.useFakeTimers();
  const t = setup();
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const base = Date.parse("2026-09-15T01:00:00Z");
  await t.run(async (ctx) => {
    for (let i = 0; i < 205; i++) {
      await ctx.db.insert("activities", {
        userId,
        eventType: "review_rated",
        occurredAt: base + i,
        localDate: "2026-09-15",
        timezone: "Asia/Seoul",
        source: "cli",
        dedupeKey: `legacy-${i}`,
        schemaVersion: 1,
      });
    }
  });
  await t.mutation(internal.activityMigrations.backfillDailyCounts, {
    oneBatchOnly: true,
    cursor: null,
    dryRun: false,
    batchSize: 500,
  });
  const summary = await t.run((ctx) =>
    ctx.db.query("activityDailyCounts").first()
  );
  await t.mutation(internal.activityMigrations.verifyDayPage, {
    dayId: summary!._id,
    cursor: null,
    expected: null,
    counts: { questionSeenCount: 0, revealCount: 0, ratedCount: 0 },
  });
  expect(
    (await t.run((ctx) => ctx.db.get("activityDailyCounts", summary!._id)))
      ?.verified
  ).toBe(false);
  await t.run((ctx) =>
    logActivity(ctx, {
      userId,
      eventType: "review_question_seen",
      occurredAt: base - 60000,
      source: "cli",
      dedupeKey: "backdated-live",
    })
  );
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(
    await t.run((ctx) => ctx.db.get("activityDailyCounts", summary!._id))
  ).toMatchObject({ ratedCount: 205, questionSeenCount: 1, verified: true });
});
