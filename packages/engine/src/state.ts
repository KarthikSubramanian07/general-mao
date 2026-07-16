/**
 * The authoritative, server-only game state. It holds full hands, the draw pile,
 * and pending obligations. It is never serialized toward a client; the sanitizer
 * in sanitize.ts produces the public view.
 */

import type {
  Card,
  ChatMessage,
  GamePhase,
  LedgerEntry,
  Suit,
  TableConfig,
  Verdict,
} from "@mao/protocol";
import { standardDeck } from "@mao/protocol";
import { makeRng, shuffle } from "./rng.js";
import type { SecretRuleset, SpeechReq } from "./ruleset.js";

export interface Seat {
  playerId: string;
  name: string;
  hand: Card[];
  connected: boolean;
  isHost: boolean;
  penaltyCount: number;
  finished: boolean;
  place: number | null;
}

export interface PendingObligation {
  ruleId: string;
  seat: number;
  category: LedgerEntry["category"];
  penaltyCards: number;
  speech: SpeechReq;
  createdAtAction: number;
}

export interface PendingWin {
  seat: number;
  speech: SpeechReq;
  penaltyCards: number;
  createdAtAction: number;
}

export interface GameState {
  code: string;
  phase: GamePhase;
  round: number;
  config: TableConfig;
  seats: Seat[];
  drawPile: Card[];
  discardPile: Card[];
  direction: 1 | -1;
  currentSeat: number | null;
  activeSuit: Suit | null;
  pendingDraw: number;
  ledger: LedgerEntry[];
  verdicts: Verdict[];
  chat: ChatMessage[];
  winnerId: string | null;
  startedAt: number | null;
  turnDeadline: number | null;
  turnLimitSeconds: number;

  // bookkeeping
  ledgerSeq: number;
  verdictSeq: number;
  actionCounter: number;
  reshuffleCount: number;
  finishedCount: number;
  pendingObligations: PendingObligation[];
  pendingWin: PendingWin | null;
  seed: string;
}

export const MAX_CHAT = 200;

export function createEmptyState(code: string, config: TableConfig, seed: string): GameState {
  return {
    code,
    phase: "lobby",
    round: 0,
    config,
    seats: [],
    drawPile: [],
    discardPile: [],
    direction: 1,
    currentSeat: null,
    activeSuit: null,
    pendingDraw: 0,
    ledger: [],
    verdicts: [],
    chat: [],
    winnerId: null,
    startedAt: null,
    turnDeadline: null,
    turnLimitSeconds: 0,
    ledgerSeq: 0,
    verdictSeq: 0,
    actionCounter: 0,
    reshuffleCount: 0,
    finishedCount: 0,
    pendingObligations: [],
    pendingWin: null,
    seed,
  };
}

/**
 * Deal a fresh round from the ruleset. Deterministic given the seed: the same
 * seed and seat roster always produce the same deal. This is a precondition of
 * the replay/determinism tests.
 */
export function dealRound(state: GameState, ruleset: SecretRuleset, now: number): void {
  const rng = makeRng(`${state.seed}:deal:${state.round + 1}`);
  const deck = shuffle(standardDeck(), rng);

  const handSize = ruleset.base.handSize;
  for (const seat of state.seats) {
    seat.hand = [];
    seat.finished = false;
    seat.place = null;
    seat.penaltyCount = 0;
  }
  for (let i = 0; i < handSize; i++) {
    for (const seat of state.seats) {
      const card = deck.pop();
      if (card) seat.hand.push(card);
    }
  }

  // Flip the first non-effect-heavy card as the starting discard. We simply take
  // the top of the remaining deck; the starting card is public.
  const first = deck.pop();
  if (!first) throw new Error("deck exhausted during deal");

  state.drawPile = deck;
  state.discardPile = [first];
  state.direction = ruleset.base.startingDirection;
  state.activeSuit = first.suit;
  state.pendingDraw = 0;
  state.phase = "playing";
  state.round += 1;
  state.startedAt = now;
  state.currentSeat = 0;
  state.pendingObligations = [];
  state.pendingWin = null;
  state.winnerId = null;
  state.finishedCount = 0;
  state.reshuffleCount = 0;
  state.turnLimitSeconds = ruleset.base.turnLimitSeconds;
  state.turnDeadline =
    ruleset.base.turnLimitSeconds > 0 ? now + ruleset.base.turnLimitSeconds * 1000 : null;
}

/** Reshuffle the discard pile (minus the top card) back into the draw pile. */
export function replenishDrawPile(state: GameState): void {
  if (state.discardPile.length <= 1) return;
  const top = state.discardPile[state.discardPile.length - 1] as Card;
  const rest = state.discardPile.slice(0, -1);
  state.reshuffleCount += 1;
  const rng = makeRng(`${state.seed}:reshuffle:${state.reshuffleCount}`);
  state.drawPile.push(...shuffle(rest, rng));
  state.discardPile = [top];
}

/** Draw `n` cards to a seat, reshuffling if the draw pile runs dry. */
export function drawTo(state: GameState, seatIndex: number, n: number): Card[] {
  const seat = state.seats[seatIndex];
  if (!seat) return [];
  const drawn: Card[] = [];
  for (let i = 0; i < n; i++) {
    if (state.drawPile.length === 0) replenishDrawPile(state);
    const card = state.drawPile.pop();
    if (!card) break;
    seat.hand.push(card);
    drawn.push(card);
  }
  return drawn;
}

export function seatOfPlayer(state: GameState, playerId: string): number {
  return state.seats.findIndex((s) => s.playerId === playerId);
}

export function topCard(state: GameState): Card | null {
  return state.discardPile[state.discardPile.length - 1] ?? null;
}
