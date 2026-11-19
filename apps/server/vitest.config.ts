import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Integration tests that run inside the real Workers runtime (workerd) with the
// Durable Object and KV bindings from wrangler.jsonc emulated locally.
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
  test: {
    include: ["src/**/*.test.ts"],
  },
});
