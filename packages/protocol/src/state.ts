/**
 * The sanitized, client-bound view of a table. Anything a client is allowed to
 * see lives here. The secret ruleset is NEVER represented in these types, so a
 * leak into a client payload is a type error, not just a runtime slip.
 */

import type { Card, Suit } from "./cards.js";

export type GamePhase = "lobby" | "playing" | "point-of-order" | "finished";

export type RulesetMode = "classic" | "themed" | "byo" | "practice";

export type Difficulty = "gentle" | "standard" | "brutal";

/**
 * Public penalty categories. The General names the *category* of a violation,
 * never the rule. These are the only categories a client can ever be told.
 */
export const PENALTY_CATEGORIES = [
  "unlawful-play",
  "failure-to-announce",
  "improper-address",
  "prohibited-speech",
  "improper-conduct",
  "delay-of-game",
  "out-of-turn",
  "improper-ceremony",
] as const;
export type PenaltyCategory = (typeof PENALTY_CATEGORIES)[number];

export interface PublicPlayer {
  id: string;
  name: string;
  seat: number;
  handCount: number;
  connected: boolean;
  isHost: boolean;
  penaltyCount: number;
  /** True once the player has legally completed the win ritual. */
  finished: boolean;
  /** Finishing position, 1-indexed; null while still in play. */
  place: number | null;
}

export interface LedgerEntry {
  seq: number;
  at: number;
  playerId: string;
  playerName: string;
  category: PenaltyCategory;
  /** A validated, uninformative reason string. Never contains rule text. */
  reason: string;
  /** The card that triggered the penalty, if a card play triggered it. Public. */
  card: Card | null;
  penaltyCards: number;
}

/**
 * A rare, ceremonial confirmation. Emitted only when a player has, in table
 * chat, correctly and publicly stated a rule that the General recognizes. The
 * reveal is intentional and earned; it is the single "Correct." moment.
 */
export interface Verdict {
  seq: number;
  at: number;
  playerId: string;
  playerName: string;
  text: string;
}

export interface TableConfig {
  mode: RulesetMode;
  difficulty: Difficulty;
  themeId: string | null;
  /** Only meaningful in "practice" mode, where the rules are shown. */
  revealRules: boolean;
  maxPlayers: number;
}

export interface PublicGameState {
  code: string;
  phase: GamePhase;
  round: number;
  config: TableConfig;
  direction: 1 | -1;
  currentSeat: number | null;
  /** The suit currently in force (may differ from topCard after a suit change). */
  activeSuit: Suit | null;
  topCard: Card | null;
  drawPileCount: number;
  /** Accumulated forced-draw owed to the player who must next answer it. */
  pendingDraw: number;
  players: PublicPlayer[];
  ledger: LedgerEntry[];
  verdicts: Verdict[];
  winnerId: string | null;
  startedAt: number | null;
  /** Server clock at snapshot time, so clients can render "delay" timers. */
  now: number;
  turnDeadline: number | null;
  /**
   * Present only in "practice" mode. In every real mode this is null: the rules
   * are the game and are never shipped.
   */
  revealedRules: string[] | null;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  at: number;
  /** System lines from the General render differently. */
  system: boolean;
}
