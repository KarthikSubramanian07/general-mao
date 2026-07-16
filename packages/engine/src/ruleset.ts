/**
 * The structured secret ruleset. This is the crown jewel and the thing that must
 * never reach a client. It is data, not prose, so it can be adjudicated
 * deterministically and validated for internal consistency before a match.
 *
 * Every rule carries a `describe` field of plain-English rule text. That text is
 * shown ONLY in practice mode. In every other mode it is never serialized toward
 * a client. The anti-leak test hunts specifically for these strings in outbound
 * payloads.
 */

import { PENALTY_CATEGORIES } from "@mao/protocol";
import { z } from "zod";

const rankSchema = z.enum(["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"]);
const suitSchema = z.enum(["clubs", "diamonds", "hearts", "spades"]);
const colorSchema = z.enum(["black", "red"]);
const categorySchema = z.enum(PENALTY_CATEGORIES);

/** A predicate over a single card. All present constraints must hold (AND). */
export const cardSelectorSchema = z
  .object({
    ranks: z.array(rankSchema).min(1).optional(),
    suits: z.array(suitSchema).min(1).optional(),
    colors: z.array(colorSchema).min(1).optional(),
    /** true = only face cards, false = only non-face cards, omitted = either. */
    face: z.boolean().optional(),
    /** Matches every card. Overrides other fields. */
    any: z.boolean().optional(),
  })
  .strict();
export type CardSelector = z.infer<typeof cardSelectorSchema>;

const penaltyBand = z.number().int().min(1).max(5);

const speechReqSchema = z
  .object({
    phrase: z.string().min(1).max(120),
    match: z.enum(["exact", "contains", "normalized"]),
  })
  .strict();
export type SpeechReq = z.infer<typeof speechReqSchema>;

const effectSpecSchema = z.union([
  z.literal("skip"),
  z.literal("reverse"),
  z.literal("extra-turn"),
  z.literal("wild"),
  z.object({ draw: z.number().int().min(1).max(4) }).strict(),
]);
export type EffectSpec = z.infer<typeof effectSpecSchema>;

const triggerSchema = z.discriminatedUnion("on", [
  z.object({ on: z.literal("play"), selector: cardSelectorSchema }).strict(),
  z.object({ on: z.literal("hand-count"), count: z.number().int().min(0).max(5) }).strict(),
  z.object({ on: z.literal("suit-change") }).strict(),
  z.object({ on: z.literal("draw") }).strict(),
  z.object({ on: z.literal("reverse") }).strict(),
]);
export type TriggerSpec = z.infer<typeof triggerSchema>;

const effectRuleSchema = z
  .object({
    kind: z.literal("effect"),
    id: z.string(),
    describe: z.string(),
    on: cardSelectorSchema,
    effect: effectSpecSchema,
    /** Optional announcement demanded when the effect fires. */
    announce: speechReqSchema.optional(),
  })
  .strict();

const restrictionRuleSchema = z
  .object({
    kind: z.literal("restriction"),
    id: z.string(),
    describe: z.string(),
    /** The card whose play is being restricted. */
    card: cardSelectorSchema,
    /** Optional context: the current top card must match this for the rule to bite. */
    prev: cardSelectorSchema.optional(),
    category: categorySchema.default("unlawful-play"),
    penaltyCards: penaltyBand.default(1),
  })
  .strict();

const obligationRuleSchema = z
  .object({
    kind: z.literal("obligation"),
    id: z.string(),
    describe: z.string(),
    trigger: triggerSchema,
    /** Who owes the speech: the player who acted, the next player, or everyone. */
    actor: z.enum(["player", "next", "all"]).default("player"),
    speech: speechReqSchema,
    category: categorySchema.default("failure-to-announce"),
    penaltyCards: penaltyBand.default(1),
  })
  .strict();

const prohibitionRuleSchema = z
  .object({
    kind: z.literal("prohibition"),
    id: z.string(),
    describe: z.string(),
    forbid: z.union([
      z
        .object({ words: z.array(z.string().min(1)).min(1), match: z.enum(["word", "substring"]) })
        .strict(),
      z.object({ pattern: z.string().min(1).max(200) }).strict(),
      z.object({ semantic: z.string().min(1).max(240) }).strict(),
    ]),
    category: categorySchema.default("prohibited-speech"),
    penaltyCards: penaltyBand.default(1),
  })
  .strict();

export const ruleSchema = z.discriminatedUnion("kind", [
  effectRuleSchema,
  restrictionRuleSchema,
  obligationRuleSchema,
  prohibitionRuleSchema,
]);
export type Rule = z.infer<typeof ruleSchema>;
export type EffectRule = z.infer<typeof effectRuleSchema>;
export type RestrictionRule = z.infer<typeof restrictionRuleSchema>;
export type ObligationRule = z.infer<typeof obligationRuleSchema>;
export type ProhibitionRule = z.infer<typeof prohibitionRuleSchema>;

export const winRitualSchema = z
  .object({
    describe: z.string(),
    speech: speechReqSchema,
    penaltyCards: penaltyBand.default(2),
  })
  .strict();
export type WinRitual = z.infer<typeof winRitualSchema>;

export const baseRulesSchema = z
  .object({
    handSize: z.number().int().min(3).max(10).default(7),
    startingDirection: z.union([z.literal(1), z.literal(-1)]).default(1),
    /** Draw repeatedly until a playable card appears, vs. draw exactly one. */
    drawUntilPlayable: z.boolean().default(false),
    /** Draw penalties from effect cards accumulate onto the next player. */
    stackDraws: z.boolean().default(false),
    /** Seconds a player may take before "delay of game" bites. 0 disables. */
    turnLimitSeconds: z.number().int().min(0).max(120).default(0),
  })
  .strict();
export type BaseRules = z.infer<typeof baseRulesSchema>;

export const secretRulesetSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    theme: z.string(),
    difficulty: z.enum(["gentle", "standard", "brutal"]),
    /** Seed used to generate/shuffle, kept for reproducibility. */
    seed: z.string(),
    base: baseRulesSchema,
    rules: z.array(ruleSchema).max(24),
    winRitual: winRitualSchema,
    /** Author-facing summary; NEVER sent to a client outside practice mode. */
    summary: z.string().default(""),
  })
  .strict();
export type SecretRuleset = z.infer<typeof secretRulesetSchema>;

/**
 * Every human-readable string inside a ruleset. Used by the anti-leak test as
 * the set of tokens that must never appear in any client-bound payload.
 */
export function rulesetSecretStrings(ruleset: SecretRuleset): string[] {
  const out: string[] = [
    ruleset.summary,
    ruleset.winRitual.describe,
    ruleset.winRitual.speech.phrase,
  ];
  for (const rule of ruleset.rules) {
    out.push(rule.describe);
    if (rule.kind === "obligation") out.push(rule.speech.phrase);
    if (rule.kind === "effect" && rule.announce) out.push(rule.announce.phrase);
    if (rule.kind === "prohibition") {
      if ("words" in rule.forbid) out.push(...rule.forbid.words);
      if ("pattern" in rule.forbid) out.push(rule.forbid.pattern);
      if ("semantic" in rule.forbid) out.push(rule.forbid.semantic);
    }
  }
  return out.filter((s) => s.trim().length > 0);
}
