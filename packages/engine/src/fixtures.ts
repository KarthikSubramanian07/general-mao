/**
 * Test fixtures: a hand-authored sample ruleset and a deterministic match
 * simulator. Not part of the public API; imported only by tests. The simulator
 * is an oracle bot (it can see hands) used to drive full matches for the
 * determinism and anti-leak tests.
 */

import type { Suit, TableConfig } from "@mao/protocol";
import { cardId } from "@mao/protocol";
import { drawCard, type Emissions, playCard, postChat } from "./engine.js";
import { type SecretRuleset, secretRulesetSchema } from "./ruleset.js";
import { matchesSelector } from "./selectors.js";
import { createEmptyState, dealRound, type GameState } from "./state.js";

export function parseRuleset(raw: unknown): SecretRuleset {
  return secretRulesetSchema.parse(raw);
}

/** "The Standing Orders", a coherent, valid sample ruleset. */
export function sampleRuleset(seed = "standing-orders"): SecretRuleset {
  return parseRuleset({
    id: "standing-orders",
    name: "The Standing Orders",
    theme: "Garrison",
    difficulty: "standard",
    seed,
    base: {
      handSize: 7,
      startingDirection: 1,
      drawUntilPlayable: false,
      stackDraws: false,
      turnLimitSeconds: 0,
    },
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
      "Eights reverse, aces skip, sevens deal two, jacks are wild; name spades, say Mao, never thank.",
  });
}

export function setupGame(seed: string, names: string[], ruleset: SecretRuleset): GameState {
  const config: TableConfig = {
    mode: "classic",
    difficulty: ruleset.difficulty,
    themeId: null,
    revealRules: false,
    maxPlayers: names.length,
  };
  const state = createEmptyState("TEST01", config, seed);
  names.forEach((name, i) => {
    state.seats.push({
      playerId: `p${i}`,
      name,
      hand: [],
      connected: true,
      isHost: i === 0,
      penaltyCount: 0,
      finished: false,
      place: null,
      secret: `test-secret-${i}`,
    });
  });
  dealRound(state, ruleset, 0);
  return state;
}

export type SimAction =
  | { kind: "play"; playerId: string; card: string; suit?: Suit }
  | { kind: "draw"; playerId: string }
  | { kind: "chat"; playerId: string; text: string };

export interface SimResult {
  state: GameState;
  actions: SimAction[];
  emissions: Emissions[];
  finished: boolean;
}

let simClock = 0;

function firstLegal(state: GameState, ruleset: SecretRuleset, seatIndex: number): string | null {
  const seat = state.seats[seatIndex];
  if (!seat) return null;
  const top = state.discardPile[state.discardPile.length - 1] ?? null;
  for (const c of seat.hand) {
    const wild = ruleset.rules.some(
      (r) => r.kind === "effect" && r.effect === "wild" && matchesSelector(c, r.on),
    );
    const legal = !top || wild || c.rank === top.rank || c.suit === state.activeSuit;
    if (legal) return cardId(c);
  }
  return null;
}

/**
 * Run a full match with a diligent oracle bot: it satisfies every obligation and
 * the win ritual via chat. Deterministic given (seed, names, ruleset). The `now`
 * clock is derived from a counter, never from the wall clock, so replays match.
 */
export function simulateMatch(
  seed: string,
  names: string[],
  ruleset: SecretRuleset,
  maxActions = 4000,
): SimResult {
  simClock = 1_000_000;
  const state = setupGame(seed, names, ruleset);
  const actions: SimAction[] = [];
  const emissions: Emissions[] = [];

  const apply = (a: SimAction): void => {
    simClock += 1000;
    const ctx = { now: simClock };
    let em: Emissions;
    if (a.kind === "play") {
      em = playCard(state, ruleset, a.playerId, a.card, a.suit, ctx);
    } else if (a.kind === "draw") {
      em = drawCard(state, ruleset, a.playerId, ctx);
    } else {
      const seatIndex = state.seats.findIndex((s) => s.playerId === a.playerId);
      const seat = state.seats[seatIndex];
      em = postChat(
        state,
        ruleset,
        {
          id: `c${actions.length}`,
          playerId: a.playerId,
          playerName: seat?.name ?? "?",
          text: a.text,
          at: simClock,
          system: false,
        },
        ctx,
      );
    }
    actions.push(a);
    emissions.push(em);
  };

  const satisfyObligations = (seatIndex: number): void => {
    let guard = 0;
    while (guard++ < 8) {
      const ob = state.pendingObligations.find((o) => o.seat === seatIndex);
      if (!ob) break;
      const seat = state.seats[seatIndex];
      if (!seat) break;
      apply({ kind: "chat", playerId: seat.playerId, text: ob.speech.phrase });
    }
  };

  let steps = 0;
  while (state.phase === "playing" && steps++ < maxActions) {
    const seatIndex = state.currentSeat;
    if (seatIndex === null) break;
    const seat = state.seats[seatIndex];
    if (!seat) break;

    // Diligently discharge any obligations owed before acting (covers "next").
    satisfyObligations(seatIndex);

    const card = firstLegal(state, ruleset, seatIndex);
    if (card) {
      const parsed = seat.hand.find((c) => cardId(c) === card);
      const suit: Suit | undefined = parsed ? parsed.suit : undefined;
      apply({ kind: "play", playerId: seat.playerId, card, suit });
    } else {
      apply({ kind: "draw", playerId: seat.playerId });
    }

    // Discharge obligations created by that action, then the win ritual.
    satisfyObligations(seatIndex);
    if (state.pendingWin && state.pendingWin.seat === seatIndex) {
      apply({ kind: "chat", playerId: seat.playerId, text: ruleset.winRitual.speech.phrase });
    }
  }

  return { state, actions, emissions, finished: state.phase === "finished" };
}

/** Replay a recorded action log against a fresh game with the same seed. */
export function replayMatch(
  seed: string,
  names: string[],
  ruleset: SecretRuleset,
  actions: SimAction[],
): { state: GameState; emissions: Emissions[] } {
  let clock = 1_000_000;
  const state = setupGame(seed, names, ruleset);
  const emissions: Emissions[] = [];
  for (const a of actions) {
    clock += 1000;
    const ctx = { now: clock };
    if (a.kind === "play") {
      emissions.push(playCard(state, ruleset, a.playerId, a.card, a.suit, ctx));
    } else if (a.kind === "draw") {
      emissions.push(drawCard(state, ruleset, a.playerId, ctx));
    } else {
      const seat = state.seats.find((s) => s.playerId === a.playerId);
      emissions.push(
        postChat(
          state,
          ruleset,
          {
            id: "r",
            playerId: a.playerId,
            playerName: seat?.name ?? "?",
            text: a.text,
            at: clock,
            system: false,
          },
          ctx,
        ),
      );
    }
  }
  return { state, emissions };
}
