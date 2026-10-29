<div align="center">

# General Mao

**The card game where the house makes the rules. And won't tell you what they are.**

Free online [Mao](https://en.wikipedia.org/wiki/Mao_(card_game)), except the secret rules aren't invented by a smug winner. They're invented and enforced by an AI called the General: it watches every play, issues penalties in cryptic form, and never, ever explains. Everyone sits down blind. You deduce the law one penalty card at a time.

[![CI](https://github.com/KarthikSubramanian07/general-mao/actions/workflows/ci.yml/badge.svg)](https://github.com/KarthikSubramanian07/general-mao/actions/workflows/ci.yml)
![License: MIT](https://img.shields.io/badge/license-MIT-black)
![Built on Cloudflare](https://img.shields.io/badge/runs%20on-Cloudflare-black?logo=cloudflare)
![TypeScript strict](https://img.shields.io/badge/TypeScript-strict-black?logo=typescript)
![Cost at scale: $0](https://img.shields.io/badge/fixed%20cost-%240-black)

`mao` · `card-game` · `deduction` · `durable-objects` · `cloudflare-workers` · `websockets` · `ai` · `real-time-multiplayer`

</div>

---

> "The only rule I may tell you is this one."

That is the first and last thing the General ever confirms. Everything else, which card is legal, what you were supposed to announce, the word you may not say, the phrase that wins, is secret, generated fresh, and enforced in silence.

## Why this exists

Real Mao needs a rulekeeper who already knows the rules, which spoils it for them and makes it nearly impossible to play cold with strangers. General Mao removes the human. A table of people who have never played can sit down together, entirely blind, and play the real game. The General is consistent to a fault: the same play in the same state draws the same penalty, every time. The mystery comes from hidden-but-fixed laws, never from randomness.

It is lawful evil, not chaotic.

## Play it in two minutes

```bash
npm install
npm run dev          # worker on :8787, site on :5173
```

Open `http://localhost:5173`, convene a table, share the six-character code with a friend (or a second tab). No signup. No API key needed: a deterministic stub serves a curated ruleset, so the whole game is playable at zero cost. Full instructions, including deployment, are in [SETUP.md](./SETUP.md).

## The loop is cruel and simple

1. **Play a card.** It looks like an ordinary shedding game: match rank or suit, empty your hand to win.
2. **Take the penalty.** Break a hidden law and a card slides into your hand. The General names the *category* of your sin ("improper address"), never the rule ("say 'your grace' to a face card").
3. **Crack the pattern.** The ledger fills. You argue in chat. Slowly, together, you infer the laws you are being punished by, until someone goes out and the record is read aloud.

## How it stays honest

Two invariants, both tested, govern every decision. Details in [DECISIONS.md](./DECISIONS.md).

- **Determinism.** A pure, seeded rules engine. A property test replays an entire simulated match and asserts identical adjudications.
- **Secrecy.** The secret ruleset lives only inside a table's Durable Object. It is never sent to a client: the public wire types have no field that could carry rule text, and a test captures every outbound message over a real WebSocket across a full match and asserts none of it leaks.

## Architecture

```
Browser ── Cloudflare Pages (prerendered landing + trust pages, SPA game room)
   │        Pages middleware: Markdown for agents, real 404s
   │  HTTP -> matchmaking API      WSS -> the table's Durable Object
   v
Worker ── Hono API  +  TableServer (one Durable Object per table)
              authoritative state · the secret ruleset · deterministic engine
              WebSocket hibernation (idle tables stop billing)
              AIProvider: stub by default, Claude when a key is set
```

The single paid dependency, the LLM, sits behind an `AIProvider` interface with a deterministic stub as the default. With no key, the game runs fully and every test passes. Real Claude activates fresh ruleset generation and richer natural-language judgment, and every generated ruleset must clear the engine's consistency validator before a match, or it falls back to the stub. So money starts only where the spec says it should, and never breaks the game.

## Readable by agents, not just people

The landing, About, Contact, and Privacy pages are prerendered to HTML at build time (`scripts/prerender.mjs`), so their content exists without JavaScript; the client hydrates the same markup. A small Pages middleware (`apps/web/functions/_middleware.ts`, logic in `src/edge/handler.ts`) answers `Accept: text/markdown` on every page with a Markdown rendition and `Vary: Accept`, serves the same Markdown at `<path>.md`, and returns a real `404` (Markdown or HTML) for unknown paths. [`/llms.txt`](https://general-mao.pages.dev/llms.txt) tells agents when General Mao is the right tool and how to create a table through the API.

```bash
curl -i -H 'Accept: text/markdown' https://general-mao.pages.dev/
curl -i -H 'Accept: text/markdown' https://general-mao.pages.dev/no-such-page   # 404, Markdown body
```

## Layout

```
packages/
  protocol/   client-safe wire types + Zod schemas. Holds no secret rule data, by construction.
  engine/     the deterministic core: RNG, deck, ruleset schema, adjudicator, validator, sanitizer.  SERVER ONLY.
  ai/         AIProvider: interface, deterministic stub (curated rulesets + NL adjudicator), Claude adapter.
apps/
  server/     Cloudflare Worker: Hono API + the TableServer Durable Object.
  web/        Vite + React client: the landing and the felt table.
```

## Tests

```bash
npm test                          # engine + protocol + ai + web edge/prerender (pure, hermetic, node)
npm test --workspace=@mao/server  # the Durable Object over a real WebSocket (workerd)
npm run check                     # typecheck + lint + all of the above
```

The suite includes the determinism property test and the anti-leak payload audit, run against a full simulated match.

## Built on

TypeScript (strict) · Cloudflare Workers, Durable Objects, Pages, D1, KV · [partyserver](https://github.com/cloudflare/partykit) · Hono · React + Vite · Zod · Vitest · Biome. Type is Zilla Slab (the General's voice), Archivo (the interface), and Fragment Mono (the ledger).

## Design

The visual identity is "The Tribunal": a dark baize table under one hard light, a stenographer's ledger, secret rules shown as redaction bars, one oxblood accent, a brass seal. It is a courtroom, not a casino. See [apps/web/DESIGN.md](./apps/web/DESIGN.md).

## License

MIT. Free forever. No ads during play, no paywalls. If you feel moved to it, you can [buy the General a coffee](https://buymeacoffee.com/winnerkarthik). The General does not drink coffee, but accepts the tribute.

---

<div align="center">
The General makes the rules, enforces the rules, and does not answer to you.<br/>
Your only power is to watch, deduce, and, eventually, correctly, silently, win.
</div>
