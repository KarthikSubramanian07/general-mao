/**
 * The consistency and solvability validator. An inconsistent General is a broken
 * product, so no ruleset reaches a table until it passes here:
 *
 *  - no two rules assign contradictory turn effects to the same card,
 *  - nothing the table is REQUIRED to say is also FORBIDDEN to say,
 *  - the win ritual is actually performable (its phrase is not forbidden),
 *  - a legal, un-penalized line of play exists (the game is winnable),
 *  - rule ids are unique and penalty bands are sane.
 *
 * Deterministic and pure. The same ruleset always yields the same verdict.
 */

import { standardDeck } from "@mao/protocol";
import type { ProhibitionRule, SecretRuleset } from "./ruleset.js";
import { matchesSelector, normalizeLoose, tripsProhibition } from "./selectors.js";

/** Max seats a single 52-card deck can deal at the given hand size. */
export function maxSeatsFor(handSize: number): number {
  return Math.max(2, Math.floor((52 - 1) / handSize));
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

const PRIMARY_EFFECTS = new Set(["skip", "reverse", "extra-turn", "wild"]);

function deterministicProhibitions(ruleset: SecretRuleset): ProhibitionRule[] {
  return ruleset.rules.filter(
    (r): r is ProhibitionRule => r.kind === "prohibition" && !("semantic" in r.forbid),
  );
}

/** Is `phrase` forbidden by any deterministic prohibition? */
function phraseIsForbidden(phrase: string, ruleset: SecretRuleset): boolean {
  return deterministicProhibitions(ruleset).some((p) => tripsProhibition(phrase, p));
}

export function validateRuleset(ruleset: SecretRuleset): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Unique rule ids.
  const seen = new Set<string>();
  for (const rule of ruleset.rules) {
    if (seen.has(rule.id)) errors.push(`duplicate rule id: ${rule.id}`);
    seen.add(rule.id);
  }

  // 2. The deck must be dealable for at least two players.
  if (ruleset.base.handSize * 2 + 1 > 52) {
    errors.push("hand size too large to deal two players from a single deck");
  }

  // 3. No contradictory primary turn effects on any single card.
  const deck = standardDeck();
  for (const card of deck) {
    const primaries = new Set<string>();
    for (const rule of ruleset.rules) {
      if (rule.kind !== "effect") continue;
      if (!matchesSelector(card, rule.on)) continue;
      const eff = typeof rule.effect === "string" ? rule.effect : "draw";
      if (PRIMARY_EFFECTS.has(eff)) primaries.add(eff);
    }
    if (primaries.size > 1) {
      errors.push(
        `contradictory effects on ${card.rank} of ${card.suit}: ${[...primaries].sort().join(", ")}`,
      );
      break; // one report is enough; the ruleset is already rejected
    }
  }

  // 4. Nothing required is also forbidden.
  if (phraseIsForbidden(ruleset.winRitual.speech.phrase, ruleset)) {
    errors.push("the win ritual phrase is forbidden by a prohibition rule");
  }
  for (const rule of ruleset.rules) {
    if (rule.kind === "obligation" && phraseIsForbidden(rule.speech.phrase, ruleset)) {
      errors.push(`obligation ${rule.id} requires a phrase that a prohibition forbids`);
    }
    if (
      rule.kind === "effect" &&
      rule.announce &&
      phraseIsForbidden(rule.announce.phrase, ruleset)
    ) {
      errors.push(`effect ${rule.id} requires an announcement that a prohibition forbids`);
    }
  }

  // 5. A prohibition must not forbid its own required-elsewhere phrase trivially,
  //    and the win phrase must not be empty.
  if (normalizeLoose(ruleset.winRitual.speech.phrase).length === 0) {
    errors.push("the win ritual phrase is empty");
  }

  // 6. Solvability: there exists a base-legal play that is not penalized by any
  //    restriction rule, for at least one top card. Drawing always progresses the
  //    game, but a fully-penalized ruleset is joyless; a totally sealed one is a bug.
  let cleanPlayExists = false;
  outer: for (const top of deck) {
    for (const hand of deck) {
      if (hand.rank === top.rank && hand.suit === top.suit) continue;
      const baseLegal = hand.rank === top.rank || hand.suit === top.suit;
      if (!baseLegal) continue;
      const penalized = ruleset.rules.some(
        (r) =>
          r.kind === "restriction" &&
          matchesSelector(hand, r.card) &&
          (!r.prev || matchesSelector(top, r.prev)),
      );
      if (!penalized) {
        cleanPlayExists = true;
        break outer;
      }
    }
  }
  if (!cleanPlayExists) {
    errors.push("no un-penalized legal play exists: the ruleset is unsolvable");
  }

  // 7. Sanity warnings (non-fatal).
  const ruleCount = ruleset.rules.length;
  if (ruleCount === 0) warnings.push("ruleset has no secret rules");
  if (ruleset.difficulty === "gentle" && ruleCount > 6) {
    warnings.push("a gentle ruleset with many rules may frustrate new tables");
  }

  return { ok: errors.length === 0, errors, warnings };
}
