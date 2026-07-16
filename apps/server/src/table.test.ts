import { SELF } from "cloudflare:test";
import { CURATED } from "@mao/ai";
import { ALL_REASONS } from "@mao/engine";
import { cardId, type PublicGameState, type ServerMessage } from "@mao/protocol";
import { describe, expect, it } from "vitest";

const BASE = "https://mao.test";

/** Every full-sentence secret string the stub could possibly choose. */
const SECRET_STRINGS = CURATED.flatMap((t) => [
  ...t.rules.map((r) => (r as { describe: string }).describe),
  (t.winRitual as { describe: string }).describe,
  t.summary,
]).filter((s) => s.trim().length > 0);

interface Client {
  ws: WebSocket;
  messages: ServerMessage[];
  raw: string[];
  latestSnapshot(): Extract<ServerMessage, { t: "snapshot" }> | undefined;
  send(msg: unknown): void;
  close(): void;
}

async function connect(code: string, id: string, name: string, token = ""): Promise<Client> {
  const q = new URLSearchParams({ id, name });
  if (token) q.set("token", token);
  const res = await SELF.fetch(`${BASE}/parties/table/${code}?${q}`, {
    headers: { Upgrade: "websocket" },
  });
  const ws = res.webSocket;
  if (!ws) throw new Error("no websocket in upgrade response");
  ws.accept();
  const messages: ServerMessage[] = [];
  const raw: string[] = [];
  ws.addEventListener("message", (e: MessageEvent) => {
    const text = typeof e.data === "string" ? e.data : "";
    raw.push(text);
    try {
      messages.push(JSON.parse(text) as ServerMessage);
    } catch {
      /* ignore */
    }
  });
  return {
    ws,
    messages,
    raw,
    latestSnapshot() {
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m?.t === "snapshot") return m;
      }
      return undefined;
    },
    send(msg) {
      ws.send(JSON.stringify(msg));
    },
    close() {
      ws.close();
    },
  };
}

function welcomeToken(client: Client): string {
  for (const m of client.messages) {
    if (m.t === "welcome" && m.token) return m.token;
  }
  return "";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor<T>(fn: () => T | undefined, timeoutMs = 4000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const v = fn();
    if (v !== undefined) return v;
    await sleep(25);
  }
  throw new Error("waitFor timed out");
}

function baseLegal(state: PublicGameState, card: { rank: string; suit: string }): boolean {
  if (!state.topCard) return true;
  return card.rank === state.topCard.rank || card.suit === state.activeSuit;
}

describe("matchmaking API", () => {
  it("reports health", async () => {
    const res = await SELF.fetch(`${BASE}/api/health`);
    expect(res.status).toBe(200);
    expect((await res.json<{ ok: boolean }>()).ok).toBe(true);
  });

  it("lists themes without leaking any rule text", async () => {
    const res = await SELF.fetch(`${BASE}/api/themes`);
    const body = await res.text();
    expect(res.status).toBe(200);
    for (const secret of SECRET_STRINGS) {
      expect(body.includes(secret)).toBe(false);
    }
  });

  it("creates a table and returns a six-character code", async () => {
    const res = await SELF.fetch(`${BASE}/api/tables`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ config: { mode: "classic", difficulty: "standard" } }),
    });
    expect(res.status).toBe(200);
    const { code } = await res.json<{ code: string }>();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    const info = await SELF.fetch(`${BASE}/api/tables/${code}/info`);
    expect((await info.json<{ phase: string }>()).phase).toBe("lobby");
  });
});

describe("anti-leak over live WebSocket traffic", () => {
  it("never ships rule text in any snapshot during play", async () => {
    const create = await SELF.fetch(`${BASE}/api/tables`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ config: { mode: "classic", difficulty: "standard" } }),
    });
    const { code } = await create.json<{ code: string }>();

    const a = await connect(code, "player-a", "Ada");
    const b = await connect(code, "player-b", "Bo");

    await waitFor(() => a.latestSnapshot());
    await waitFor(() => b.latestSnapshot());

    a.send({ t: "start" });

    // Wait until a hand is dealt.
    await waitFor(() => {
      const s = a.latestSnapshot();
      return s && s.state.phase === "playing" ? s : undefined;
    });

    // Blind bots: play a base-legal card or draw. This exercises snapshots,
    // penalties, and system lines through the real sanitizer over the wire.
    for (let step = 0; step < 40; step++) {
      for (const client of [a, b]) {
        const snap = client.latestSnapshot();
        if (snap?.state.phase !== "playing") continue;
        if (!snap.you.isYourTurn) continue;
        const playable = snap.you.hand.find((c) => baseLegal(snap.state, c));
        if (playable) client.send({ t: "play", card: cardId(playable) });
        else client.send({ t: "draw" });
      }
      await sleep(30);
    }

    // The whole capture, across both clients.
    const everything = [...a.raw, ...b.raw].join("\n");

    // No full-sentence rule text ever appears (pre-reveal). If a match happened
    // to finish, the intended post-match reveal is allowed, so only assert on
    // the non-finished traffic.
    const preFinishPayloads = [...a.messages, ...b.messages].filter(
      (m) => !(m.t === "snapshot" && (m.state.phase === "finished" || m.state.revealedRules)),
    );
    const preFinishBlob = preFinishPayloads.map((m) => JSON.stringify(m)).join("\n");
    for (const secret of SECRET_STRINGS) {
      expect(preFinishBlob.includes(secret)).toBe(false);
    }

    // Every ledger reason ever seen is from the closed vocabulary.
    const reasons = new Set<string>();
    for (const m of [...a.messages, ...b.messages]) {
      if (m.t === "snapshot") for (const e of m.state.ledger) reasons.add(e.reason);
      if (m.t === "penalty") reasons.add(m.entry.reason);
    }
    for (const reason of reasons) expect(ALL_REASONS.includes(reason)).toBe(true);

    // Sanity: the match actually progressed.
    expect(everything.includes('"phase":"playing"')).toBe(true);

    a.close();
    b.close();
  });
});

describe("seat claim tokens", () => {
  it("rejects reconnect with the same playerId but no seat token", async () => {
    const create = await SELF.fetch(`${BASE}/api/tables`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ config: { mode: "classic", difficulty: "standard" } }),
    });
    const { code } = await create.json<{ code: string }>();

    const owner = await connect(code, "owner-id", "Owner");
    const snap = await waitFor(() => owner.latestSnapshot());
    expect(snap.you.spectator).toBe(false);
    expect(snap.you.seat).toBe(0);
    const token = welcomeToken(owner);
    expect(token.length).toBeGreaterThan(10);

    owner.close();
    await sleep(50);

    // Attacker knows the playerId but not the seat secret.
    const thief = await connect(code, "owner-id", "Thief");
    const thiefSnap = await waitFor(() => thief.latestSnapshot());
    expect(thiefSnap.you.spectator).toBe(true);
    expect(thiefSnap.you.seat).toBeNull();
    expect(thiefSnap.you.hand).toEqual([]);
    thief.close();

    // Legitimate reconnect with token reclaims the seat.
    const back = await connect(code, "owner-id", "Owner", token);
    const backSnap = await waitFor(() => back.latestSnapshot());
    expect(backSnap.you.spectator).toBe(false);
    expect(backSnap.you.seat).toBe(0);
    back.close();
  });
});
