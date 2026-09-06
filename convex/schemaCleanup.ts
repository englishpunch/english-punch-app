import { v } from "convex/values";
import { paginationOptsValidator, type PaginationOptions } from "convex/server";
import { internalMutation } from "./_generated/server";

function assertMigrationBounds(options: PaginationOptions) {
  if (
    options.numItems !== 50 ||
    options.maximumRowsRead !== 50 ||
    options.maximumBytesRead !== 1_000_000
  ) {
    throw new Error("migration_limits_required");
  }
}

const result = v.object({
  continueCursor: v.string(),
  isDone: v.boolean(),
  processed: v.number(),
  changed: v.number(),
});

// Temporary migration endpoints for #88. Run only after a verified backup,
// and remove these endpoints before deploying the final strict schema.
export const removeRetiredFields = internalMutation({
  args: {
    table: v.union(
      v.literal("userSettings"),
      v.literal("bags"),
      v.literal("cards")
    ),
    paginationOpts: paginationOptsValidator,
  },
  returns: result,
  handler: async (ctx, { table, paginationOpts }) => {
    assertMigrationBounds(paginationOpts);
    const page = await ctx.db.query(table).paginate(paginationOpts);
    const fields = {
      userSettings: ["lastReviewDate"],
      bags: ["sortOrder"],
      cards: ["tags", "source"],
    }[table];
    const patch = {
      userSettings: { lastReviewDate: undefined },
      bags: { sortOrder: undefined },
      cards: { tags: undefined, source: undefined },
    }[table];
    let changed = 0;
    for (const document of page.page) {
      if (fields.some((field) => field in document)) {
        await ctx.db.patch(table, document._id, patch);
        changed += 1;
      }
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processed: page.page.length,
      changed,
    };
  },
});

export const emptyRetiredTable = internalMutation({
  args: {
    table: v.union(
      v.literal("dailyStats"),
      v.literal("cardTemplates"),
      v.literal("sessions")
    ),
    paginationOpts: paginationOptsValidator,
  },
  returns: result,
  handler: async (ctx, { table, paginationOpts }) => {
    assertMigrationBounds(paginationOpts);
    const page = await ctx.db.query(table).paginate(paginationOpts);
    for (const document of page.page) {
      await ctx.db.delete(table, document._id);
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      processed: page.page.length,
      changed: page.page.length,
    };
  },
});
