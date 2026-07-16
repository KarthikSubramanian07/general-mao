/**
 * The Worker environment. Bindings (Table, DB, CONFIG, GENMAO_ENV) come from the
 * wrangler-generated `Cloudflare.Env`; the optional Anthropic settings are
 * secrets/vars that may be absent (in which case the deterministic stub runs).
 */
export interface Env extends Cloudflare.Env {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_BASE_URL?: string;
  GENMAO_GEN_MODEL?: string;
  GENMAO_JUDGE_MODEL?: string;
}
