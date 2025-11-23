import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { learningTables } from "./fsrsSchema";

export default defineSchema({
  ...authTables,
  ...learningTables,
});
