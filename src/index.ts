#!/usr/bin/env node

/**
 * Flarum MCP Server
 *
 * Provides CRUD operations for Flarum forums
 *
 * Environment variables:
 * - FLARUM_BASE_URL: Flarum forum URL (default: http://localhost)
 * - FLARUM_USERNAME: Username or email (optional, used for auto-login)
 * - FLARUM_PASSWORD: Password (optional, used for auto-login)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { flarumClient } from "./flarum-client.js";

// Create MCP server
const server = new Server(
  {
    name: "flarum-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register all tools
registerTools(server);

// Auto-login (prefer cached token)
async function autoLogin(): Promise<void> {
  // 1. Try loading cached token
  if (flarumClient.loadCachedToken()) {
    console.error("Cached token found, validating...");

    // Validate token
    const isValid = await flarumClient.validateToken();
    if (isValid) {
      console.error("✓ Login succeeded using cached token");
      return;
    } else {
      console.error("Cached token expired, trying to re-login...");
    }
  }

  // 2. If no valid cache, login with environment variables
  const username = process.env.FLARUM_USERNAME;
  const password = process.env.FLARUM_PASSWORD;

  if (username && password) {
    try {
      const result = await flarumClient.login(username, password, true);
      console.error(`✓ Login successful，UserID: ${result.userId}`);
    } catch (error) {
      console.error(`✗ Login failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Start server
async function main(): Promise<void> {
  console.error("Flarum MCP Server starting...");
  console.error(`Forum URL: ${process.env.FLARUM_BASE_URL || "http://localhost"}`);

  // Attempting auto-login
  await autoLogin();

  // Connect transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Flarum MCP Server ready");
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});
