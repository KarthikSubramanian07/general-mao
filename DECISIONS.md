# Decisions

Why this is built the way it is. Recorded so the reasoning survives.

## The two invariants everything serves

1. **Determinism.** The same game state and the same secret ruleset always produce
   the same penalty. The rules engine is pure and seeded; a property test replays an
   entire simulated match and asserts identical adjudications. A rulemaster that
   penalizes at random is not mysterious, it is broken.
2. **Secrecy.** The secret ruleset lives only inside its table's Durable Object,
   server-side. It is never serialized into a client-bound payload: not in game
   state, not in error strings, not in penalty reasons. This is enforced
   structurally, not by discipline: the public wire types (`@mao/protocol`) have no
   field capable of holding rule text, and the sanitizer (`toPublicState`) can only
   copy already-public fields. A test captures every outbound message across a full
   match, over a real WebSocket, and asserts no rule text ever appears.

The only intentional reveals are practice mode (where the rules are the point) and
the post-match reveal (where the round is over).

## Architecture

```
Browser (Cloudflare Pages, general-mao.pages.dev)
   │  static SPA: landing (SEO) + game room
   │  HTTP  →  matchmaking API
   │  WSS   →  the table's Durable Object
   ▼
Worker (Cloudflare Workers, Hono)
   ├─ /api/*            matchmaking, theme catalog
   └─ /parties/table/:code   → routed by partyserver to …
        ▼
   TableServer  (one Durable Object per table)
        ├─ authoritative GameState + the SECRET ruleset (DO storage)
        ├─ every action runs through the deterministic engine
        ├─ WebSocket hibernation (idle tables stop billing)
        └─ AIProvider (stub by default; Claude when a key is set)

   D1, finished-match archives + bring-your-own rulesets (scaffolded)
   KV, config + cached themed rulesets
```

Pure, tested core (`@mao/engine`) is separated from all I/O. The web client depends
only on `@mao/protocol` and can not import the engine, so rule content has no path
to the browser even by accident.

## Substitutions from the original spec

- **Real-time multiplayer: Supabase Realtime / Ably → Cloudflare Durable Objects.**
  One DO per table is the authoritative server and the fan-out hub. This removes the
  fixed monthly floor those services carry and keeps state and secret co-located with
  the authority. Built on `partyserver`, the Cloudflare-native successor to PartyKit,
  so we did not reinvent WebSocket coordination.
- **Game state store: Supabase Postgres → DO storage (+ D1 for archives).** The live,
  secret-bearing state belongs in the single-writer DO, not a shared database.
- **Rules engine: Python edge function → TypeScript.** One language across the stack,
  and the engine is a pure library the DO calls in-process (no extra network hop, no
  second runtime).
- **Auth: Supabase Auth → deferred, Lucia-style sessions on D1/KV when needed.** No
  account is required to play; a magic link is a later, self-hostable addition.

## Where money starts

At `$0` for everything except the LLM, and only when a key is present:

| Surface | Cost |
|---|---|
| Pages, Workers, Durable Objects, D1, KV | Cloudflare free tier |
| Ruleset generation & flagged NL judgment | The only paid path. **Off by default** (stub). |

The single paid dependency sits behind the `AIProvider` interface:

- **Stub (default, `$0`, hermetic):** a curated library of hand-authored, validated
  rulesets plus a deterministic natural-language adjudicator. With no key set, the
  whole game runs and the entire test suite passes green.
- **Claude (`ClaudeAIProvider`):** generates fresh, varied rulesets and judges
  genuinely ambiguous chat. Every generated ruleset must pass the engine's
  consistency validator before a match; anything that fails, errors, or times out
  falls back to the stub, so the game is never broken by a bad generation or an
  outage. Default model `claude-opus-4-8` (operator-overridable). Cost is per match
  start and per flagged chat line only; themed rulesets are served from the curated
  library and cached in KV, so popular themes cost nothing to re-serve.

Honest per-unit cost: one ruleset generation is a single Messages API call (roughly a
few thousand output tokens); a flagged chat judgment is a tiny call. Both are rare by
design. See Anthropic pricing for the chosen model.

## Testing strategy

- **Pure, hermetic (`vitest`, node):** engine determinism (replay a full match, assert
  identical state and emissions), the ruleset validator (contradictory effects,
  required-yet-forbidden phrases, unsolvable rulesets), selectors, penalties, and the
  anti-leak audit over sanitized payloads.
- **Integration (`@cloudflare/vitest-pool-workers`, workerd):** the Durable Object over
  a real WebSocket, including an anti-leak capture across live traffic and the
  matchmaking API.

## OSS and licensing ledger

Every runtime dependency is a permissive OSI license, safe for a commercial or
personal project. (`partyserver` is ISC, not MIT; ISC is the simplified MIT and is
equally permissive.)

| Dependency | License | Role |
|---|---|---|
| `partyserver` | **ISC** | Durable Object room server (WebSocket + hibernation) |
| `partysocket` | MIT | Reconnecting client WebSocket |
| `hono` | MIT | Worker HTTP router |
| `zod` | MIT | Validation at every trust boundary |
| `react`, `react-dom` | MIT | Web client |
| `react-router-dom` | MIT | Client routing |
| `@anthropic-ai/sdk` | MIT | Claude adapter (optional path) |
| `@fontsource/zilla-slab` | OFL-1.1 | The General's display voice |
| `@fontsource-variable/archivo` | OFL-1.1 | Interface sans |
| `@fontsource/fragment-mono` | OFL-1.1 | The ledger's court-record mono |
| `vite`, `@vitejs/plugin-react` | MIT | Build tooling |
| `@biomejs/biome` | MIT/Apache-2.0 | Lint + format |
| `vitest`, `@cloudflare/vitest-pool-workers` | MIT | Testing |
| `wrangler` | MIT/Apache-2.0 | Cloudflare CLI |
| `lefthook` | MIT | Git hooks |

## Deliberately deferred

Scaffolded with clean seams, not built in this pass:

- **Bring-your-own-rules permalinks and match archives in D1.** The schema and bindings
  exist (`migrations/0001_init.sql`); the write paths are not wired. BYO already works
  end-to-end through the Claude provider at match start.
- **Accounts / magic-link auth.** Play needs none; the seam is noted above.
- **The "cracked it" verdict.** The `verdict` wire type and the ceremonial "Correct."
  moment exist and fire on a legal win; automatic detection of a player *stating* a
  rule correctly is left for a later pass, deliberately, to keep the secrecy invariant
  absolute (auto-revealing rule text is the one thing that could leak).
- **Turn timers / delay-of-game.** The engine models `turnLimitSeconds`; the default
  is off and no client countdown is shipped.
