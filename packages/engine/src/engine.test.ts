import type { Card, Suit } from "@mao/protocol";
import { cardId } from "@mao/protocol";
import { describe, expect, it } from "vitest";
import { drawCard, playCard, postChat } from "./engine.js";
import { replayMatch, sampleRuleset, setupGame, simulateMatch } from "./fixtures.js";
import type { GameState } from "./state.js";

const C = (rank: Card["rank"], suit: Suit): Card => ({ rank, suit });
const ctx = (n = 1000) => ({ now: n });

/** Put the board into a precise, known configuration for a targeted assertion. */
function board(
  names: string[],
  hands: Card[][],
  top: Card,
  activeSuit: Suit,
  current = 0,
): GameState {
  const rs = sampleRuleset();
  const state = setupGame("board-seed", names, rs);
  state.seats.forEach((s, i) => {
    s.hand = hands[i] ? [...(hands[i] as Card[])] : [];
  });
  state.discardPile = [top];
  state.activeSuit = activeSuit;
  state.currentSeat = current;
  state.direction = 1;
  state.pendingObligations = [];
  state.pendingWin = null;
  state.actionCounter = 0;
  return state;
}

const rs = sampleRuleset();

describe("dealing", () => {
  it("deals the configured hand size and a starting card", () => {
    const state = setupGame("deal", ["A", "B", "C"], rs);
    expect(state.seats.every((s) => s.hand.length === 7)).toBe(true);
    expect(state.discardPile).toHaveLength(1);
    // 52 - (3 * 7) - 1 start = 30 remaining
    expect(state.drawPile).toHaveLength(30);
    expect(state.phase).toBe("playing");
    expect(state.currentSeat).toBe(0);
  });
});

describe("legality", () => {
  it("sheds a base-legal card and advances the turn", () => {
    const state = board(
      ["A", "B"],
      [[C("9", "hearts")], [C("2", "diamonds")]],
      C("9", "clubs"),
      "clubs",
    );
    playCard(state, rs, "p0", cardId(C("9", "hearts")), undefined, ctx());
    expect(state.seats[0]?.hand).toHaveLength(0);
    expect(state.discardPile.at(-1)).toEqual(C("9", "hearts"));
    expect(state.activeSuit).toBe("hearts");
    expect(state.currentSeat).toBe(1);
  });

  it("bounces an illegal card with a penalty and keeps the turn", () => {
    const state = board(
      ["A", "B"],
      [[C("9", "hearts")], [C("2", "diamonds")]],
      C("2", "clubs"),
      "clubs",
    );
    const em = playCard(state, rs, "p0", cardId(C("9", "hearts")), undefined, ctx());
    expect(em.penalties.map((p) => p.category)).toContain("unlawful-play");
    // still holds the bounced card plus one penalty card, still their turn
    expect(state.seats[0]?.hand.some((c) => c.rank === "9" && c.suit === "hearts")).toBe(true);
    expect(state.currentSeat).toBe(0);
    expect(state.discardPile.at(-1)).toEqual(C("2", "clubs"));
  });

  it("charges for acting out of turn without shedding", () => {
    const state = board(
      ["A", "B"],
      [[C("9", "hearts")], [C("2", "clubs")]],
      C("2", "diamonds"),
      "diamonds",
      0,
    );
    const em = playCard(state, rs, "p1", cardId(C("2", "clubs")), undefined, ctx());
    expect(em.penalties.map((p) => p.category)).toContain("out-of-turn");
    expect(state.seats[1]?.hand.some((c) => c.rank === "2" && c.suit === "clubs")).toBe(true);
  });
});

describe("secret restriction rules", () => {
  it("sheds the card but penalizes a red card onto a black face card", () => {
    const state = board(["A", "B"], [[C("K", "hearts")], []], C("K", "spades"), "spades");
    const em = playCard(state, rs, "p0", cardId(C("K", "hearts")), undefined, ctx());
    // the play is legal-looking (rank match) so it sheds, but a hidden law bites
    expect(state.discardPile.at(-1)).toEqual(C("K", "hearts"));
    expect(em.penalties.map((p) => p.category)).toContain("unlawful-play");
  });
});

describe("card effects", () => {
  it("eights reverse direction", () => {
    const state = board(["A", "B", "C"], [[C("8", "clubs")], [], []], C("2", "clubs"), "clubs");
    playCard(state, rs, "p0", cardId(C("8", "clubs")), undefined, ctx());
    expect(state.direction).toBe(-1);
    expect(state.currentSeat).toBe(2); // -1 from seat 0 in a 3-ring
  });

  it("aces skip the next player", () => {
    const state = board(["A", "B", "C"], [[C("A", "clubs")], [], []], C("2", "clubs"), "clubs");
    playCard(state, rs, "p0", cardId(C("A", "clubs")), undefined, ctx());
    expect(state.currentSeat).toBe(2);
  });

  it("sevens force the next player to draw two and lose their turn", () => {
    const state = board(
      ["A", "B"],
      [[C("7", "clubs")], [C("5", "diamonds"), C("6", "diamonds")]],
      C("2", "clubs"),
      "clubs",
    );
    playCard(state, rs, "p0", cardId(C("7", "clubs")), undefined, ctx());
    expect(state.seats[1]?.hand).toHaveLength(4); // 2 + 2 drawn
    expect(state.currentSeat).toBe(0); // victim skipped, back to p0 in 2-player
  });

  it("jacks are wild and change the active suit", () => {
    const state = board(["A", "B"], [[C("J", "diamonds")], []], C("2", "clubs"), "clubs");
    playCard(state, rs, "p0", cardId(C("J", "diamonds")), "hearts", ctx());
    expect(state.discardPile.at(-1)).toEqual(C("J", "diamonds"));
    expect(state.activeSuit).toBe("hearts");
  });
});

describe("obligations", () => {
  it("penalizes failure to announce Mao at one card", () => {
    const state = board(
      ["A", "B"],
      [[C("9", "hearts"), C("5", "hearts")], [C("3", "clubs")]],
      C("9", "clubs"),
      "clubs",
    );
    playCard(state, rs, "p0", cardId(C("9", "hearts")), undefined, ctx(1000)); // p0 -> 1 card
    // p1 acts; the window on p0's announcement closes
    const em = drawCard(state, rs, "p1", ctx(2000));
    expect(em.penalties.map((p) => p.category)).toContain("failure-to-announce");
  });

  it("clears the obligation when Mao is announced in time", () => {
    const state = board(
      ["A", "B"],
      [[C("9", "hearts"), C("5", "hearts")], [C("3", "clubs")]],
      C("9", "clubs"),
      "clubs",
    );
    playCard(state, rs, "p0", cardId(C("9", "hearts")), undefined, ctx(1000));
    postChat(
      state,
      rs,
      { id: "m", playerId: "p0", playerName: "A", text: "Mao!", at: 1500, system: false },
      ctx(1500),
    );
    const em = drawCard(state, rs, "p1", ctx(2000));
    expect(em.penalties.map((p) => p.category)).not.toContain("failure-to-announce");
  });

  it("penalizes prohibited speech", () => {
    const state = board(["A", "B"], [[C("9", "hearts")], []], C("9", "clubs"), "clubs");
    const em = postChat(
      state,
      rs,
      {
        id: "c",
        playerId: "p0",
        playerName: "A",
        text: "thanks everyone",
        at: 1200,
        system: false,
      },
      ctx(1200),
    );
    expect(em.penalties.map((p) => p.category)).toContain("prohibited-speech");
  });
});

describe("win ritual", () => {
  it("wins on the last card with the correct declaration", () => {
    const state = board(
      ["A", "B"],
      [[C("5", "hearts")], [C("3", "clubs")]],
      C("5", "clubs"),
      "clubs",
    );
    playCard(state, rs, "p0", cardId(C("5", "hearts")), undefined, ctx(1000));
    expect(state.pendingWin?.seat).toBe(0);
    const em = postChat(
      state,
      rs,
      {
        id: "w",
        playerId: "p0",
        playerName: "A",
        text: "The game of Mao has ended.",
        at: 1500,
        system: false,
      },
      ctx(1500),
    );
    expect(state.winnerId).toBe("p0");
    expect(state.phase).toBe("finished");
    expect(em.system).toContain("Correct.");
  });

  it("penalizes an unperformed ritual and drags the player back in", () => {
    const state = board(
      ["A", "B"],
      [[C("5", "hearts")], [C("3", "clubs")]],
      C("5", "clubs"),
      "clubs",
    );
    playCard(state, rs, "p0", cardId(C("5", "hearts")), undefined, ctx(1000));
    const em = drawCard(state, rs, "p1", ctx(2000)); // window closes, ritual not done
    expect(em.penalties.map((p) => p.category)).toContain("improper-ceremony");
    expect(state.seats[0]?.finished).toBe(false);
    expect(state.seats[0]?.hand.length).toBeGreaterThan(0);
    expect(state.winnerId).toBeNull();
  });
});

describe("determinism", () => {
  it("produces bit-for-bit identical matches from the same seed", () => {
    const a = simulateMatch("match-alpha", ["A", "B", "C"], sampleRuleset());
    const b = simulateMatch("match-alpha", ["A", "B", "C"], sampleRuleset());
    expect(a.finished).toBe(true);
    expect(b.actions).toEqual(a.actions);
    expect(b.emissions).toEqual(a.emissions);
    expect(b.state).toEqual(a.state);
  });

  it("replays a recorded log to the identical final state", () => {
    const original = simulateMatch("match-beta", ["A", "B", "C", "D"], sampleRuleset());
    const replay = replayMatch(
      "match-beta",
      ["A", "B", "C", "D"],
      sampleRuleset(),
      original.actions,
    );
    expect(replay.state).toEqual(original.state);
    expect(replay.emissions).toEqual(original.emissions);
  });

  it("always reaches a decided match with a winner", () => {
    for (const seed of ["s1", "s2", "s3", "s4", "s5"]) {
      const result = simulateMatch(seed, ["A", "B", "C"], sampleRuleset());
      expect(result.finished).toBe(true);
      expect(result.state.winnerId).not.toBeNull();
    }
  });
});
