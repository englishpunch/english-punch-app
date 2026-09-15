import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { countActivityOnce } from "./activityDailyCounts";

const migrations = new Migrations<DataModel>(components.migrations);

export const backfillDailyCounts = migrations.define({
  table: "activities",
  batchSize: 50,
  migrateOne: countActivityOnce,
});
