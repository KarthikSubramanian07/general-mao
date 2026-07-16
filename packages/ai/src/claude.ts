/**
 * The real provider. Activates only when an ANTHROPIC_API_KEY is present. It
 * generates fresh rulesets and judges ambiguous speech, but every generated
 * ruleset must pass the engine's validator before it is trusted; anything that
 * fails, errors, or times out falls back to the deterministic stub. The game is
 * therefore never broken by a bad generation or an outage.
 */

import Anthropic from "@anthropic-ai/sdk";
import { type SecretRuleset, secretRulesetSchema, validateRuleset } from "@mao/engine";
import { StubAIProvider } from "./stub.js";
import type { AIProvider, RulesetRequest } from "./types.js";

export interface ClaudeOptions {
  apiKey: string;
  /** Model for ruleset generation. Defaults to the strongest current model. */
  generationModel?: string;
  /** Model for speech judgment. Defaults to the generation model. */
  judgeModel?: string;
  baseURL?: string;
}

const RULESET_CONTRACT = `You are the General: the silent, lawful-evil rulemaster of a game of Mao.
Design a SECRET ruleset as a single JSON object. Output ONLY the JSON, no prose.

Shape:
{
  "name": string, "theme": string,
  "difficulty": "gentle" | "standard" | "brutal",
  "base": { "handSize": 7, "startingDirection": 1 | -1, "drawUntilPlayable": bool, "stackDraws": bool, "turnLimitSeconds": 0 },
  "rules": Rule[],
  "winRitual": { "describe": string, "speech": { "phrase": string, "match": "exact"|"contains"|"normalized" }, "penaltyCards": 1-5 },
  "summary": string
}

A Rule is one of:
- effect: { "kind":"effect", "id":string, "describe":string, "on": Selector, "effect": "skip"|"reverse"|"extra-turn"|"wild"|{"draw":1-4} }
- restriction: { "kind":"restriction", "id":string, "describe":string, "card": Selector, "prev"?: Selector, "category": Category, "penaltyCards": 1-5 }
- obligation: { "kind":"obligation", "id":string, "describe":string, "trigger": Trigger, "actor":"player"|"next", "speech": {"phrase":string,"match":"exact"|"contains"|"normalized"}, "category": Category, "penaltyCards": 1-5 }
- prohibition: { "kind":"prohibition", "id":string, "describe":string, "forbid": {"words":string[],"match":"word"|"substring"} | {"pattern":string} | {"semantic":string}, "category": Category, "penaltyCards": 1-5 }

Selector: { "ranks"?: ("A".."10","J","Q","K")[], "suits"?: ("clubs"|"diamonds"|"hearts"|"spades")[], "colors"?: ("black"|"red")[], "face"?: bool, "any"?: bool }
Trigger: {"on":"play","selector":Selector} | {"on":"hand-count","count":0-5} | {"on":"suit-change"} | {"on":"reverse"} | {"on":"draw"}
Category: "unlawful-play"|"failure-to-announce"|"improper-address"|"prohibited-speech"|"improper-conduct"|"delay-of-game"|"out-of-turn"|"improper-ceremony"

Hard requirements (a ruleset that breaks these is rejected):
- No two effect rules assign different primary effects (skip/reverse/extra-turn/wild) to the same card.
- Never require (in an obligation, announcement, or the win ritual) a phrase that a prohibition forbids.
- There must exist at least one legal, un-penalized play, so the game is winnable.
- Every rule needs a unique id and an honest "describe" line written for a human.
- Include exactly one "wild" effect and a win ritual.
Difficulty guide: gentle = 3-4 rules, standard = 5-7, brutal = 8-11 interlocking rules.
Make it thematic, cruel, and coherent.`;

export class ClaudeAIProvider implements AIProvider {
  readonly name = "claude";
  readonly billable = true;
  private client: Anthropic;
  private stub = new StubAIProvider();
  private generationModel: string;
  private judgeModel: string;

  constructor(opts: ClaudeOptions) {
    this.client = new Anthropic({
      apiKey: opts.apiKey,
      ...(opts.baseURL ? { baseURL: opts.baseURL } : {}),
    });
    this.generationModel = opts.generationModel ?? "claude-opus-4-8";
    this.judgeModel = opts.judgeModel ?? this.generationModel;
  }

  async generateRuleset(req: RulesetRequest): Promise<SecretRuleset> {
    if (req.mode === "themed" && req.themeId) {
      // Themed rulesets are curated and cached; never spend a call on them.
      return this.stub.generateRuleset(req);
    }
    try {
      const ruleset = await this.tryGenerate(req);
      if (ruleset) return ruleset;
    } catch {
      // fall through to the stub
    }
    return this.stub.generateRuleset(req);
  }

  private async tryGenerate(req: RulesetRequest): Promise<SecretRuleset | null> {
    const instruction =
      req.mode === "byo" && req.byoRules
        ? `Convert these host-authored rules, written in plain English, into the JSON ruleset. Preserve their intent; fill in a coherent win ritual and a "wild" effect if the author omitted one.\n\nHOST RULES:\n${req.byoRules}`
        : `Design a fresh ${req.difficulty} ruleset${req.themeId ? ` themed around "${req.themeId}"` : ""} for ${req.playerCount} players.`;

    let feedback = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const message = await this.client.messages.create({
        model: this.generationModel,
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        output_config: { effort: "high" },
        system: RULESET_CONTRACT,
        messages: [{ role: "user", content: `${instruction}${feedback}` }],
      });
      const text = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      const json = extractJson(text);
      if (!json) {
        feedback = "\n\nYour previous reply was not valid JSON. Output only the JSON object.";
        continue;
      }
      const parsed = secretRulesetSchema.safeParse({
        ...json,
        id: `gen-${req.seed}`,
        seed: req.seed,
        difficulty: req.difficulty,
      });
      if (!parsed.success) {
        feedback = `\n\nYour previous ruleset failed schema validation: ${parsed.error.issues
          .slice(0, 4)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}. Fix and resend.`;
        continue;
      }
      const check = validateRuleset(parsed.data);
      if (!check.ok) {
        feedback = `\n\nYour previous ruleset was inconsistent: ${check.errors.join("; ")}. Fix and resend.`;
        continue;
      }
      return parsed.data;
    }
    return null;
  }

  async judgeSpeech(text: string, forbiddenDescription: string): Promise<boolean> {
    try {
      const message = await this.client.messages.create({
        model: this.judgeModel,
        max_tokens: 5,
        thinking: { type: "disabled" },
        output_config: { effort: "low" },
        system:
          'You judge whether a chat line breaks a hidden rule. Reply with exactly "yes" or "no". No other words.',
        messages: [
          {
            role: "user",
            content: `Hidden rule (forbidden): ${forbiddenDescription}\nChat line: "${text}"\nDoes the line break the rule?`,
          },
        ],
      });
      const answer = message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim()
        .toLowerCase();
      return answer.startsWith("y");
    } catch {
      return this.stub.judgeSpeech(text, forbiddenDescription);
    }
  }
}

/** Pull the first balanced JSON object out of a model reply. */
function extractJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1)) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}
