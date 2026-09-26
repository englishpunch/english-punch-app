import migrations from "@convex-dev/migrations/convex.config";
import aggregate from "@convex-dev/aggregate/convex.config";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    MCP_OAUTH_PRIVATE_JWK: v.string(),
  },
});

app.use(migrations);
app.use(aggregate, { name: "dueCards" });
app.use(rateLimiter);

export default app;
