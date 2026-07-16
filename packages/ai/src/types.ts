import type { SecretRuleset } from "@mao/engine";
import type { Difficulty, RulesetMode } from "@mao/protocol";

export interface RulesetRequest {
  mode: RulesetMode;
  difficulty: Difficulty;
  themeId: string | null;
  /** Freeform host-authored rules, only for "byo" mode. */
  byoRules: string | null;
  /** Deterministic seed, so the stub and tests are reproducible. */
  seed: string;
  playerCount: number;
}

/**
 * The single paid dependency in the whole product lives behind this interface.
 * With the stub, the entire game runs at $0 and every test is hermetic.
 */
export interface AIProvider {
  readonly name: string;
  /** True when this provider makes real, billable network calls. */
  readonly billable: boolean;
  /** Produce a coherent, validated secret ruleset for a match. */
  generateRuleset(req: RulesetRequest): Promise<SecretRuleset>;
  /**
   * Judge whether a chat line violates a natural-language prohibition that the
   * deterministic engine could not decide. Returns true if forbidden.
   */
  judgeSpeech(text: string, forbiddenDescription: string): Promise<boolean>;
}
