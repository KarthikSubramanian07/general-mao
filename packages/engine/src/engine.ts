/**
 * The adjudicator. Pure with respect to (state, ruleset, action, ctx): the same
 * inputs always mutate an identical state into an identical state and return
 * identical emissions. All randomness is seeded through state.seed. This is the
 * property the determinism tests pin down.
 *
 * The engine speaks only in categories and closed-set reason strings. It never
 * emits rule text. Secrecy is preserved structurally, not by convention.
 */

import type { Card, ChatMessage, LedgerEntry, PenaltyCategory, Suit, Verdict } from "@mao/protocol";
import { cardColor, cardId } from "@mao/protocol";
import { GENERAL_LINES, penaltyReason } from "./penalties.js";
import type {
  EffectRule,
  ObligationRule,
  RestrictionRule,
  SecretRuleset,
  SpeechReq,
} from "./ruleset.js";
import { matchesSelector, matchesSpeech, tripsProhibition } from "./selectors.js";
import type { GameState, PendingObligation } from "./state.js";
import { drawTo, seatOfPlayer, topCard } from "./state.js";

export interface AdjudicationContext {
  now: number;
  /** For semantic prohibition rules: ruleId -> "is this text forbidden?". */
  aiVerdicts?: Record<string, boolean>;
}

export interface Emissions {
  penalties: LedgerEntry[];
  verdicts: Verdict[];
  system: string[];
  /** A soft, private rejection to the actor (bad input, wrong turn), no penalty. */
  reject?: string;
}

function emptyEmissions(): Emissions {
  return { penalties: [], verdicts: [], system: [] };
}

// ---------------------------------------------------------------------------
// Turn geometry
// ---------------------------------------------------------------------------

function liveSeatCount(state: GameState): number {
  return state.seats.reduce((n, s) => n + (s.finished ? 0 : 1), 0);
}

/** The live seat `steps` away from `from` in the current direction. */
function advanceFrom(state: GameState, from: number, steps: number): number | null {
  const n = state.seats.length;
  if (n === 0 || liveSeatCount(state) === 0) return null;
  let idx = from;
  let moved = 0;
  let guard = 0;
  const cap = n * (steps + 2);
  while (moved < steps && guard++ < cap) {
    idx = (idx + state.direction + n) % n;
    if (!state.seats[idx]?.finished) moved++;
  }
  return state.seats[idx] && !state.seats[idx]?.finished ? idx : null;
}

function baseLegal(card: Card, top: Card | null, activeSuit: Suit | null): boolean {
  if (!top) return true;
  return card.rank === top.rank || card.suit === activeSuit;
}

function wildRuleFor(card: Card, ruleset: SecretRuleset): EffectRule | null {
  for (const rule of ruleset.rules) {
    if (rule.kind === "effect" && rule.effect === "wild" && matchesSelector(card, rule.on)) {
      return rule;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Penalties & obligations
// ---------------------------------------------------------------------------

function addPenalty(
  state: GameState,
  seatIndex: number,
  category: PenaltyCategory,
  card: Card | null,
  penaltyCards: number,
  ctx: AdjudicationContext,
  em: Emissions,
): void {
  const seat = state.seats[seatIndex];
  if (!seat) return;
  drawTo(state, seatIndex, penaltyCards);
  seat.penaltyCount += 1;
  state.ledgerSeq += 1;
  const entry: LedgerEntry = {
    seq: state.ledgerSeq,
    at: ctx.now,
    playerId: seat.playerId,
    playerName: seat.name,
    category,
    reason: penaltyReason(category, state.ledgerSeq),
    card,
    penaltyCards,
  };
  state.ledger.push(entry);
  em.penalties.push(entry);
}

function addObligation(
  state: GameState,
  seatIndex: number,
  ruleId: string,
  speech: SpeechReq,
  category: PenaltyCategory,
  penaltyCards: number,
): void {
  if (seatIndex < 0 || seatIndex >= state.seats.length) return;
  const ob: PendingObligation = {
    ruleId,
    seat: seatIndex,
    category,
    penaltyCards,
    speech,
    createdAtAction: state.actionCounter,
  };
  state.pendingObligations.push(ob);
}

/**
 * Close the window on obligations and any pending win ritual that were created
 * before the current action. Unmet obligations are penalized here. Called at the
 * start of every play/draw so each obligation gets exactly one action's grace.
 */
function closeWindows(state: GameState, ctx: AdjudicationContext, em: Emissions): void {
  const stillOpen: PendingObligation[] = [];
  for (const ob of state.pendingObligations) {
    if (ob.createdAtAction >= state.actionCounter) {
      stillOpen.push(ob);
      continue;
    }
    addPenalty(state, ob.seat, ob.category, null, ob.penaltyCards, ctx, em);
  }
  state.pendingObligations = stillOpen;

  if (state.pendingWin && state.pendingWin.createdAtAction < state.actionCounter) {
    const pw = state.pendingWin;
    state.pendingWin = null;
    // Ritual not performed in time: penalized and dragged back into the game.
    addPenalty(state, pw.seat, "improper-ceremony", null, pw.penaltyCards, ctx, em);
  }
}

function finishSeat(state: GameState, seatIndex: number, em: Emissions): void {
  const seat = state.seats[seatIndex];
  if (!seat || seat.finished) return;
  seat.finished = true;
  state.finishedCount += 1;
  seat.place = state.finishedCount;
  if (state.finishedCount === 1) {
    state.winnerId = seat.playerId;
    em.system.push(GENERAL_LINES.correct);
  }
  checkMatchEnd(state, em);
}

function checkMatchEnd(state: GameState, em: Emissions): void {
  if (state.phase === "finished") return;
  if (liveSeatCount(state) <= 1) {
    // Assign the trailing player last place and end the match.
    const last = state.seats.findIndex((s) => !s.finished);
    if (last >= 0) {
      const seat = state.seats[last];
      if (seat) {
        seat.finished = true;
        state.finishedCount += 1;
        seat.place = state.finishedCount;
      }
    }
    state.phase = "finished";
    state.currentSeat = null;
    state.turnDeadline = null;
    em.system.push(GENERAL_LINES.matchEnds);
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function playCard(
  state: GameState,
  ruleset: SecretRuleset,
  playerId: string,
  playedCardId: string,
  declaredSuit: Suit | undefined,
  ctx: AdjudicationContext,
): Emissions {
  const em = emptyEmissions();
  if (state.phase !== "playing") {
    em.reject = "The table is not in play.";
    return em;
  }
  const seatIndex = seatOfPlayer(state, playerId);
  const seat = state.seats[seatIndex];
  if (!seat) {
    em.reject = "You hold no seat.";
    return em;
  }
  const handIdx = seat.hand.findIndex((c) => cardId(c) === playedCardId);
  if (handIdx < 0) {
    em.reject = "You do not hold that card.";
    return em;
  }
  const card = seat.hand[handIdx] as Card;

  state.actionCounter += 1;
  closeWindows(state, ctx, em);

  // Out of turn: the General notices, and charges for it. The play is void.
  if (state.currentSeat !== seatIndex) {
    addPenalty(state, seatIndex, "out-of-turn", card, 1, ctx, em);
    return em;
  }

  const prevTop = topCard(state);
  const wild = wildRuleFor(card, ruleset);
  const legal = wild !== null || baseLegal(card, prevTop, state.activeSuit);

  if (!legal) {
    // An obviously illegal card bounces: penalty, no shed, still your turn.
    addPenalty(state, seatIndex, "unlawful-play", card, 1, ctx, em);
    return em;
  }

  // The card is shed.
  seat.hand.splice(handIdx, 1);
  state.discardPile.push(card);
  state.activeSuit = card.suit;

  // Secret restriction rules: the move looked legal but broke a hidden law.
  for (const rule of ruleset.rules) {
    if (rule.kind !== "restriction") continue;
    if (matchesRestriction(rule, card, prevTop)) {
      addPenalty(state, seatIndex, rule.category, card, rule.penaltyCards, ctx, em);
    }
  }

  // Effects.
  let reversed = false;
  let extraTurn = false;
  let skipNext = false;
  let drawEffect = 0;
  let becameWild = false;
  for (const rule of ruleset.rules) {
    if (rule.kind !== "effect") continue;
    if (!matchesSelector(card, rule.on)) continue;
    switch (rule.effect) {
      case "reverse":
        state.direction = (state.direction * -1) as 1 | -1;
        reversed = true;
        break;
      case "skip":
        skipNext = true;
        break;
      case "extra-turn":
        extraTurn = true;
        break;
      case "wild":
        becameWild = true;
        state.activeSuit = declaredSuit ?? card.suit;
        break;
      default:
        drawEffect += rule.effect.draw;
    }
    if (rule.announce) {
      addObligation(state, seatIndex, rule.id, rule.announce, "failure-to-announce", 1);
    }
  }

  // Obligation rules keyed to this play.
  const nextSeatForNext = advanceFrom(state, seatIndex, skipNext ? 2 : 1);
  for (const rule of ruleset.rules) {
    if (rule.kind !== "obligation") continue;
    if (!obligationTriggered(rule, { card, handCount: seat.hand.length, becameWild, reversed }))
      continue;
    const target =
      rule.actor === "next"
        ? (nextSeatForNext ?? seatIndex)
        : rule.actor === "all"
          ? -1
          : seatIndex;
    if (target === -1) {
      for (let s = 0; s < state.seats.length; s++) {
        if (!state.seats[s]?.finished)
          addObligation(state, s, rule.id, rule.speech, rule.category, rule.penaltyCards);
      }
    } else {
      addObligation(state, target, rule.id, rule.speech, rule.category, rule.penaltyCards);
    }
  }

  // Win detection: last card played opens the ritual window.
  if (seat.hand.length === 0) {
    state.pendingWin = {
      seat: seatIndex,
      speech: ruleset.winRitual.speech,
      penaltyCards: ruleset.winRitual.penaltyCards,
      createdAtAction: state.actionCounter,
    };
  }

  // Forced draws from a draw effect.
  if (drawEffect > 0) {
    if (ruleset.base.stackDraws) {
      state.pendingDraw += drawEffect;
    } else {
      const victim = advanceFrom(state, seatIndex, 1);
      if (victim !== null) {
        drawTo(state, victim, drawEffect);
        skipNext = true; // the victim loses their turn
      }
    }
  }

  advanceTurn(state, seatIndex, { skipNext, extraTurn }, ctx);
  return em;
}

function advanceTurn(
  state: GameState,
  fromSeat: number,
  opts: { skipNext: boolean; extraTurn: boolean },
  ctx: AdjudicationContext,
): void {
  if (state.phase === "finished") return;
  if (opts.extraTurn) {
    state.currentSeat = state.seats[fromSeat]?.finished
      ? advanceFrom(state, fromSeat, 1)
      : fromSeat;
  } else {
    state.currentSeat = advanceFrom(state, fromSeat, opts.skipNext ? 2 : 1);
  }
  state.turnDeadline =
    state.currentSeat !== null && stateTurnLimit(state) > 0
      ? ctx.now + stateTurnLimit(state) * 1000
      : null;
}

function stateTurnLimit(state: GameState): number {
  return state.turnLimitSeconds;
}

export function drawCard(
  state: GameState,
  ruleset: SecretRuleset,
  playerId: string,
  ctx: AdjudicationContext,
): Emissions {
  const em = emptyEmissions();
  if (state.phase !== "playing") {
    em.reject = "The table is not in play.";
    return em;
  }
  const seatIndex = seatOfPlayer(state, playerId);
  const seat = state.seats[seatIndex];
  if (!seat) {
    em.reject = "You hold no seat.";
    return em;
  }

  state.actionCounter += 1;
  closeWindows(state, ctx, em);

  if (state.currentSeat !== seatIndex) {
    addPenalty(state, seatIndex, "out-of-turn", null, 1, ctx, em);
    return em;
  }

  if (state.pendingDraw > 0) {
    drawTo(state, seatIndex, state.pendingDraw);
    state.pendingDraw = 0;
  } else if (ruleset.base.drawUntilPlayable) {
    let guard = 0;
    do {
      drawTo(state, seatIndex, 1);
      guard++;
    } while (!hasPlayable(seat.hand, topCard(state), state.activeSuit, ruleset) && guard < 60);
  } else {
    drawTo(state, seatIndex, 1);
  }

  // Draw-triggered obligations.
  for (const rule of ruleset.rules) {
    if (rule.kind === "obligation" && rule.trigger.on === "draw") {
      addObligation(state, seatIndex, rule.id, rule.speech, rule.category, rule.penaltyCards);
    }
  }

  advanceTurn(state, seatIndex, { skipNext: false, extraTurn: false }, ctx);
  return em;
}

export function postChat(
  state: GameState,
  ruleset: SecretRuleset,
  message: ChatMessage,
  ctx: AdjudicationContext,
): Emissions {
  const em = emptyEmissions();
  const seatIndex = seatOfPlayer(state, message.playerId);

  // Chat may satisfy an open obligation owed by this player.
  if (seatIndex >= 0) {
    state.pendingObligations = state.pendingObligations.filter((ob) => {
      if (ob.seat !== seatIndex) return true;
      return !matchesSpeech(message.text, ob.speech);
    });

    // Chat may complete the win ritual.
    if (
      state.pendingWin &&
      state.pendingWin.seat === seatIndex &&
      matchesSpeech(message.text, state.pendingWin.speech)
    ) {
      const s = state.pendingWin.seat;
      state.pendingWin = null;
      finishSeat(state, s, em);
    }
  }

  // Prohibited speech (only meaningful while a match is live).
  if (state.phase === "playing" && seatIndex >= 0 && !state.seats[seatIndex]?.finished) {
    for (const rule of ruleset.rules) {
      if (rule.kind !== "prohibition") continue;
      const semantic = "semantic" in rule.forbid;
      const forbidden = semantic
        ? ctx.aiVerdicts?.[rule.id] === true
        : tripsProhibition(message.text, rule);
      if (forbidden) {
        addPenalty(state, seatIndex, rule.category, null, rule.penaltyCards, ctx, em);
      }
    }
  }

  return em;
}

// ---------------------------------------------------------------------------
// Predicates
// ---------------------------------------------------------------------------

function matchesRestriction(rule: RestrictionRule, card: Card, prevTop: Card | null): boolean {
  if (!matchesSelector(card, rule.card)) return false;
  if (rule.prev) {
    if (!prevTop) return false;
    if (!matchesSelector(prevTop, rule.prev)) return false;
  }
  return true;
}

function obligationTriggered(
  rule: ObligationRule,
  ctx: { card: Card; handCount: number; becameWild: boolean; reversed: boolean },
): boolean {
  const t = rule.trigger;
  switch (t.on) {
    case "play":
      return matchesSelector(ctx.card, t.selector);
    case "hand-count":
      return ctx.handCount === t.count;
    case "suit-change":
      return ctx.becameWild;
    case "reverse":
      return ctx.reversed;
    case "draw":
      return false;
  }
}

function hasPlayable(
  hand: Card[],
  top: Card | null,
  activeSuit: Suit | null,
  ruleset: SecretRuleset,
): boolean {
  return hand.some((c) => wildRuleFor(c, ruleset) !== null || baseLegal(c, top, activeSuit));
}

export { cardColor };
