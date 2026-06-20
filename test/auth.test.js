import assert from "node:assert";
import { describe, it, beforeEach, afterEach } from "node:test";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FlarumClient } from "../build/flarum-client.js";

describe("FlarumClient security", () => {
  let tempDir;
  let originalFetch;

  beforeEach(() => {
    tempDir = join(tmpdir(), `flarum-mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("writes token cache with owner-only permissions", async () => {
    const cacheFile = join(tempDir, ".flarum-mcp-token.json");
    const client = new FlarumClient("http://localhost", { cacheFilePath: cacheFile });

    globalThis.fetch = async () => {
      return {
        status: 200,
        ok: true,
        json: async () => ({ token: "secret-token-12345", userId: "1" }),
      };
    };

    await client.login("user@example.com", "password");

    const stats = (await import("node:fs/promises")).stat(cacheFile);
    const mode = (await stats).mode & 0o777;
    assert.strictEqual(mode, 0o600, `expected 0o600 but got 0o${mode.toString(8)}`);
  });

  it("aborts requests that exceed the timeout", async () => {
    const client = new FlarumClient("http://localhost", {
      requestTimeoutMs: 50,
    });
    client.setToken("fake-token");

    globalThis.fetch = (_, options) => {
      return new Promise((_resolve, reject) => {
        if (options.signal?.aborted) {
          reject(new Error("Aborted"));
          return;
        }
        options.signal?.addEventListener("abort", () => {
          reject(new Error("Aborted"));
        });
      });
    };

    await assert.rejects(
      () => client.getTags(),
      /abort/i
    );
  });

  it("ignores cached token from a different forum", async () => {
    const cacheFile = join(tempDir, ".flarum-mcp-token.json");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      cacheFile,
      JSON.stringify({
        token: "old-token",
        userId: "1",
        baseUrl: "http://other-forum.com",
        createdAt: Date.now(),
        expiresAt: Date.now() + 1000 * 60 * 60 * 24,
      }),
      "utf-8"
    );

    const client = new FlarumClient("http://localhost", { cacheFilePath: cacheFile });
    assert.strictEqual(client.loadCachedToken(), false);
    assert.strictEqual(client.getToken(), null);
  });
});
