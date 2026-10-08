import { describe, expect, it } from "vitest";
import config from "../vite.config.js";

const inline = config.build?.assetsInlineLimit;

describe("vite build config", () => {
  it("never inlines fonts as data: URLs (the CSP only allows font-src 'self')", () => {
    expect(typeof inline).toBe("function");
    const decide = inline as (file: string, content: Buffer) => boolean | undefined;
    const tiny = new Uint8Array(10) as unknown as Buffer;
    expect(decide("/x/fragment-mono-latin-ext-400-normal.woff2", tiny)).toBe(false);
    expect(decide("/x/zilla-slab-latin-400-normal.woff", tiny)).toBe(false);
    expect(decide("/x/seal.svg", tiny)).toBeUndefined();
  });
});
