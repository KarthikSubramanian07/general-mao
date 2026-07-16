/**
 * Pure predicate helpers: does a card match a selector, does a chat line satisfy
 * a required phrase, does a chat line trip a prohibition. All deterministic.
 */

import type { Card } from "@mao/protocol";
import { cardColor, isFace } from "@mao/protocol";
import type { CardSelector, ProhibitionRule, SpeechReq } from "./ruleset.js";

export function matchesSelector(card: Card, selector: CardSelector): boolean {
  if (selector.any) return true;
  if (selector.ranks && !selector.ranks.includes(card.rank)) return false;
  if (selector.suits && !selector.suits.includes(card.suit)) return false;
  if (selector.colors && !selector.colors.includes(cardColor(card))) return false;
  if (selector.face !== undefined && isFace(card) !== selector.face) return false;
  return true;
}

/** lowercase, strip everything but letters/digits/spaces, collapse whitespace. */
export function normalizeLoose(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function words(text: string): string[] {
  const n = normalizeLoose(text);
  return n.length === 0 ? [] : n.split(" ");
}

/** Is `needle` an in-order subsequence of `haystack` word arrays? */
function isSubsequence(needle: string[], haystack: string[]): boolean {
  if (needle.length === 0) return true;
  let i = 0;
  for (const w of haystack) {
    if (w === needle[i]) {
      i++;
      if (i === needle.length) return true;
    }
  }
  return false;
}

export function matchesSpeech(text: string, req: SpeechReq): boolean {
  const t = normalizeLoose(text);
  const p = normalizeLoose(req.phrase);
  switch (req.match) {
    case "exact":
      return t === p;
    case "contains":
      return t.includes(p);
    case "normalized":
      return isSubsequence(words(req.phrase), words(text));
  }
}

/**
 * Deterministic prohibition check. Returns true if the text is forbidden. A
 * `semantic` prohibition cannot be decided here; call `isSemanticProhibition`
 * and route those to the AI adjudicator instead.
 */
export function tripsProhibition(text: string, rule: ProhibitionRule): boolean {
  const forbid = rule.forbid;
  if ("semantic" in forbid) return false; // decided by the AI layer, not here
  if ("pattern" in forbid) {
    try {
      return new RegExp(forbid.pattern, "i").test(text);
    } catch {
      return false;
    }
  }
  const ws = words(text);
  if (forbid.match === "word") {
    const set = new Set(ws);
    return forbid.words.some((w) => set.has(normalizeLoose(w)));
  }
  const loose = normalizeLoose(text);
  return forbid.words.some((w) => loose.includes(normalizeLoose(w)));
}

export function isSemanticProhibition(rule: ProhibitionRule): boolean {
  return "semantic" in rule.forbid;
}
