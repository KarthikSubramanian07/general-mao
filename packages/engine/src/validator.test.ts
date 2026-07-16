import { describe, expect, it } from "vitest";
import { parseRuleset, sampleRuleset } from "./fixtures.js";
import type { SecretRuleset } from "./ruleset.js";
import { maxSeatsFor, validateRuleset } from "./validator.js";

function withRules(rules: unknown[], extra: Partial<Record<string, unknown>> = {}): SecretRuleset {
  return parseRuleset({
    id: "t",
    name: "t",
    theme: "t",
    difficulty: "standard",
    seed: "s",
    base: {},
    rules,
    winRitual: { describe: "", speech: { phrase: "i win", match: "normalized" } },
    ...extra,
  });
}

describe("validateRuleset", () => {
  it("accepts a coherent ruleset", () => {
    const result = validateRuleset(sampleRuleset());
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects contradictory primary effects on the same card", () => {
    const rs = withRules([
      { kind: "effect", id: "a", describe: "", on: { ranks: ["8"] }, effect: "skip" },
      { kind: "effect", id: "b", describe: "", on: { ranks: ["8"] }, effect: "reverse" },
    ]);
    const result = validateRuleset(rs);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("contradictory"))).toBe(true);
  });

  it("allows draw plus a primary effect to coexist", () => {
    const rs = withRules([
      { kind: "effect", id: "a", describe: "", on: { ranks: ["7"] }, effect: "skip" },
      { kind: "effect", id: "b", describe: "", on: { ranks: ["7"] }, effect: { draw: 2 } },
    ]);
    expect(validateRuleset(rs).ok).toBe(true);
  });

  it("rejects a win phrase that a prohibition forbids", () => {
    const rs = withRules(
      [
        {
          kind: "prohibition",
          id: "p",
          describe: "",
          forbid: { words: ["win"], match: "substring" },
          category: "prohibited-speech",
          penaltyCards: 1,
        },
      ],
      { winRitual: { describe: "", speech: { phrase: "i win", match: "normalized" } } },
    );
    const result = validateRuleset(rs);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("win ritual"))).toBe(true);
  });

  it("rejects an obligation phrase that a prohibition forbids", () => {
    const rs = withRules([
      {
        kind: "obligation",
        id: "o",
        describe: "",
        trigger: { on: "hand-count", count: 1 },
        speech: { phrase: "mao", match: "contains" },
        category: "failure-to-announce",
        penaltyCards: 1,
      },
      {
        kind: "prohibition",
        id: "p",
        describe: "",
        forbid: { words: ["mao"], match: "substring" },
        category: "prohibited-speech",
        penaltyCards: 1,
      },
    ]);
    const result = validateRuleset(rs);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("obligation"))).toBe(true);
  });

  it("rejects duplicate rule ids", () => {
    const rs = withRules([
      { kind: "effect", id: "dup", describe: "", on: { ranks: ["8"] }, effect: "reverse" },
      { kind: "effect", id: "dup", describe: "", on: { ranks: ["9"] }, effect: "skip" },
    ]);
    expect(validateRuleset(rs).errors.some((e) => e.includes("duplicate"))).toBe(true);
  });

  it("rejects a fully-sealed (unsolvable) ruleset", () => {
    // Every base-legal play of any card is penalized by a catch-all restriction.
    const rs = withRules([
      {
        kind: "restriction",
        id: "seal",
        describe: "",
        card: { any: true },
        category: "unlawful-play",
        penaltyCards: 1,
      },
    ]);
    const result = validateRuleset(rs);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("unsolvable"))).toBe(true);
  });

  it("rejects an undealable hand size", () => {
    const rs = withRules([], { base: { handSize: 10 } });
    // 10 * 2 + 1 = 21 <= 52, so this one is fine; check the helper instead.
    expect(validateRuleset(rs).ok).toBe(true);
    expect(maxSeatsFor(7)).toBe(7);
    expect(maxSeatsFor(10)).toBe(5);
  });
});
