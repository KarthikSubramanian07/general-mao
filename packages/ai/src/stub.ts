/**
 * The deterministic stub. This is the DEFAULT provider. With no API key, the game
 * is fully playable and every test is hermetic, because ruleset "generation" is a
 * seeded pick from the curated library and speech judgment is a deterministic
 * heuristic. No network, no cost, no flakiness.
 */

import { makeRng, type SecretRuleset, secretRulesetSchema, validateRuleset } from "@mao/engine";
import { CURATED, CURATED_BY_ID, type CuratedTemplate } from "./curated.js";
import type { AIProvider, RulesetRequest } from "./types.js";

function templatesForDifficulty(difficulty: string): CuratedTemplate[] {
  const byDiff = CURATED.filter((t) => t.difficulty === difficulty);
  return byDiff.length > 0 ? byDiff : CURATED;
}

export function buildRuleset(template: CuratedTemplate, seed: string): SecretRuleset {
  const ruleset = secretRulesetSchema.parse({
    id: template.id,
    name: template.name,
    theme: template.theme,
    difficulty: template.difficulty,
    seed,
    base: template.base,
    rules: template.rules,
    winRitual: template.winRitual,
    summary: template.summary,
  });
  const check = validateRuleset(ruleset);
  if (!check.ok) {
    throw new Error(`curated ruleset ${template.id} is invalid: ${check.errors.join("; ")}`);
  }
  return ruleset;
}

function pickTemplate(req: RulesetRequest): CuratedTemplate {
  if (req.mode === "practice") {
    return CURATED_BY_ID["boot-camp"] ?? (CURATED[0] as CuratedTemplate);
  }
  if ((req.mode === "themed" || req.mode === "byo") && req.themeId && CURATED_BY_ID[req.themeId]) {
    return CURATED_BY_ID[req.themeId] as CuratedTemplate;
  }
  const pool = templatesForDifficulty(req.difficulty);
  const rng = makeRng(`${req.seed}:pick`);
  return rng.pick(pool);
}

/** Heuristic natural-language judgments for the semantic prohibitions we ship. */
const SEMANTIC_MATCHERS: { keys: string[]; test: (t: string) => boolean }[] = [
  {
    keys: ["question", "asking", "requesting information"],
    test: (t) =>
      /[?]/.test(t) ||
      /\b(who|what|when|where|why|how|which|is|are|do|does|did|can|could|would|should)\b/i.test(
        t.trim().split(/\s+/)[0] ?? "",
      ),
  },
  {
    keys: ["gratitude", "thank", "grateful"],
    test: (t) => /\b(thanks?|thank you|grateful|cheers|appreciate)\b/i.test(t),
  },
  {
    keys: ["apolog", "sorry"],
    test: (t) => /\b(sorry|apologi[sz]e|my apologies|pardon)\b/i.test(t),
  },
  {
    keys: ["greet", "hello", "salutation"],
    test: (t) => /\b(hi|hello|hey|greetings|good (morning|evening|day))\b/i.test(t),
  },
];

export class StubAIProvider implements AIProvider {
  readonly name = "stub";
  readonly billable = false;

  async generateRuleset(req: RulesetRequest): Promise<SecretRuleset> {
    const template = pickTemplate(req);
    return buildRuleset(template, req.seed);
  }

  async judgeSpeech(text: string, forbiddenDescription: string): Promise<boolean> {
    const desc = forbiddenDescription.toLowerCase();
    for (const matcher of SEMANTIC_MATCHERS) {
      if (matcher.keys.some((k) => desc.includes(k))) {
        return matcher.test(text);
      }
    }
    // Unknown semantic rule: refuse to penalize rather than guess. The General is
    // strict, not arbitrary.
    return false;
  }
}
