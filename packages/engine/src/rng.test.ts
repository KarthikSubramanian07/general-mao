import { describe, expect, it } from "vitest";
import { makeRng, shuffle } from "./rng.js";

describe("seeded rng", () => {
  it("is deterministic for a given seed", () => {
    const a = makeRng("seed-1");
    const b = makeRng("seed-1");
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it("produces different streams for different seeds", () => {
    const a = Array.from({ length: 20 }, makeRng("seed-1").next);
    const b = Array.from({ length: 20 }, makeRng("seed-2").next);
    expect(a).not.toEqual(b);
  });

  it("keeps values in [0, 1)", () => {
    const r = makeRng("range");
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int(n) stays in [0, n)", () => {
    const r = makeRng("ints");
    for (let i = 0; i < 1000; i++) {
      const v = r.int(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("shuffle is a permutation and deterministic per seed", () => {
    const src = Array.from({ length: 52 }, (_, i) => i);
    const s1 = shuffle(src.slice(), makeRng("deck"));
    const s2 = shuffle(src.slice(), makeRng("deck"));
    expect(s1).toEqual(s2);
    expect([...s1].sort((a, b) => a - b)).toEqual(src);
  });

  it("fork yields independent, reproducible streams", () => {
    const base = makeRng("base");
    const f1 = base.fork("a");
    const f2 = base.fork("a");
    const f3 = base.fork("b");
    expect(Array.from({ length: 5 }, f1.next)).toEqual(Array.from({ length: 5 }, f2.next));
    expect(Array.from({ length: 5 }, base.fork("a").next)).not.toEqual(
      Array.from({ length: 5 }, f3.next),
    );
  });

  it("pick throws on empty", () => {
    expect(() => makeRng("x").pick([])).toThrow();
  });
});
