# Welcome to your Convex functions directory!

Write your Convex functions here.
See https://docs.convex.dev/functions for more.

A query function that takes two arguments looks like:

```ts
// functions.js
import { query } from "./_generated/server";
import { v } from "convex/values";

export const myQueryFunction = query({
  // Validators for arguments.
  args: {
    first: v.number(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Read the database as many times as you need here.
    // See https://docs.convex.dev/database/reading-data.
    const documents = await ctx.db.query("tablename").collect();

    // Arguments passed from the client are properties of the args object.
    console.log(args.first, args.second);

    // Write arbitrary JavaScript here: filter, aggregate, build derived data,
    // remove non-public properties, or create new objects.
    return documents;
  },
});
```

Using this query function in a React component looks like:

```ts
const data = useQuery(api.functions.myQueryFunction, {
  first: 10,
  second: "hello",
});
```

A mutation function looks like:

```ts
// functions.js
import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const myMutationFunction = mutation({
  // Validators for arguments.
  args: {
    first: v.string(),
    second: v.string(),
  },

  // Function implementation.
  handler: async (ctx, args) => {
    // Insert or modify documents in the database here.
    // Mutations can also read from the database like queries.
    // See https://docs.convex.dev/database/writing-data.
    const message = { body: args.first, author: args.second };
    const id = await ctx.db.insert("messages", message);

    // Optionally, return a value from your mutation.
    return await ctx.db.get(id);
  },
});
```

Using this mutation function in a React component looks like:

```ts
const mutation = useMutation(api.functions.myMutationFunction);
function handleButtonPress() {
  // fire and forget, the most common way to use mutations
  mutation({ first: "Hello!", second: "me" });
  // OR
  // use the result once the mutation has completed
  mutation({ first: "Hello!", second: "me" }).then((result) =>
    console.log(result),
  );
}
```

Use the Convex CLI to push your functions to a deployment. See everything
the Convex CLI can do by running `npx convex -h` in your project root
directory. To learn more, launch the docs with `npx convex docs`.

## Logging in Convex Functions

This project provides a logging utility (`logger.ts`) to prevent server-side logs from appearing in the browser console in production.

### Why use the logger utility?

Convex forwards `console.log()` calls from backend functions (mutations/queries) to the browser console for debugging. While this is helpful during development, it can:
- Expose sensitive information in production
- Clutter the browser console for end users
- Display internal server details that should remain private

### Usage

Instead of using `console.log()` directly, import and use the logger utility:

```ts
import * as logger from "./logger";

export const myMutation = mutation({
  handler: async (ctx, args) => {
    // This will only log in development/test, not in production
    logger.log("Processing request", args);
    
    // Warnings are also suppressed in production
    logger.warn("This might be an issue");
    
    // Errors are ALWAYS logged, even in production
    logger.error("Critical error occurred", error);
    
    // Debug logs are also suppressed in production
    logger.debug("Detailed debug info");
  },
});
```

### Behavior

- **Development/Test**: All logs (`log`, `warn`, `debug`, `error`) are output to console
- **Production**: Only `error` logs are output; `log`, `warn`, and `debug` are suppressed

The logger checks `process.env.NODE_ENV` to determine the environment.

