import { validateRuleset } from "@mao/engine";
import { describe, expect, it } from "vitest";
import { CURATED } from "./curated.js";
import { buildRuleset, StubAIProvider } from "./stub.js";
import type { RulesetRequest } from "./types.js";

const baseReq = (over: Partial<RulesetRequest> = {}): RulesetRequest => ({
  mode: "classic",
  difficulty: "standard",
  themeId: null,
  byoRules: null,
  seed: "seed-1",
  playerCount: 3,
  ...over,
});

describe("curated library", () => {
  it("every curated ruleset passes the engine validator", () => {
    for (const t of CURATED) {
      const rs = buildRuleset(t, "seed");
      const result = validateRuleset(rs);
      expect(result.ok, `${t.id}: ${result.errors.join("; ")}`).toBe(true);
    }
  });

  it("covers all three difficulties", () => {
    const diffs = new Set(CURATED.map((t) => t.difficulty));
    expect(diffs.has("gentle")).toBe(true);
    expect(diffs.has("standard")).toBe(true);
    expect(diffs.has("brutal")).toBe(true);
  });
});

describe("StubAIProvider", () => {
  const stub = new StubAIProvider();

  it("is not billable", () => {
    expect(stub.billable).toBe(false);
  });

  it("generates a valid ruleset for classic mode, deterministic per seed", async () => {
    const a = await stub.generateRuleset(baseReq({ seed: "abc" }));
    const b = await stub.generateRuleset(baseReq({ seed: "abc" }));
    expect(a.id).toBe(b.id);
    expect(validateRuleset(a).ok).toBe(true);
  });

  it("honors the difficulty dial", async () => {
    const gentle = await stub.generateRuleset(baseReq({ difficulty: "gentle" }));
    expect(gentle.difficulty).toBe("gentle");
    const brutal = await stub.generateRuleset(baseReq({ difficulty: "brutal", seed: "x" }));
    expect(brutal.difficulty).toBe("brutal");
  });

  it("returns the chosen theme in themed mode", async () => {
    const rs = await stub.generateRuleset(baseReq({ mode: "themed", themeId: "victorian-court" }));
    expect(rs.id).toBe("victorian-court");
  });

  it("uses the gentle boot camp for practice mode", async () => {
    const rs = await stub.generateRuleset(baseReq({ mode: "practice" }));
    expect(rs.id).toBe("boot-camp");
  });

  it("judges semantic prohibitions heuristically", async () => {
    expect(await stub.judgeSpeech("Is seven special?", "asking a question")).toBe(true);
    expect(await stub.judgeSpeech("The eights are cruel.", "asking a question")).toBe(false);
    expect(await stub.judgeSpeech("thank you kindly", "any expression of gratitude")).toBe(true);
    expect(await stub.judgeSpeech("an unknown rule", "a totally novel constraint")).toBe(false);
  });
});
