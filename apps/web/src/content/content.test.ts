import { describe, expect, it } from "vitest";
import llms from "../../public/llms.txt?raw";
import sitemap from "../../public/sitemap.xml?raw";
import { allDocs, docToMarkdown } from "./docs.js";
import { markdownPages, NOT_FOUND_MARKDOWN } from "./markdown.js";
import { organizationJsonLd, SITE_URL } from "./site.js";

/** Visible prose length of a doc, as a crawler would count it. */
function textLength(md: string): number {
  return md
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*`-]/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

describe("trust pages", () => {
  it.each(allDocs().map((d) => [d.path, d] as const))("%s has 500+ chars of content", (_, doc) => {
    expect(textLength(docToMarkdown(doc))).toBeGreaterThanOrEqual(500);
  });

  it("render to Markdown with one H1 and only H2 sections", () => {
    for (const doc of allDocs()) {
      const md = docToMarkdown(doc);
      expect(md.match(/^# /gm)).toHaveLength(1);
      expect(md).not.toMatch(/^#{3,} /m);
    }
  });
});

describe("markdown pages", () => {
  it("covers every public page", () => {
    expect(Object.keys(markdownPages()).sort()).toEqual(
      ["/", "/about", "/contact", "/play", "/privacy"].sort(),
    );
  });

  it("names the product on the homepage", () => {
    const home = markdownPages()["/"] as string;
    expect(home).toMatch(/^# General Mao: the online Mao card game/);
    expect(textLength(home)).toBeGreaterThan(500);
  });

  it("explains a 404 and points agents somewhere useful", () => {
    expect(NOT_FOUND_MARKDOWN).toMatch(/^# 404/);
    expect(NOT_FOUND_MARKDOWN).toContain(`${SITE_URL}/llms.txt`);
  });
});

describe("Organization JSON-LD", () => {
  it("includes a contact point", () => {
    const org = organizationJsonLd();
    expect(org["@type"]).toBe("Organization");
    expect(org.contactPoint).toMatchObject({
      "@type": "ContactPoint",
      contactType: expect.any(String),
    });
  });
});

describe("llms.txt", () => {
  it("follows the llmstxt.org shape: H1, blockquote summary, H2 link sections", () => {
    const lines = llms.split("\n");
    expect(lines[0]).toBe("# General Mao");
    expect(lines.filter((l) => l.startsWith("# "))).toHaveLength(1);
    expect(llms).toMatch(/^> .+/m);
    expect(llms).toMatch(/^## Optional$/m);
  });

  it("has when-to-use guidance and how to call the API", () => {
    expect(llms).toMatch(/^## When to use General Mao$/m);
    expect(llms).toMatch(/^## How an agent should use it$/m);
    expect(llms).toContain("POST https://general-mao-api.karthik-e5e.workers.dev/api/tables");
  });

  it("links only to Markdown pages that exist", () => {
    const pages = markdownPages();
    const links = [...llms.matchAll(/\]\((https:\/\/general-mao\.pages\.dev[^)]*\.md)\)/g)];
    expect(links.length).toBeGreaterThanOrEqual(5);
    for (const [, href] of links) {
      const path = new URL(href as string).pathname.replace(/\.md$/, "");
      expect(pages[path === "/index" ? "/" : path], href).toBeDefined();
    }
  });
});

describe("sitemap.xml", () => {
  it("lists every indexable page", () => {
    for (const path of ["/", "/play", "/about", "/contact", "/privacy"]) {
      expect(sitemap).toContain(`<loc>${SITE_URL}${path}</loc>`);
    }
  });
});
