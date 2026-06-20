# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

A Model Context Protocol (MCP) server that exposes Flarum forum CRUD operations (discussions, posts, users, tags) to MCP clients such as Claude Code. It communicates with a Flarum instance over its JSON:API and uses stdio as the MCP transport.

## Development commands

```bash
npm install        # install dependencies
npm run build      # compile TypeScript to build/
npm run dev        # compile in watch mode
npm start          # run the compiled server from build/
npm run prepublishOnly  # runs npm run build before publishing
```

There are currently no test or lint scripts in `package.json`. Add tests via a new script (e.g. `"test": "node --test"`) if introducing them.

## High-level architecture

- **`src/index.ts`** — Entry point. Creates the MCP `Server`, registers tools via `registerTools()`, and attempts auto-login from a cached token or from `FLARUM_USERNAME`/`FLARUM_PASSWORD` env vars. Uses `StdioServerTransport`, so all diagnostic logging must go to `stderr` (`console.error`) to avoid corrupting the MCP protocol on `stdout`.
- **`src/flarum-client.ts`** — `FlarumClient` singleton (`flarumClient`) that wraps all HTTP calls to the Flarum JSON:API. Responsibilities:
  - Token lifecycle: login, logout, validation, and file caching at `~/.flarum-mcp-token.json` with a 5-year expiration when `remember=true`.
  - `baseUrl` resolution from constructor arg → `FLARUM_BASE_URL` env var → `http://localhost`.
  - CRUD for discussions, posts, users, and tags.
  - Soft-delete default: `deleteDiscussion()` / `deletePost()` hide the resource via `PATCH` with `isHidden: true`; permanent deletion uses `DELETE` and requires admin permissions.
  - Discussion filtering uses Flarum's Gambit syntax (`author:`, `tag:`, `created:`) joined into `filter[q]`.
  - Parses `included` JSON:API resources into author/tag/firstPost fields on domain objects.
- **`src/tools/index.ts`** — MCP tool definitions and the dispatch switch. Each `Tool` has an `inputSchema`; the matching handler validates authentication (for write operations), calls `flarumClient`, and returns a JSON-stringified text result.
- **`src/types.ts`** — TypeScript interfaces for JSON:API envelopes and the domain models (`Discussion`, `Post`, `User`, `Tag`, `ListParams`, etc.).

## Important implementation details

- **Transport**: stdio. Never write to `console.log` / `process.stdout`; use `console.error` for logs.
- **ESM / TypeScript**: `type: "module"`, `module: "Node16"`, `moduleResolution: "Node16"`. Import paths must include the `.js` extension even when referencing `.ts` source.
- **Node version**: `>= 18.0.0`.
- **Authentication**: If credentials are supplied via env vars, the server logs in automatically at startup and caches the token. The cache is bound to `baseUrl`; a different forum URL invalidates the cached token.
- **Tool schema nuance**: `flarum_list_discussions` has a `username` filter whose description instructs clients to convert Chinese display names to pinyin (e.g. 「张三」 → `zhangsan`). Do not silently change this behavior without updating the description.
- **Published package**: Only `build/**/*` is included in the published package (`files` in `package.json`). The CLI bin is `./build/index.js`.

## Configuration

Users configure the server in `~/.claude/settings.json` with:

```json
{
  "mcpServers": {
    "flarum": {
      "command": "flarum-mcp-server",
      "env": {
        "FLARUM_BASE_URL": "https://your-forum.com",
        "FLARUM_USERNAME": "your-email@example.com",
        "FLARUM_PASSWORD": "your-password"
      }
    }
  }
}
```

See `README.md` for the full English and Chinese documentation, tool list, and usage examples.

## Security note

`claude-mcp-config.json` at the repository root currently contains plaintext credentials (`FLARUM_USERNAME` and `FLARUM_PASSWORD`). This file is tracked by git. It should be removed from git history, rotated, and added to `.gitignore`; credentials should never be committed.
