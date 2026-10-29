// Markdown renditions of every public page, served to agents that ask for
// `Accept: text/markdown` (see src/edge/handler.ts) and at `<path>.md` URLs.

import { allDocs, docToMarkdown } from "./docs.js";
import { PUBLIC_API, SITE_URL } from "./site.js";

const FOOTER = `---

More: [About](${SITE_URL}/about) · [Contact](${SITE_URL}/contact) · [Privacy](${SITE_URL}/privacy) · [Agent guide (llms.txt)](${SITE_URL}/llms.txt) · [Sitemap](${SITE_URL}/sitemap.xml)
`;

export const HOME_MARKDOWN = `# General Mao: the online Mao card game where an AI makes the rules

> Free online Mao, refereed by an AI that invents the secret rules and never explains them. No signup, no downloads, 2 to 6 players per table, playable in any browser.

The house makes the rules. It won't tell you what they are. In General Mao the secret rules aren't invented by a smug winner. They're invented and enforced by **the General**: an AI that watches every play, issues penalties in cryptic form, and never, ever explains. Everyone sits down blind. You deduce the law one penalty card at a time.

**Convene a table:** ${SITE_URL}/play

## How it works

1. **Play a card.** It looks like an ordinary shedding game: match the rank or the suit, empty your hand to win. That is the part you're allowed to know.
2. **Take the penalty.** Break a hidden law and a penalty card slides into your hand. The General names your sin, but only the category ("improper address"), never what address was correct.
3. **Crack the pattern.** The ledger fills. You argue in chat. Slowly, together, you infer the laws you're being punished by, until someone goes out and the record is finally read aloud.

## The General

A human rulemaster already knows the rules, which spoils it for them and makes it nearly impossible to play cold with strangers. The General removes the human. It is consistent to a fault: the same play in the same state draws the same penalty, every time. Mystery comes from hidden-but-fixed laws, never from randomness.

## Modes

- **Classic:** a complete, unknown ruleset. Nobody knows anything. The default.
- **Themed decks:** Victorian Court, Superstition, The Ministry. Pick the flavor; you still don't know the rules.
- **Practice:** the rules are shown. The on-ramp for anyone who has never shed a card.
- **Bring your own:** author a devious ruleset in plain English. The General structures and enforces it, and never reveals it.

## Questions

- **Do I need an account?** No. The host convenes a table, shares a six-character code, and friends join on any device with a browser.
- **Is it fair?** Yes, by construction. The rules engine is deterministic and tested, and every ruleset is validated for consistency before a match.
- **Can a player read the rules out of the page?** No. The secret ruleset lives only on the server and is never sent to any client during a match.
- **What does it cost?** Nothing. It is a free, open-source personal project with no ads during play.

${FOOTER}`;

export const PLAY_MARKDOWN = `# Convene a General Mao table

> The lobby where a host creates a new Mao table or joins one with a six-character code.

This page is an interactive lobby for people. Pick a display name, choose a mode (Classic, Themed, or Practice) and a difficulty, then convene a table. You get a six-character code; share ${SITE_URL}/t/CODE with 1 to 5 friends and they join in their browser. Already have a code? Enter it to join.

## For agents

To create a table on someone's behalf, send \`POST ${PUBLIC_API}/api/tables\` with a JSON body such as \`{"config":{"mode":"classic","difficulty":"standard","maxPlayers":4}}\`. The response is \`{"code":"ABC234"}\`. Give the people the link ${SITE_URL}/t/ABC234. Play itself happens in the browser over WebSockets.

${FOOTER}`;

export function tableMarkdown(code: string, spectate: boolean): string {
  return `# General Mao table ${code}${spectate ? " (spectating)" : ""}

> A live General Mao table. Play happens in a web browser; this page has no static content.

Open ${SITE_URL}/${spectate ? "watch" : "t"}/${code} in a browser to ${spectate ? "watch the match" : "take a seat"}. Public, non-secret table details are available as JSON at ${PUBLIC_API}/api/tables/${code}/info. The secret ruleset is never available, to anyone, while the match is in progress.

${FOOTER}`;
}

export const NOT_FOUND_MARKDOWN = `# 404: Not found

> There is no page at this address on General Mao.

The address you requested does not exist. Table links look like ${SITE_URL}/t/ABC234, and tables do not last forever.

Where to go instead:

- [Home](${SITE_URL}/): what General Mao is
- [Convene a table](${SITE_URL}/play)
- [Agent guide (llms.txt)](${SITE_URL}/llms.txt): when to use General Mao and how to call it
- [Sitemap](${SITE_URL}/sitemap.xml): every public page
`;

/** Markdown for every fixed public path. */
export function markdownPages(): Record<string, string> {
  const pages: Record<string, string> = { "/": HOME_MARKDOWN, "/play": PLAY_MARKDOWN };
  for (const doc of allDocs()) pages[doc.path] = docToMarkdown(doc);
  return pages;
}
