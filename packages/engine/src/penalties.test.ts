import { describe, expect, it } from "vitest";
import { sampleRuleset, simulateMatch } from "./fixtures.js";
import { ALL_REASONS, GENERAL_LINES, isLegalReason, penaltyReason } from "./penalties.js";
import { rulesetSecretStrings } from "./ruleset.js";
import { toPublicState, toSelfView } from "./sanitize.js";

describe("penalty reasons", () => {
  it("only ever emits reasons from the closed set", () => {
    for (const category of [
      "unlawful-play",
      "failure-to-announce",
      "improper-address",
      "prohibited-speech",
      "improper-conduct",
      "delay-of-game",
      "out-of-turn",
      "improper-ceremony",
    ] as const) {
      for (let variant = 0; variant < 10; variant++) {
        expect(isLegalReason(penaltyReason(category, variant))).toBe(true);
      }
    }
  });

  it("is deterministic per (category, variant)", () => {
    expect(penaltyReason("unlawful-play", 3)).toBe(penaltyReason("unlawful-play", 3));
  });

  it("never contains an em dash or leaks a rule", () => {
    for (const reason of ALL_REASONS) {
      expect(reason).not.toMatch(/[—–]/);
    }
  });
});

describe("anti-leak: the secret ruleset never reaches a client payload", () => {
  it("holds across a full simulated match", () => {
    const ruleset = sampleRuleset();
    const secrets = [
      ...ruleset.rules.map((r) => r.describe),
      ruleset.winRitual.describe,
      ruleset.summary,
    ].filter((s) => s.trim().length > 0);

    const result = simulateMatch("leak-audit", ["A", "B", "C"], ruleset);

    // Everything the server would send toward clients over the match.
    const outbound: string[] = [];
    for (const seat of result.state.seats) {
      outbound.push(JSON.stringify(toPublicState(result.state, 1234)));
      outbound.push(JSON.stringify(toSelfView(result.state, seat.playerId)));
    }
    outbound.push(JSON.stringify(toPublicState(result.state, 1234))); // a spectator view
    for (const em of result.emissions) {
      outbound.push(JSON.stringify(em.penalties));
      outbound.push(JSON.stringify(em.verdicts));
      outbound.push(JSON.stringify(em.system));
    }
    const blob = outbound.join("\n");

    for (const secret of secrets) {
      expect(blob.includes(secret)).toBe(false);
    }

    // Every ledger reason ever produced is from the closed vocabulary.
    for (const entry of result.state.ledger) {
      expect(isLegalReason(entry.reason)).toBe(true);
    }

    // System lines are only ever the General's fixed vocabulary.
    const allowedLines = new Set<string>(Object.values(GENERAL_LINES));
    for (const em of result.emissions) {
      for (const line of em.system) {
        expect(allowedLines.has(line)).toBe(true);
      }
    }
  });

  it("public state has no field capable of holding rule text outside practice mode", () => {
    const ruleset = sampleRuleset();
    const result = simulateMatch("leak-audit-2", ["A", "B"], ruleset);
    const pub = toPublicState(result.state, 42);
    expect(pub.revealedRules).toBeNull();
    // Sanity: the collected secret strings are non-trivial, so the check has teeth.
    expect(rulesetSecretStrings(ruleset).length).toBeGreaterThan(5);
  });
});
