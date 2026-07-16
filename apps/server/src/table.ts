/**
 * TableServer: one Durable Object per table. It is the single authoritative game
 * server. It owns the GameState AND the secret ruleset, runs every action through
 * the deterministic engine, and fans sanitized snapshots out to connections.
 *
 * The secret ruleset is stored only here, in DO storage. Every outbound payload
 * is produced by the engine's sanitizer, which has no field capable of carrying
 * rule text. The lone, intentional exceptions are practice mode and the
 * post-match reveal.
 */

import { type AIProvider, createAIProvider, StubAIProvider } from "@mao/ai";
import {
  createEmptyState,
  dealRound,
  drawCard,
  type Emissions,
  type GameState,
  GENERAL_LINES,
  playCard,
  postChat,
  type SecretRuleset,
  toPublicState,
  toSelfView,
  validateRuleset,
} from "@mao/engine";
import {
  type ChatMessage,
  type ClientMessage,
  parseClientMessage,
  type ServerMessage,
  type Suit,
  type TableConfig,
} from "@mao/protocol";
import { type Connection, type ConnectionContext, Server } from "partyserver";
import type { Env } from "./env.js";

interface ConnState {
  playerId: string;
  name: string;
  spectator: boolean;
  lastChatAt: number;
}

interface TableMeta {
  config: TableConfig;
  inited: boolean;
  byoRules: string | null;
}

const DEFAULT_CONFIG: TableConfig = {
  mode: "classic",
  difficulty: "standard",
  themeId: null,
  revealRules: false,
  maxPlayers: 6,
};

/** Minimum gap between chat messages that may trigger AI speech judgment. */
const CHAT_COOLDOWN_MS = 800;

export class TableServer extends Server<Env> {
  static override options = { hibernate: true };

  private state!: GameState;
  private ruleset: SecretRuleset | null = null;
  private meta!: TableMeta;
  private ai!: AIProvider;
  private starting = false;

  override async onStart(): Promise<void> {
    this.ai = createAIProvider(this.env);
    const meta = await this.ctx.storage.get<TableMeta>("meta");
    this.meta = meta ?? { config: { ...DEFAULT_CONFIG }, inited: false, byoRules: null };
    const state = await this.ctx.storage.get<GameState>("state");
    this.state = state ?? createEmptyState(this.name, this.meta.config, this.name);
    this.ruleset = (await this.ctx.storage.get<SecretRuleset>("ruleset")) ?? null;
    // Migrate seats created before seat secrets existed.
    for (const seat of this.state.seats) {
      if (!seat.secret) seat.secret = crypto.randomUUID();
    }
  }

  // -- persistence ---------------------------------------------------------

  private async persist(): Promise<void> {
    await this.ctx.storage.put("state", this.state);
    await this.ctx.storage.put("meta", this.meta);
    if (this.ruleset) await this.ctx.storage.put("ruleset", this.ruleset);
  }

  // -- HTTP (matchmaking init + share preview) -----------------------------

  override async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname.endsWith("/init")) {
      const body = (await request.json().catch(() => ({}))) as {
        config?: Partial<TableConfig>;
        byoRules?: string;
      };
      if (!this.meta.inited) {
        this.meta.config = sanitizeConfig(body.config, this.meta.config);
        this.meta.byoRules = body.byoRules ?? null;
        this.meta.inited = true;
        this.state.config = this.meta.config;
        await this.persist();
      }
      return Response.json({ ok: true, code: this.name });
    }
    if (request.method === "GET" && url.pathname.endsWith("/info")) {
      // Public preview for link unfurls and spectator landing. No secrets.
      return Response.json({
        code: this.name,
        phase: this.state.phase,
        players: this.state.seats.length,
        mode: this.meta.config.mode,
        difficulty: this.meta.config.difficulty,
        penalties: this.state.ledger.length,
        inited: this.meta.inited,
      });
    }
    return new Response("Not found", { status: 404 });
  }

  // -- connections ---------------------------------------------------------

  override async onConnect(conn: Connection, ctx: ConnectionContext): Promise<void> {
    const url = new URL(ctx.request.url);
    let playerId = url.searchParams.get("id") ?? crypto.randomUUID();
    const offeredToken = url.searchParams.get("token") ?? "";
    const rawName = (url.searchParams.get("name") ?? "").slice(0, 24).trim();
    const wantsSpectate = url.searchParams.get("spectate") === "1";

    const existing = this.state.seats.findIndex((s) => s.playerId === playerId);
    if (existing >= 0) {
      const seat = this.state.seats[existing];
      // Require the seat secret so a guessed playerId cannot reclaim a hand.
      if (seat?.secret && offeredToken === seat.secret) {
        seat.connected = true;
        if (rawName) seat.name = rawName;
        conn.setState({
          playerId,
          name: seat.name,
          spectator: false,
          lastChatAt: 0,
        } satisfies ConnState);
      } else {
        // Claim rejected: sit as a spectator under a fresh identity.
        playerId = crypto.randomUUID();
        conn.setState({
          playerId,
          name: rawName || "Spectator",
          spectator: true,
          lastChatAt: 0,
        } satisfies ConnState);
      }
    } else if (
      !wantsSpectate &&
      this.state.phase === "lobby" &&
      this.state.seats.length < this.meta.config.maxPlayers
    ) {
      const name = rawName || `Player ${this.state.seats.length + 1}`;
      const isHost = this.state.seats.length === 0;
      const secret = crypto.randomUUID();
      this.state.seats.push({
        playerId,
        name,
        hand: [],
        connected: true,
        isHost,
        penaltyCount: 0,
        finished: false,
        place: null,
        secret,
      });
      conn.setState({ playerId, name, spectator: false, lastChatAt: 0 } satisfies ConnState);
    } else {
      conn.setState({
        playerId,
        name: rawName || "Spectator",
        spectator: true,
        lastChatAt: 0,
      } satisfies ConnState);
    }

    await this.persist();
    const seated = this.state.seats.find((s) => s.playerId === playerId);
    this.send(conn, {
      t: "welcome",
      youId: playerId,
      code: this.name,
      token: seated?.secret ?? null,
    });
    this.syncOne(conn);
    this.syncAll();
  }

  override async onMessage(conn: Connection, message: string | ArrayBuffer): Promise<void> {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    const parsed = parseClientMessage(raw);
    if (!parsed.ok) {
      this.send(conn, { t: "error", code: "bad_message", message: parsed.error });
      return;
    }
    const cs = conn.state as ConnState | undefined;
    if (!cs) return;
    await this.dispatch(conn, cs, parsed.msg);
  }

  override async onClose(conn: Connection): Promise<void> {
    const cs = conn.state as ConnState | undefined;
    if (!cs) return;
    const seat = this.state.seats.find((s) => s.playerId === cs.playerId);
    if (seat) {
      // Keep the seat and the hand so the player can rejoin intact.
      const stillHere = Array.from(this.getConnections()).some(
        (c) => c !== conn && (c.state as ConnState | undefined)?.playerId === cs.playerId,
      );
      if (!stillHere) seat.connected = false;
    }
    await this.persist();
    this.syncAll();
  }

  // -- dispatch ------------------------------------------------------------

  private async dispatch(conn: Connection, cs: ConnState, msg: ClientMessage): Promise<void> {
    switch (msg.t) {
      case "ping":
        return;
      case "set-name":
        return this.handleSetName(cs, msg.name);
      case "sit":
        return this.handleSit(conn, cs);
      case "stand":
        return this.handleStand(cs);
      case "config":
        return this.handleConfig(cs, msg.config);
      case "start":
        return this.handleStart(cs);
      case "play":
        return this.handlePlay(conn, cs, msg.card, msg.declaredSuit);
      case "draw":
        return this.handleDraw(conn, cs);
      case "chat":
        return this.handleChat(cs, msg.text);
      case "point-of-order":
        return this.handlePointOfOrder(cs, true);
      case "end-point-of-order":
        return this.handlePointOfOrder(cs, false);
      case "rematch":
        return this.handleRematch(cs);
      default: {
        const _exhaustive: never = msg;
        void _exhaustive;
      }
    }
  }

  private isHost(cs: ConnState): boolean {
    const seat = this.state.seats.find((s) => s.playerId === cs.playerId);
    return !!seat?.isHost;
  }

  private async handleSetName(cs: ConnState, name: string): Promise<void> {
    cs.name = name;
    const seat = this.state.seats.find((s) => s.playerId === cs.playerId);
    if (seat) seat.name = name;
    await this.persist();
    this.syncAll();
  }

  private async handleSit(conn: Connection, cs: ConnState): Promise<void> {
    if (this.state.phase !== "lobby") return;
    if (this.state.seats.some((s) => s.playerId === cs.playerId)) return;
    if (this.state.seats.length >= this.meta.config.maxPlayers) return;
    const isHost = this.state.seats.length === 0;
    const secret = crypto.randomUUID();
    this.state.seats.push({
      playerId: cs.playerId,
      name: cs.name,
      hand: [],
      connected: true,
      isHost,
      penaltyCount: 0,
      finished: false,
      place: null,
      secret,
    });
    cs.spectator = false;
    conn.setState({ ...cs });
    this.send(conn, {
      t: "welcome",
      youId: cs.playerId,
      code: this.name,
      token: secret,
    });
    await this.persist();
    this.syncAll();
  }

  private async handleStand(cs: ConnState): Promise<void> {
    if (this.state.phase !== "lobby") return;
    const idx = this.state.seats.findIndex((s) => s.playerId === cs.playerId);
    if (idx < 0) return;
    const wasHost = this.state.seats[idx]?.isHost;
    this.state.seats.splice(idx, 1);
    if (wasHost && this.state.seats[0]) this.state.seats[0].isHost = true;
    cs.spectator = true;
    await this.persist();
    this.syncAll();
  }

  private async handleConfig(cs: ConnState, config: Partial<TableConfig>): Promise<void> {
    if (!this.isHost(cs) || this.state.phase !== "lobby") return;
    this.meta.config = sanitizeConfig(config, this.meta.config);
    this.state.config = this.meta.config;
    await this.persist();
    this.syncAll();
  }

  private async handleStart(cs: ConnState): Promise<void> {
    if (!this.isHost(cs) || this.state.phase !== "lobby" || this.starting) return;
    if (this.state.seats.length < 2) {
      this.announce({
        t: "toast",
        level: "warn",
        text: "The General requires at least two players.",
      });
      return;
    }
    this.starting = true;
    try {
      const seed = `${this.name}:${crypto.randomUUID()}`;
      this.state.seed = seed;
      const ruleset = await this.generateRuleset(seed);
      this.ruleset = ruleset;
      dealRound(this.state, ruleset, Date.now());
      await this.persist();
      this.announce({ t: "system", text: GENERAL_LINES.onlyRule });
      this.announce({ t: "system", text: GENERAL_LINES.matchBegins });
      this.syncAll();
    } finally {
      this.starting = false;
    }
  }

  private async generateRuleset(seed: string): Promise<SecretRuleset> {
    const req = {
      mode: this.meta.config.mode,
      difficulty: this.meta.config.difficulty,
      themeId: this.meta.config.themeId,
      byoRules: this.meta.byoRules,
      seed,
      playerCount: this.state.seats.length,
    };
    const ruleset = await this.ai.generateRuleset(req);
    // Defense in depth: never seat an inconsistent General.
    if (!validateRuleset(ruleset).ok) {
      return new StubAIProvider().generateRuleset(req);
    }
    return ruleset;
  }

  private async handlePlay(
    conn: Connection,
    cs: ConnState,
    card: string,
    declaredSuit: Suit | undefined,
  ): Promise<void> {
    if (!this.ruleset || cs.spectator) return;
    const em = playCard(this.state, this.ruleset, cs.playerId, card, declaredSuit, {
      now: Date.now(),
    });
    if (em.reject) this.send(conn, { t: "toast", level: "warn", text: em.reject });
    this.emit(em);
    await this.persist();
    this.syncAll();
  }

  private async handleDraw(conn: Connection, cs: ConnState): Promise<void> {
    if (!this.ruleset || cs.spectator) return;
    const em = drawCard(this.state, this.ruleset, cs.playerId, { now: Date.now() });
    if (em.reject) this.send(conn, { t: "toast", level: "warn", text: em.reject });
    this.emit(em);
    await this.persist();
    this.syncAll();
  }

  private async handleChat(cs: ConnState, text: string): Promise<void> {
    // Spectators must not speak (or trigger billable speech judgment).
    const seat = this.state.seats.find((s) => s.playerId === cs.playerId);
    if (!seat || cs.spectator) return;

    const now = Date.now();
    if (now - cs.lastChatAt < CHAT_COOLDOWN_MS) return;
    cs.lastChatAt = now;

    const message: ChatMessage = {
      id: crypto.randomUUID(),
      playerId: cs.playerId,
      playerName: seat.name,
      text,
      at: now,
      system: false,
    };
    this.state.chat.push(message);
    if (this.state.chat.length > 200) this.state.chat.shift();
    this.announce({ t: "chat", message });

    if (this.ruleset && this.state.phase === "playing") {
      const aiVerdicts = await this.judgeSemantic(text);
      const em = postChat(this.state, this.ruleset, message, { now, aiVerdicts });
      this.emit(em);
    }
    await this.persist();
    this.syncAll();
  }

  private async judgeSemantic(text: string): Promise<Record<string, boolean>> {
    const verdicts: Record<string, boolean> = {};
    if (!this.ruleset) return verdicts;
    for (const rule of this.ruleset.rules) {
      if (rule.kind === "prohibition" && "semantic" in rule.forbid) {
        verdicts[rule.id] = await this.ai.judgeSpeech(text, rule.forbid.semantic);
      }
    }
    return verdicts;
  }

  private async handlePointOfOrder(cs: ConnState, engage: boolean): Promise<void> {
    if (!this.state.seats.some((s) => s.playerId === cs.playerId)) return;
    if (engage && this.state.phase === "playing") this.state.phase = "point-of-order";
    else if (!engage && this.state.phase === "point-of-order") this.state.phase = "playing";
    else return;
    await this.persist();
    this.syncAll();
  }

  private async handleRematch(cs: ConnState): Promise<void> {
    if (!this.isHost(cs) || this.state.phase !== "finished" || this.starting) return;
    this.starting = true;
    try {
      const seed = `${this.name}:${crypto.randomUUID()}`;
      this.state.seed = seed;
      const ruleset = await this.generateRuleset(seed);
      this.ruleset = ruleset;
      dealRound(this.state, ruleset, Date.now());
      this.state.chat = [];
      await this.persist();
      this.announce({ t: "system", text: GENERAL_LINES.onlyRule });
      this.announce({ t: "system", text: GENERAL_LINES.matchBegins });
      this.syncAll();
    } finally {
      this.starting = false;
    }
  }

  // -- outbound ------------------------------------------------------------

  private reveal(): string[] | null {
    if (!this.ruleset) return null;
    if (this.meta.config.mode === "practice" || this.state.phase === "finished") {
      return [
        ...this.ruleset.rules.map((r) => r.describe),
        this.ruleset.winRitual.describe,
        this.ruleset.summary,
      ].filter((s) => s.trim().length > 0);
    }
    return null;
  }

  private emit(em: Emissions): void {
    for (const p of em.penalties) this.announce({ t: "penalty", entry: p });
    for (const v of em.verdicts) this.announce({ t: "verdict", verdict: v });
    for (const line of em.system) this.announce({ t: "system", text: line });
  }

  private syncAll(): void {
    for (const conn of Array.from(this.getConnections())) this.syncOne(conn);
  }

  private syncOne(conn: Connection): void {
    const cs = conn.state as ConnState | undefined;
    if (!cs) return;
    const now = Date.now();
    const publicState = toPublicState(this.state, now, this.reveal());
    const you = toSelfView(this.state, cs.playerId);
    const chat = this.state.chat.slice(-60);
    this.send(conn, { t: "snapshot", state: publicState, you, chat });
  }

  private send(conn: Connection, msg: ServerMessage): void {
    conn.send(JSON.stringify(msg));
  }

  private announce(msg: ServerMessage): void {
    super.broadcast(JSON.stringify(msg));
  }
}

function sanitizeConfig(
  input: Partial<TableConfig> | undefined,
  current: TableConfig,
): TableConfig {
  const next: TableConfig = { ...current };
  if (input?.mode && ["classic", "themed", "byo", "practice"].includes(input.mode))
    next.mode = input.mode;
  if (input?.difficulty && ["gentle", "standard", "brutal"].includes(input.difficulty)) {
    next.difficulty = input.difficulty;
  }
  if (input?.themeId !== undefined)
    next.themeId = input.themeId ? String(input.themeId).slice(0, 64) : null;
  if (typeof input?.maxPlayers === "number")
    next.maxPlayers = Math.max(2, Math.min(6, Math.floor(input.maxPlayers)));
  next.revealRules = next.mode === "practice";
  return next;
}
