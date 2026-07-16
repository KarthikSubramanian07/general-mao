/**
 * The General's vocabulary of penalties. This is a CLOSED set. The engine may
 * only ever emit a reason string drawn from this table. A reason names the
 * category of the sin and nothing else: honest about "why", silent about "how".
 *
 * Because the set is closed and fixed, no rule text can leak through a reason
 * string even by accident. The anti-leak test asserts every emitted reason is a
 * member of `ALL_REASONS`.
 */

import type { PenaltyCategory } from "@mao/protocol";

const REASONS: Record<PenaltyCategory, readonly string[]> = {
  "unlawful-play": ["Penalty: unlawful play.", "Penalty: that card was not permitted."],
  "failure-to-announce": [
    "Penalty: failure to announce.",
    "Penalty: a required declaration was not made.",
  ],
  "improper-address": ["Penalty: improper address.", "Penalty: you were not addressed correctly."],
  "prohibited-speech": ["Penalty: prohibited speech.", "Penalty: that was not to be said."],
  "improper-conduct": ["Penalty: improper conduct.", "Penalty: conduct unbecoming of the table."],
  "delay-of-game": ["Penalty: delay of game.", "Penalty: the table was kept waiting."],
  "out-of-turn": ["Penalty: acting out of turn.", "Penalty: it was not your moment."],
  "improper-ceremony": [
    "Penalty: improper ceremony.",
    "Penalty: the rite of departure was not observed.",
  ],
};

/**
 * Deterministic reason selection. Same category + same variant index always
 * yields the same string, keeping adjudication reproducible while giving the
 * General a little judicial variety.
 */
export function penaltyReason(category: PenaltyCategory, variant = 0): string {
  const options = REASONS[category];
  return options[Math.abs(variant) % options.length] as string;
}

/** The full closed set of legal reason strings. */
export const ALL_REASONS: readonly string[] = Object.values(REASONS).flat();

export function isLegalReason(reason: string): boolean {
  return ALL_REASONS.includes(reason);
}

/** The General's deadpan flavor lines. Also a closed set. */
export const GENERAL_LINES = {
  onlyRule: "The only rule I may tell you is this one.",
  matchBegins: "The game of Mao has begun.",
  matchEnds: "The game of Mao has ended.",
  correct: "Correct.",
  seated: "Take your seat. Say nothing you were not asked to say.",
  yourMove: "The table waits.",
} as const;
