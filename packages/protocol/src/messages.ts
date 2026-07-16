/**
 * The wire protocol. Every client -> server message is validated with Zod at the
 * Durable Object boundary. All client input is treated as hostile.
 */

import { z } from "zod";
import type { Card } from "./cards.js";
import type {
  ChatMessage,
  Difficulty,
  LedgerEntry,
  PublicGameState,
  RulesetMode,
  Verdict,
} from "./state.js";

const cardIdSchema = z.string().regex(/^[A23456789TJQK][CDHS]$/, "invalid card id");

const nameSchema = z.string().trim().min(1, "name required").max(24, "name too long");

const chatSchema = z.string().trim().min(1).max(280);

const suitSchema = z.enum(["clubs", "diamonds", "hearts", "spades"]);
const modeSchema = z.enum(["classic", "themed", "byo", "practice"]);
const difficultySchema = z.enum(["gentle", "standard", "brutal"]);

export const tableConfigInputSchema = z.object({
  mode: modeSchema.optional(),
  difficulty: difficultySchema.optional(),
  themeId: z.string().max(64).nullable().optional(),
  byoRules: z.string().max(4000).nullable().optional(),
  maxPlayers: z.number().int().min(2).max(8).optional(),
});
export type TableConfigInput = z.infer<typeof tableConfigInputSchema>;

export const clientMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("set-name"), name: nameSchema }),
  z.object({ t: z.literal("sit") }),
  z.object({ t: z.literal("stand") }),
  z.object({ t: z.literal("config"), config: tableConfigInputSchema }),
  z.object({ t: z.literal("start") }),
  z.object({
    t: z.literal("play"),
    card: cardIdSchema,
    declaredSuit: suitSchema.optional(),
  }),
  z.object({ t: z.literal("draw") }),
  z.object({ t: z.literal("chat"), text: chatSchema }),
  z.object({ t: z.literal("point-of-order") }),
  z.object({ t: z.literal("end-point-of-order") }),
  z.object({ t: z.literal("rematch") }),
  z.object({ t: z.literal("ping") }),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;

export function parseClientMessage(
  raw: unknown,
): { ok: true; msg: ClientMessage } | { ok: false; error: string } {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, error: "malformed json" };
    }
  }
  const result = clientMessageSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? "invalid message" };
  }
  return { ok: true, msg: result.data };
}

/** What the connected player sees of their own position. */
export interface SelfView {
  id: string;
  name: string;
  seat: number | null;
  spectator: boolean;
  hand: Card[];
  isYourTurn: boolean;
  isHost: boolean;
}

export type ServerMessage =
  | { t: "welcome"; youId: string; code: string }
  | { t: "snapshot"; state: PublicGameState; you: SelfView; chat: ChatMessage[] }
  | { t: "penalty"; entry: LedgerEntry }
  | { t: "verdict"; verdict: Verdict }
  | { t: "chat"; message: ChatMessage }
  | { t: "system"; text: string }
  | { t: "toast"; level: "info" | "warn" | "error"; text: string }
  | { t: "error"; code: string; message: string };

export type { Difficulty, RulesetMode };
