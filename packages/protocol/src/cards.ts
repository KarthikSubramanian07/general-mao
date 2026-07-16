/**
 * Card primitives. These are public by nature: the identity of a card that has
 * been played is visible to the whole table. Nothing secret lives here.
 */

export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export type Rank = (typeof RANKS)[number];

export type Color = "black" | "red";

export interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}

const SUIT_CODE: Record<Suit, string> = {
  clubs: "C",
  diamonds: "D",
  hearts: "H",
  spades: "S",
};
const CODE_SUIT: Record<string, Suit> = {
  C: "clubs",
  D: "diamonds",
  H: "hearts",
  S: "spades",
};
const RANK_CODE: Record<Rank, string> = {
  A: "A",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "T",
  J: "J",
  Q: "Q",
  K: "K",
};
const CODE_RANK: Record<string, Rank> = Object.fromEntries(
  (Object.entries(RANK_CODE) as [Rank, string][]).map(([r, c]) => [c, r]),
);

/** Stable, compact, unique-per-standard-deck id, e.g. "7H", "TS", "AC". */
export function cardId(card: Card): string {
  return `${RANK_CODE[card.rank]}${SUIT_CODE[card.suit]}`;
}

export function parseCardId(id: string): Card | null {
  if (id.length !== 2) return null;
  const rank = CODE_RANK[id[0] as string];
  const suit = CODE_SUIT[id[1] as string];
  if (!rank || !suit) return null;
  return { rank, suit };
}

export function cardColor(card: Card): Color {
  return card.suit === "clubs" || card.suit === "spades" ? "black" : "red";
}

export function isFace(card: Card): boolean {
  return card.rank === "J" || card.rank === "Q" || card.rank === "K";
}

const RANK_NAME: Record<Rank, string> = {
  A: "Ace",
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  "10": "Ten",
  J: "Jack",
  Q: "Queen",
  K: "King",
};

const SUIT_NAME: Record<Suit, string> = {
  clubs: "Clubs",
  diamonds: "Diamonds",
  hearts: "Hearts",
  spades: "Spades",
};

/** Human label, e.g. "Seven of Spades". Public information. */
export function cardLabel(card: Card): string {
  return `${RANK_NAME[card.rank]} of ${SUIT_NAME[card.suit]}`;
}

export function rankName(rank: Rank): string {
  return RANK_NAME[rank];
}

export function suitName(suit: Suit): string {
  return SUIT_NAME[suit];
}

/** A fresh, ordered 52-card deck (not shuffled). */
export function standardDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}
