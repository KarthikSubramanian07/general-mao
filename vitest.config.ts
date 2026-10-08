import { defineConfig } from "vitest/config";

// Pure, hermetic unit tests for the engine and protocol packages, plus the web
// app's edge routing, content, and prerender output. These run in a
// plain Node environment with no Cloudflare runtime and no network. The Durable
// Object integration tests live in apps/server with their own workers-pool config.
export default defineConfig({
  test: {
    include: ["packages/**/src/**/*.test.ts", "apps/web/src/**/*.test.{ts,tsx}"],
    environment: "node",
    globals: false,
    coverage: {
      provider: "v8",
      include: ["packages/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"],
    },
  },
});
