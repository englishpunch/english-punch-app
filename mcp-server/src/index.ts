#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DEFAULT_SCOPES } from "./config.js";
import { getConvexClient } from "./convex-client.js";
import { createEnglishPunchServer } from "./server.js";

// Authenticate and validate env vars on startup (will throw if missing)
const client = await getConvexClient();
const server = createEnglishPunchServer(client, DEFAULT_SCOPES);

// Prompts and resources will be registered here in Phase 5:
// registerCardGenerationPrompts(server);
// registerSchemaResources(server);

const transport = new StdioServerTransport();
await server.connect(transport);
