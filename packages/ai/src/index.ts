export * from "./claude.js";
export { CURATED, type ThemeCard, themeCatalog } from "./curated.js";
export * from "./stub.js";
export * from "./types.js";

import { ClaudeAIProvider } from "./claude.js";
import { StubAIProvider } from "./stub.js";
import type { AIProvider } from "./types.js";

export interface AIProviderEnv {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  GENMAO_GEN_MODEL?: string;
  GENMAO_JUDGE_MODEL?: string;
}

/**
 * The single seam where money can start. With no key, the stub runs the whole
 * game at $0. With a key, Claude generates variety and judges ambiguous speech,
 * always with the stub as a safety net.
 */
export function createAIProvider(env: AIProviderEnv): AIProvider {
  if (env.ANTHROPIC_API_KEY && env.ANTHROPIC_API_KEY.trim().length > 0) {
    return new ClaudeAIProvider({
      apiKey: env.ANTHROPIC_API_KEY,
      ...(env.ANTHROPIC_BASE_URL ? { baseURL: env.ANTHROPIC_BASE_URL } : {}),
      ...(env.GENMAO_GEN_MODEL ? { generationModel: env.GENMAO_GEN_MODEL } : {}),
      ...(env.GENMAO_JUDGE_MODEL ? { judgeModel: env.GENMAO_JUDGE_MODEL } : {}),
    });
  }
  return new StubAIProvider();
}
