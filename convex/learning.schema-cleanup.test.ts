// @vitest-environment edge-runtime
/// <reference types="vite/client" />

import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

it("creates a studyable card without retired metadata while preserving content", async () => {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dueCards");
  const userId = await t.run((ctx) => ctx.db.insert("users", {}));
  const asUser = t.withIdentity({ subject: userId });
  const bagId = await asUser.mutation(api.learning.createBag, {
    name: "My vocabulary",
  });
  const cardId = await asUser.mutation(api.learning.createCard, {
    bagId,
    question: "A general question",
    answer: "A general answer",
    sourceWord: "book",
    expression: "reserve a table",
  });

  const card = await asUser.query(api.learning.getOneDueCard, { bagId });

  expect(card).toMatchObject({
    _id: cardId,
    question: "A general question",
    answer: "A general answer",
    sourceWord: "book",
    expression: "reserve a table",
    state: 0,
    suspended: false,
  });
  expect(card).not.toHaveProperty("tags");
  expect(card).not.toHaveProperty("source");
});
