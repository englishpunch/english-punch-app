import { z } from "zod";
import type { Id } from "../convex-generated/dataModel.js";

export const bagId = z
  .string()
  .describe("ID of the bag")
  .transform((s) => s as Id<"bags">);

export const cardId = z
  .string()
  .describe("ID of the card")
  .transform((s) => s as Id<"cards">);

export const rating = z
  .number()
  .int()
  .min(1)
  .max(4)
  .describe("1=Again, 2=Hard, 3=Good, 4=Easy")
  .transform((n) => n as 1 | 2 | 3 | 4);
