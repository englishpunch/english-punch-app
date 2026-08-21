import { TableAggregate } from "@convex-dev/aggregate";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

type DueCardNamespace = [Id<"users">, Id<"bags">];
type DueCardKey = [number, number];

export const dueCards = new TableAggregate<{
  Namespace: DueCardNamespace;
  Key: DueCardKey;
  DataModel: DataModel;
  TableName: "cards";
}>(components.dueCards, {
  namespace: (card) => [card.userId, card.bagId],
  sortKey: (card) => [
    card.deletedAt === undefined && !card.suspended ? 0 : 1,
    card.due,
  ],
});

export async function trackInsertedCard(ctx: MutationCtx, cardId: Id<"cards">) {
  const card = await ctx.db.get("cards", cardId);
  if (!card) {
    throw new Error("Inserted card could not be loaded");
  }
  await dueCards.insertIfDoesNotExist(ctx, card);
}

export async function trackUpdatedCard(
  ctx: MutationCtx,
  previousCard: Doc<"cards">
) {
  const currentCard = await ctx.db.get("cards", previousCard._id);
  if (!currentCard) {
    await dueCards.deleteIfExists(ctx, previousCard);
    return;
  }
  await dueCards.replaceOrInsert(ctx, previousCard, currentCard);
}

export async function countDueCards(
  ctx: Parameters<typeof dueCards.count>[0],
  userId: Id<"users">,
  bagId: Id<"bags">,
  dueAtOrBefore: number
) {
  return await dueCards.count(ctx, {
    namespace: [userId, bagId],
    bounds: {
      lower: { key: [0, Number.MIN_SAFE_INTEGER], inclusive: true },
      upper: { key: [0, dueAtOrBefore], inclusive: true },
    },
  });
}

export const backfillDueCards = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.object({
    processed: v.number(),
    isDone: v.boolean(),
  }),
  handler: async (
    ctx,
    { cursor }
  ): Promise<{
    processed: number;
    isDone: boolean;
  }> => {
    const page = await ctx.db.query("cards").paginate({
      cursor,
      numItems: 100,
    });
    for (const card of page.page) {
      await dueCards.insertIfDoesNotExist(ctx, card);
    }
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.cardAggregate.backfillDueCards, {
        cursor: page.continueCursor,
      });
    }
    return { processed: page.page.length, isDone: page.isDone };
  },
});
