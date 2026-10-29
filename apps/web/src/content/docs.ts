// The trust pages (/about, /contact, /privacy) as structured content. The same
// structure renders as the React page and as the Markdown agents receive.

import { COFFEE_URL, CONTACT, ISSUES_URL, PUBLIC_API, REPO_URL, SITE_URL } from "./site.js";

export type Inline = string | { text: string; href: string };
export type Block = { p: Inline[] } | { list: Inline[][] };

export interface DocSection {
  heading: string;
  blocks: Block[];
}

export interface Doc {
  path: "/about" | "/contact" | "/privacy";
  /** The page's H1. */
  title: string;
  /** <title> and og:title. */
  metaTitle: string;
  description: string;
  eyebrow: string;
  intro: Inline[];
  sections: DocSection[];
}

const link = (text: string, href: string): Inline => ({ text, href });

export const ABOUT: Doc = {
  path: "/about",
  title: "About General Mao",
  metaTitle: "About General Mao, the online Mao card game with an AI referee",
  description:
    "What General Mao is, who makes it, and how the AI referee keeps the secret rules of Mao fair, consistent, and hidden.",
  eyebrow: "The record",
  intro: [
    "General Mao is a free online version of Mao, the card game whose rules are secret. Here the rules are not invented by a smug winner at the table. They are invented and enforced by the General, an AI referee that watches every play, issues penalty cards, and never explains why.",
  ],
  sections: [
    {
      heading: "What the game is",
      blocks: [
        {
          p: [
            "Mao looks like an ordinary shedding game: match the rank or the suit and empty your hand to win. Underneath sits a secret ruleset. Break a hidden law and you draw a penalty card, along with the category of your offense but never the rule itself. Two to six players share a table in the browser, argue in chat, and deduce the laws together until someone goes out and the record is read aloud.",
          ],
        },
      ],
    },
    {
      heading: "Why an AI referee",
      blocks: [
        {
          p: [
            "A human rulemaster already knows the rules, which spoils the game for them and makes it nearly impossible to play cold with strangers. The General removes that person. Its rules engine is deterministic and tested: the same play in the same state always draws the same penalty. Each ruleset is validated for consistency before a match begins, and the secret rules never leave the server until the match is over.",
          ],
        },
      ],
    },
    {
      heading: "Who makes it",
      blocks: [
        {
          p: [
            "General Mao is an independent, open-source project built and maintained by Karthik Subramanian. The full source code, design notes, and decision log are public on ",
            link("GitHub", REPO_URL),
            ". It is free to play, has no ads during play, needs no account, and is released under the MIT license.",
          ],
        },
        {
          p: [
            "It runs on Cloudflare: the site on Cloudflare Pages, and each live table inside its own Durable Object. If you enjoy it, you can ",
            link("buy the General a coffee", COFFEE_URL),
            ".",
          ],
        },
      ],
    },
  ],
};

function contactChannels(): Inline[][] {
  const rows: Inline[][] = [
    ["Bug reports, feature ideas, and questions: ", link("open an issue on GitHub", ISSUES_URL)],
    ["Source code and project history: ", link(REPO_URL.replace("https://", ""), REPO_URL)],
  ];
  if (CONTACT.email) {
    rows.unshift(["Email: ", link(CONTACT.email, `mailto:${CONTACT.email}`)]);
  }
  return rows;
}

export function contactDoc(): Doc {
  return {
    path: "/contact",
    title: "Contact General Mao",
    metaTitle: "Contact General Mao",
    description:
      "How to reach the people behind General Mao: report a bug, request a feature, ask a question, or raise a privacy request.",
    eyebrow: "Petition the court",
    intro: [
      "The General does not take questions. The people who built it do. General Mao is a small independent project, so every message is read by the person who maintains it.",
    ],
    sections: [
      {
        heading: "How to reach us",
        blocks: [{ list: contactChannels() }],
      },
      {
        heading: "What to include",
        blocks: [
          {
            p: [
              "If something went wrong at a table, include the six-character table code, roughly when it happened, the device and browser you were using, and what you expected to happen. Please do not ask for the secret rules of a match in progress. They are never revealed early, to anyone, and that refusal is the entire game.",
            ],
          },
        ],
      },
      {
        heading: "Privacy and data requests",
        blocks: [
          {
            p: [
              "To ask about data, or to request that a finished-match record be removed, use the same channels and mention the table code. The ",
              link("privacy policy", `${SITE_URL}/privacy`),
              " explains exactly what is and is not stored.",
            ],
          },
        ],
      },
    ],
  };
}

export const PRIVACY: Doc = {
  path: "/privacy",
  title: "Privacy policy",
  metaTitle: "Privacy policy, General Mao",
  description:
    "What General Mao stores, what it does not, and why: no accounts, no ads, no tracking, and secret rules that never reach your browser.",
  eyebrow: "Sealed records",
  intro: [
    "General Mao collects as little as it can and still run a card game. There are no accounts, no advertising, no analytics trackers, and no third-party cookies. This page lists everything that is kept, where, and for how long.",
  ],
  sections: [
    {
      heading: "Stored in your browser",
      blocks: [
        {
          p: [
            "Your browser's local storage keeps a random player identifier, the display name you choose, and a per-table seat token. These let you rejoin a table and keep your hand after a reload. They never leave your device except when sent to the table you are playing at, and clearing site data removes them.",
          ],
        },
      ],
    },
    {
      heading: "Stored on our servers",
      blocks: [
        {
          p: [
            "While a table is live, its Durable Object holds the game state, the display names at the table, and the most recent chat messages. Finished matches may be archived with the table code, theme, player count, penalty count, winner's display name, and the revealed ruleset. Rulesets you write in Bring-your-own mode are stored so the match can enforce them.",
          ],
        },
        {
          p: [
            "To limit abuse, the game API counts table creations per IP address in a short-lived counter that expires after about a minute. Cloudflare, which hosts the site and API, processes standard request data such as IP addresses to deliver and protect the service.",
          ],
        },
      ],
    },
    {
      heading: "The AI referee",
      blocks: [
        {
          p: [
            "When AI generation is enabled, ruleset requests and chat messages that might break a speech rule may be sent to Anthropic's Claude API so the General can judge them. That data is used only to referee your match. Display names and identifiers are not needed for that judgment.",
          ],
        },
      ],
    },
    {
      heading: "Your choices",
      blocks: [
        {
          p: [
            "You can play without giving a real name. You can clear your browser storage at any time. To ask about or remove a stored record, see the ",
            link("contact page", `${SITE_URL}/contact`),
            ". The source code that implements all of this is public, so every claim here can be checked. The public API at ",
            link(PUBLIC_API.replace("https://", ""), PUBLIC_API),
            " is covered by this same policy.",
          ],
        },
      ],
    },
  ],
};

export function allDocs(): Doc[] {
  return [ABOUT, contactDoc(), PRIVACY];
}

export function findDoc(path: string): Doc | undefined {
  return allDocs().find((d) => d.path === path);
}

function inlineToMarkdown(parts: Inline[]): string {
  return parts.map((p) => (typeof p === "string" ? p : `[${p.text}](${p.href})`)).join("");
}

export function docToMarkdown(doc: Doc): string {
  const out: string[] = [
    `# ${doc.title}`,
    "",
    `> ${doc.description}`,
    "",
    inlineToMarkdown(doc.intro),
  ];
  for (const s of doc.sections) {
    out.push("", `## ${s.heading}`, "");
    for (const b of s.blocks) {
      if ("p" in b) out.push(inlineToMarkdown(b.p), "");
      else out.push(...b.list.map((row) => `- ${inlineToMarkdown(row)}`), "");
    }
    if (out[out.length - 1] === "") out.pop();
  }
  out.push("", "---", "", `Home: ${SITE_URL}/ · Agent guide: ${SITE_URL}/llms.txt`, "");
  return out.join("\n");
}
