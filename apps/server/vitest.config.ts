import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Integration tests that run inside the real Workers runtime (workerd) with the
// Durable Object, KV, and D1 bindings from wrangler.jsonc emulated locally.
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
