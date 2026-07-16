/**
 * The one-way valve. Turns the authoritative GameState into the client-bound
 * PublicGameState and per-player SelfView. By construction it copies only fields
 * that are already public (card identities on the discard, counts, the ledger)
 * and can physically not carry the secret ruleset, because PublicGameState has
 * no field to hold it.
 *
 * `reveal` is honored ONLY in practice mode, where the rules are the point of
 * being shown. Every other caller passes null.
 */

import type { PublicGameState, PublicPlayer, SelfView } from "@mao/protocol";
import type { GameState, Seat } from "./state.js";
import { topCard } from "./state.js";

function toPublicPlayer(seat: Seat, index: number): PublicPlayer {
  return {
    id: seat.playerId,
    name: seat.name,
    seat: index,
    handCount: seat.hand.length,
    connected: seat.connected,
    isHost: seat.isHost,
    penaltyCount: seat.penaltyCount,
    finished: seat.finished,
    place: seat.place,
  };
}

export function toPublicState(
  state: GameState,
  now: number,
  reveal: string[] | null = null,
): PublicGameState {
  return {
    code: state.code,
    phase: state.phase,
    round: state.round,
    config: state.config,
    direction: state.direction,
    currentSeat: state.currentSeat,
    activeSuit: state.activeSuit,
    topCard: topCard(state),
    drawPileCount: state.drawPile.length,
    pendingDraw: state.pendingDraw,
    players: state.seats.map(toPublicPlayer),
    ledger: state.ledger,
    verdicts: state.verdicts,
    winnerId: state.winnerId,
    startedAt: state.startedAt,
    now,
    turnDeadline: state.turnDeadline,
    revealedRules: reveal,
  };
}

export function toSelfView(state: GameState, playerId: string): SelfView {
  const seatIndex = state.seats.findIndex((s) => s.playerId === playerId);
  const seat = state.seats[seatIndex];
  if (!seat) {
    return {
      id: playerId,
      name: "",
      seat: null,
      spectator: true,
      hand: [],
      isYourTurn: false,
      isHost: false,
    };
  }
  return {
    id: playerId,
    name: seat.name,
    seat: seatIndex,
    spectator: false,
    hand: seat.hand.slice(),
    isYourTurn: state.currentSeat === seatIndex && state.phase === "playing",
    isHost: seat.isHost,
  };
}
