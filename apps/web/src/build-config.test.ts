import { describe, expect, it } from "vitest";
import config from "../vite.config.js";

const inline = config.build?.assetsInlineLimit;

describe("vite build config", () => {
  it("never inlines fonts as data: URLs (the CSP only allows font-src 'self')", () => {
    if (typeof inline !== "function") throw new Error("assetsInlineLimit must be a function");
    const tiny = new Uint8Array(10) as unknown as Parameters<typeof inline>[1];
    const decide = (file: string) => inline(file, tiny);
    expect(decide("/x/fragment-mono-latin-ext-400-normal.woff2")).toBe(false);
    expect(decide("/x/zilla-slab-latin-400-normal.woff")).toBe(false);
    expect(decide("/x/seal.svg")).toBeUndefined();
  });
});
