// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import { trackUpdatedCard } from "./cardAggregate";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("selects across the entire eligible bag and records practice without changing any card fields", async () => {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dueCards");
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const user = t.withIdentity({ subject: userId });
  const bagId = await user.mutation(api.learning.createBag, {
    name: "Practice",
  });
  const ids = [];
  for (const answer of ["first", "second", "suspended", "deleted"]) {
    ids.push(
      await user.mutation(api.learning.createCard, {
        bagId,
        question: "Q",
        answer,
      })
    );
  }
  const now = Date.now();
  await t.run(async (ctx) => {
    for (const [index, id] of ids.entries()) {
      const card = (await ctx.db.get("cards", id))!;
      await ctx.db.patch("cards", id, {
        due: now + (index + 1) * 86400000,
        suspended: index === 2,
        deletedAt: index === 3 ? now : undefined,
      });
      await trackUpdatedCard(ctx, card);
    }
  });
  expect(await user.query(api.learning.getOneDueCard, { bagId, now })).toBe(
    "NO_CARD_AVAILABLE"
  );
  const first = await user.query(api.learning.getOneDueCard, {
    bagId,
    now,
    practiceSeed: 0,
  });
  const last = await user.query(api.learning.getOneDueCard, {
    bagId,
    now,
    practiceSeed: 0.999,
  });
  expect(first).toMatchObject({ _id: ids[0], practice: true });
  expect(last).toMatchObject({ _id: ids[1], practice: true });
  const before = await t.run((ctx) => ctx.db.get("cards", ids[0]));
  for (const rating of [1, 2, 3, 4] as const) {
    await user.mutation(api.fsrs.reviewCard, {
      cardId: ids[0],
      rating,
      duration: 123,
      practice: true,
      attemptId: `practice-${rating}`,
    });
  }
  expect(await t.run((ctx) => ctx.db.get("cards", ids[0]))).toEqual(before);
  const logs = await t.run((ctx) => ctx.db.query("reviewLogs").collect());
  expect(logs).toHaveLength(4);
  expect(logs.every((log) => log.reviewType === "cramming")).toBe(true);
  const activities = await t.run((ctx) => ctx.db.query("activities").collect());
  expect(
    activities.filter((activity) => activity.eventType === "review_rated")
  ).toHaveLength(4);
  await t.run(async (ctx) => {
    const card = (await ctx.db.get("cards", ids[1]))!;
    await ctx.db.patch("cards", card._id, { due: now - 1 });
    await trackUpdatedCard(ctx, card);
  });
  expect(
    await user.query(api.learning.getOneDueCard, {
      bagId,
      now,
      practiceSeed: 0,
    })
  ).toMatchObject({ _id: ids[1], practice: false });
  const emptyBag = await user.mutation(api.learning.createBag, {
    name: "Empty",
  });
  expect(
    await user.query(api.learning.getOneDueCard, {
      bagId: emptyBag,
      now,
      practiceSeed: 0,
    })
  ).toBe("NO_CARD_AVAILABLE");
  const strangerId = await t.run((ctx) => ctx.db.insert("users", {}));
  expect(
    await t
      .withIdentity({ subject: strangerId })
      .query(api.learning.getOneDueCard, { bagId, now, practiceSeed: 0 })
  ).toBe("NO_CARD_AVAILABLE");
});
