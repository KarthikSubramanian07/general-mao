/**
 * The curated ruleset library. Every entry is hand-authored, coherent, and must
 * pass the engine's consistency validator (a test enforces this). This library
 * is what makes the game fully playable at $0 with no API key: the stub provider
 * serves these, and popular themes are cached in KV so they cost nothing to
 * re-serve even when the real generator is enabled.
 */

import type { Difficulty } from "@mao/protocol";

export interface CuratedTemplate {
  id: string;
  name: string;
  theme: string;
  difficulty: Difficulty;
  base: Record<string, unknown>;
  rules: unknown[];
  winRitual: Record<string, unknown>;
  summary: string;
  blurb: string;
}

export const CURATED: CuratedTemplate[] = [
  {
    id: "boot-camp",
    name: "Boot Camp",
    theme: "Recruitment",
    difficulty: "gentle",
    base: { handSize: 7, startingDirection: 1 },
    rules: [
      {
        kind: "effect",
        id: "wild-jacks",
        describe: "Jacks are wild and set the suit.",
        on: { ranks: ["J"] },
        effect: "wild",
      },
      {
        kind: "effect",
        id: "skip-aces",
        describe: "An ace skips the next recruit.",
        on: { ranks: ["A"] },
        effect: "skip",
      },
      {
        kind: "obligation",
        id: "call-mao",
        describe: "On your second-to-last card, call 'Mao'.",
        trigger: { on: "hand-count", count: 1 },
        actor: "player",
        speech: { phrase: "mao", match: "contains" },
        category: "failure-to-announce",
        penaltyCards: 1,
      },
    ],
    winRitual: {
      describe: "To be discharged, declare: 'The game is over.'",
      speech: { phrase: "the game is over", match: "normalized" },
      penaltyCards: 1,
    },
    summary: "Jacks wild, aces skip, call Mao at one card, declare 'the game is over' to win.",
    blurb: "Three plain rules. The kindest the General ever gets.",
  },
  {
    id: "standing-orders",
    name: "The Standing Orders",
    theme: "Garrison",
    difficulty: "standard",
    base: { handSize: 7, startingDirection: 1 },
    rules: [
      {
        kind: "effect",
        id: "reverse-eights",
        describe: "Eights reverse the direction of play.",
        on: { ranks: ["8"] },
        effect: "reverse",
      },
      {
        kind: "effect",
        id: "skip-aces",
        describe: "Aces skip the next player.",
        on: { ranks: ["A"] },
        effect: "skip",
      },
      {
        kind: "effect",
        id: "draw-sevens",
        describe: "A seven forces the next player to draw two.",
        on: { ranks: ["7"] },
        effect: { draw: 2 },
      },
      {
        kind: "effect",
        id: "wild-jacks",
        describe: "Jacks are wild and change the suit.",
        on: { ranks: ["J"] },
        effect: "wild",
      },
      {
        kind: "restriction",
        id: "no-red-after-black-face",
        describe: "You may not play a red card directly onto a black face card.",
        card: { colors: ["red"] },
        prev: { colors: ["black"], face: true },
        category: "unlawful-play",
        penaltyCards: 1,
      },
      {
        kind: "obligation",
        id: "announce-mao",
        describe: "On your second-to-last card, say 'Mao'.",
        trigger: { on: "hand-count", count: 1 },
        actor: "player",
        speech: { phrase: "mao", match: "contains" },
        category: "failure-to-announce",
        penaltyCards: 1,
      },
      {
        kind: "obligation",
        id: "address-spades",
        describe: "When you play a spade, name the suit aloud.",
        trigger: { on: "play", selector: { suits: ["spades"] } },
        actor: "player",
        speech: { phrase: "spades", match: "contains" },
        category: "improper-address",
        penaltyCards: 1,
      },
      {
        kind: "prohibition",
        id: "no-gratitude",
        describe: "Do not thank anyone.",
        forbid: { words: ["thank", "thanks"], match: "substring" },
        category: "prohibited-speech",
        penaltyCards: 1,
      },
    ],
    winRitual: {
      describe: "To win, declare: 'The game of Mao has ended.'",
      speech: { phrase: "the game of mao has ended", match: "normalized" },
      penaltyCards: 2,
    },
    summary:
      "Eights reverse, aces skip, sevens deal two, jacks wild; name spades, say Mao, never thank.",
    blurb: "The house standard. A little of everything the General enjoys.",
  },
  {
    id: "victorian-court",
    name: "Victorian Court",
    theme: "Etiquette",
    difficulty: "standard",
    base: { handSize: 7, startingDirection: 1 },
    rules: [
      {
        kind: "effect",
        id: "wild-jacks",
        describe: "Jacks are wild and change the suit.",
        on: { ranks: ["J"] },
        effect: "wild",
      },
      {
        kind: "effect",
        id: "queen-again",
        describe: "A queen grants you a second turn.",
        on: { ranks: ["Q"] },
        effect: "extra-turn",
      },
      {
        kind: "restriction",
        id: "no-clubs-on-hearts",
        describe: "Clubs may not be laid upon hearts. It is uncouth.",
        card: { suits: ["clubs"] },
        prev: { suits: ["hearts"] },
        category: "improper-conduct",
        penaltyCards: 1,
      },
      {
        kind: "obligation",
        id: "address-royalty",
        describe: "When you play a face card, say 'your grace'.",
        trigger: { on: "play", selector: { face: true } },
        actor: "player",
        speech: { phrase: "your grace", match: "contains" },
        category: "improper-address",
        penaltyCards: 1,
      },
      {
        kind: "obligation",
        id: "one-card-notice",
        describe: "At one card, announce 'one card, if it please the court'.",
        trigger: { on: "hand-count", count: 1 },
        actor: "player",
        speech: { phrase: "one card", match: "contains" },
        category: "failure-to-announce",
        penaltyCards: 1,
      },
      {
        kind: "prohibition",
        id: "no-vulgarity",
        describe: "Do not thank; gratitude is common.",
        forbid: { words: ["thanks", "thank"], match: "substring" },
        category: "prohibited-speech",
        penaltyCards: 1,
      },
    ],
    winRitual: {
      describe: "To win, declare: 'The court is adjourned.'",
      speech: { phrase: "the court is adjourned", match: "normalized" },
      penaltyCards: 2,
    },
    summary:
      "Jacks wild, queens grant a turn; address faces as 'your grace', clubs never on hearts.",
    blurb: "Address your betters correctly, or be corrected.",
  },
  {
    id: "superstition",
    name: "Superstition",
    theme: "Omens",
    difficulty: "standard",
    base: { handSize: 7, startingDirection: 1 },
    rules: [
      {
        kind: "effect",
        id: "wild-jacks",
        describe: "Jacks are wild and change the suit.",
        on: { ranks: ["J"] },
        effect: "wild",
      },
      {
        kind: "effect",
        id: "unlucky-seven",
        describe: "A seven is unlucky and skips the next player.",
        on: { ranks: ["7"] },
        effect: "skip",
      },
      {
        kind: "effect",
        id: "fateful-four",
        describe: "A four draws one from the next player.",
        on: { ranks: ["4"] },
        effect: { draw: 1 },
      },
      {
        kind: "restriction",
        id: "no-red-on-red",
        describe: "Two reds in a row is an ill omen and is forbidden.",
        card: { colors: ["red"] },
        prev: { colors: ["red"] },
        category: "unlawful-play",
        penaltyCards: 1,
      },
      {
        kind: "obligation",
        id: "ward-off-spades",
        describe: "When you play a spade, say 'knock on wood'.",
        trigger: { on: "play", selector: { suits: ["spades"] } },
        actor: "player",
        speech: { phrase: "knock on wood", match: "contains" },
        category: "failure-to-announce",
        penaltyCards: 1,
      },
      {
        kind: "prohibition",
        id: "unspeakable-number",
        describe: "Never speak the number four; it invites misfortune.",
        forbid: { words: ["four", "4"], match: "substring" },
        category: "prohibited-speech",
        penaltyCards: 1,
      },
    ],
    winRitual: {
      describe: "To win, declare: 'Fortune favors me.'",
      speech: { phrase: "fortune favors me", match: "normalized" },
      penaltyCards: 2,
    },
    summary:
      "Jacks wild, sevens skip, fours draw one; no red on red, ward spades, never say 'four'.",
    blurb: "Colors, numbers, and the things you must not name.",
  },
  {
    id: "bureaucracy",
    name: "The Ministry",
    theme: "Procedure",
    difficulty: "brutal",
    base: { handSize: 7, startingDirection: 1 },
    rules: [
      {
        kind: "effect",
        id: "wild-jacks",
        describe: "Jacks are wild and reassign the suit.",
        on: { ranks: ["J"] },
        effect: "wild",
      },
      {
        kind: "effect",
        id: "form-five",
        describe: "A five halts the queue and skips the next clerk.",
        on: { ranks: ["5"] },
        effect: "skip",
      },
      {
        kind: "effect",
        id: "reverse-eights",
        describe: "Eights reverse the order of business.",
        on: { ranks: ["8"] },
        effect: "reverse",
      },
      {
        kind: "effect",
        id: "levy-three",
        describe: "A three levies a card from the next clerk.",
        on: { ranks: ["3"] },
        effect: { draw: 1 },
      },
      {
        kind: "restriction",
        id: "no-number-on-face",
        describe: "A numeral may not be filed upon a face card without a form.",
        card: { face: false },
        prev: { face: true },
        category: "improper-conduct",
        penaltyCards: 1,
      },
      {
        kind: "obligation",
        id: "point-of-order",
        describe: "When you play a face card, declare 'point of order'.",
        trigger: { on: "play", selector: { face: true } },
        actor: "player",
        speech: { phrase: "point of order", match: "contains" },
        category: "improper-conduct",
        penaltyCards: 1,
      },
      {
        kind: "obligation",
        id: "final-submission",
        describe: "At one card, announce 'final submission'.",
        trigger: { on: "hand-count", count: 1 },
        actor: "player",
        speech: { phrase: "final submission", match: "contains" },
        category: "failure-to-announce",
        penaltyCards: 1,
      },
      {
        kind: "prohibition",
        id: "no-pleasantries",
        describe: "Pleasantries waste the Ministry's time. Do not say 'please'.",
        forbid: { words: ["please"], match: "substring" },
        category: "prohibited-speech",
        penaltyCards: 1,
      },
    ],
    winRitual: {
      describe: "To win, declare: 'The matter is closed.'",
      speech: { phrase: "the matter is closed", match: "normalized" },
      penaltyCards: 2,
    },
    summary:
      "Jacks wild, fives skip, eights reverse, threes levy; numbers never on faces, procedure everywhere.",
    blurb: "A dozen small procedures, each enforced to the letter.",
  },
  {
    id: "silent-service",
    name: "The Silent Service",
    theme: "Submarine",
    difficulty: "brutal",
    base: { handSize: 7, startingDirection: 1 },
    rules: [
      {
        kind: "effect",
        id: "wild-jacks",
        describe: "Jacks are wild and reroute the suit.",
        on: { ranks: ["J"] },
        effect: "wild",
      },
      {
        kind: "effect",
        id: "silent-six",
        describe: "A six skips the next hand at the boards.",
        on: { ranks: ["6"] },
        effect: "skip",
      },
      {
        kind: "effect",
        id: "reverse-eights",
        describe: "Eights reverse the watch order.",
        on: { ranks: ["8"] },
        effect: "reverse",
      },
      {
        kind: "obligation",
        id: "sound-the-suit",
        describe: "When you change the suit with a jack, call 'new bearing'.",
        trigger: { on: "suit-change" },
        actor: "player",
        speech: { phrase: "new bearing", match: "contains" },
        category: "failure-to-announce",
        penaltyCards: 1,
      },
      {
        kind: "obligation",
        id: "one-in-the-tube",
        describe: "At one card, report 'one in the tube'.",
        trigger: { on: "hand-count", count: 1 },
        actor: "player",
        speech: { phrase: "one in the tube", match: "contains" },
        category: "failure-to-announce",
        penaltyCards: 1,
      },
      {
        kind: "prohibition",
        id: "the-forbidden-verb",
        describe: "The word 'have' compromises the boat. Never use it.",
        forbid: { words: ["have"], match: "word" },
        category: "prohibited-speech",
        penaltyCards: 1,
      },
      {
        kind: "prohibition",
        id: "no-questions",
        describe: "Questions are not permitted below the surface.",
        forbid: { semantic: "asking a question or requesting information" },
        category: "prohibited-speech",
        penaltyCards: 1,
      },
    ],
    winRitual: {
      describe: "To surface, declare: 'The boat is silent.'",
      speech: { phrase: "the boat is silent", match: "normalized" },
      penaltyCards: 2,
    },
    summary:
      "Jacks wild, sixes skip, eights reverse; call bearings, never say 'have', ask nothing.",
    blurb: "Speak only when the rules demand it. Ask nothing.",
  },
];

export const CURATED_BY_ID: Record<string, CuratedTemplate> = Object.fromEntries(
  CURATED.map((t) => [t.id, t]),
);

/** Public, client-safe listing for the theme picker (no rule content). */
export interface ThemeCard {
  id: string;
  name: string;
  theme: string;
  difficulty: Difficulty;
  blurb: string;
}

export function themeCatalog(): ThemeCard[] {
  return CURATED.map((t) => ({
    id: t.id,
    name: t.name,
    theme: t.theme,
    difficulty: t.difficulty,
    blurb: t.blurb,
  }));
}
