import type { Card } from "@mao/protocol";
import { describe, expect, it } from "vitest";
import type { ProhibitionRule } from "./ruleset.js";
import { matchesSelector, matchesSpeech, normalizeLoose, tripsProhibition } from "./selectors.js";

const c = (rank: Card["rank"], suit: Card["suit"]): Card => ({ rank, suit });

describe("matchesSelector", () => {
  it("matches any", () => {
    expect(matchesSelector(c("7", "hearts"), { any: true })).toBe(true);
  });
  it("matches by rank", () => {
    expect(matchesSelector(c("7", "hearts"), { ranks: ["7"] })).toBe(true);
    expect(matchesSelector(c("8", "hearts"), { ranks: ["7"] })).toBe(false);
  });
  it("matches by suit and color", () => {
    expect(matchesSelector(c("K", "spades"), { colors: ["black"] })).toBe(true);
    expect(matchesSelector(c("K", "hearts"), { colors: ["black"] })).toBe(false);
    expect(matchesSelector(c("K", "spades"), { suits: ["spades"] })).toBe(true);
  });
  it("matches face constraint", () => {
    expect(matchesSelector(c("K", "spades"), { face: true })).toBe(true);
    expect(matchesSelector(c("9", "spades"), { face: true })).toBe(false);
    expect(matchesSelector(c("9", "spades"), { face: false })).toBe(true);
  });
  it("ANDs multiple constraints", () => {
    expect(matchesSelector(c("K", "hearts"), { colors: ["red"], face: true })).toBe(true);
    expect(matchesSelector(c("9", "hearts"), { colors: ["red"], face: true })).toBe(false);
  });
});

describe("normalizeLoose", () => {
  it("lowercases, strips punctuation, collapses whitespace", () => {
    expect(normalizeLoose("  The GAME, of Mao!!  ")).toBe("the game of mao");
  });
});

describe("matchesSpeech", () => {
  it("exact ignores case and punctuation but needs the whole line", () => {
    expect(matchesSpeech("Mao.", { phrase: "mao", match: "exact" })).toBe(true);
    expect(matchesSpeech("say mao now", { phrase: "mao", match: "exact" })).toBe(false);
  });
  it("contains is a substring after normalization", () => {
    expect(matchesSpeech("I now say mao, friends", { phrase: "mao", match: "contains" })).toBe(
      true,
    );
  });
  it("normalized is an in-order subsequence of words", () => {
    expect(
      matchesSpeech("the great game of noble mao has finally ended", {
        phrase: "the game of mao has ended",
        match: "normalized",
      }),
    ).toBe(true);
    expect(
      matchesSpeech("ended the game of mao has", {
        phrase: "the game of mao has ended",
        match: "normalized",
      }),
    ).toBe(false);
  });
});

describe("tripsProhibition", () => {
  const words = (arr: string[], match: "word" | "substring"): ProhibitionRule => ({
    kind: "prohibition",
    id: "p",
    describe: "",
    forbid: { words: arr, match },
    category: "prohibited-speech",
    penaltyCards: 1,
  });

  it("word match requires a whole token", () => {
    expect(tripsProhibition("no thanks", words(["thanks"], "word"))).toBe(true);
    expect(tripsProhibition("thanksgiving", words(["thanks"], "word"))).toBe(false);
  });
  it("substring match is looser", () => {
    expect(tripsProhibition("thanksgiving", words(["thanks"], "substring"))).toBe(true);
  });
  it("pattern match uses a regex", () => {
    const rule: ProhibitionRule = {
      kind: "prohibition",
      id: "p",
      describe: "",
      forbid: { pattern: "\\bhave\\b" },
      category: "prohibited-speech",
      penaltyCards: 1,
    };
    expect(tripsProhibition("I have a card", rule)).toBe(true);
    expect(tripsProhibition("behave yourself", rule)).toBe(false);
  });
  it("semantic prohibitions are never decided locally", () => {
    const rule: ProhibitionRule = {
      kind: "prohibition",
      id: "p",
      describe: "",
      forbid: { semantic: "any expression of gratitude" },
      category: "prohibited-speech",
      penaltyCards: 1,
    };
    expect(tripsProhibition("thank you so much", rule)).toBe(false);
  });
});
