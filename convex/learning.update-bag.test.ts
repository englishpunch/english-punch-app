import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { setupReviewedCard } from "./cardUpdate.test-helpers";

describe("updateBag", () => {
  it("trims the title, preserves all other data, and is idempotent", async () => {
    const { owner, read, bagId } = await setupReviewedCard();
    const before = await read();
    expect(
      await owner.mutation(api.learning.updateBag, {
        bagId,
        name: "  TOEFL Speaking  ",
      })
    ).toEqual({ bagId, name: "TOEFL Speaking" });
    const after = await read();
    expect(after).toEqual({
      ...before,
      bag: {
        ...before.bag,
        name: "TOEFL Speaking",
        lastModified: after.bag.lastModified,
      },
    });
    expect(after.bag.lastModified).not.toBe(before.bag.lastModified);
    await owner.mutation(api.learning.updateBag, {
      bagId,
      name: "TOEFL Speaking",
    });
    expect(await read()).toEqual(after);
  });

  it.each(["", " \t\n "])(
    "rejects blank names %j without changing data",
    async (name) => {
      const { owner, read, bagId } = await setupReviewedCard();
      const before = await read();
      await expect(
        owner.mutation(api.learning.updateBag, { bagId, name })
      ).rejects.toThrow("Bag name must not be blank");
      expect(await read()).toEqual(before);
    }
  );

  it("rejects unauthenticated and other-user updates", async () => {
    const { t, read, bagId } = await setupReviewedCard();
    const before = await read();
    await expect(
      t.mutation(api.learning.updateBag, { bagId, name: "changed" })
    ).rejects.toThrow();
    const otherUserId = await t.run((ctx) => ctx.db.insert("users", {}));
    await expect(
      t
        .withIdentity({ subject: otherUserId })
        .mutation(api.learning.updateBag, { bagId, name: "changed" })
    ).rejects.toThrow("Bag not found");
    expect(await read()).toEqual(before);
  });

  it.each(["deleted", "missing"])("rejects %s bags", async (state) => {
    const { t, owner, bagId } = await setupReviewedCard();
    await t.run(async (ctx) => {
      if (state === "deleted") {
        await ctx.db.patch("bags", bagId, { deletedAt: Date.now() });
      } else {
        await ctx.db.delete("bags", bagId);
      }
    });
    await expect(
      owner.mutation(api.learning.updateBag, { bagId, name: "changed" })
    ).rejects.toThrow("Bag not found");
  });
});
