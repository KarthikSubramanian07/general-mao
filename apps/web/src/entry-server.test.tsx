import { describe, expect, it } from "vitest";
import { prerenderPages, render } from "./entry-server.js";

function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function headings(html: string): number[] {
  return [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
}

describe("prerender", () => {
  it.each(["/", "/about", "/contact", "/privacy"])("%s renders 500+ chars of content", (path) => {
    expect(visibleText(render(path)).length).toBeGreaterThanOrEqual(500);
  });

  it.each(["/", "/about", "/contact", "/privacy", "/404"])(
    "%s has exactly one H1 and no skipped heading levels",
    (path) => {
      const levels = headings(render(path));
      expect(levels.filter((l) => l === 1)).toHaveLength(1);
      expect(levels[0]).toBe(1);
      for (let i = 1; i < levels.length; i++) {
        expect((levels[i] as number) - (levels[i - 1] as number)).toBeLessThanOrEqual(1);
      }
    },
  );

  it("names the product in the homepage H1", () => {
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(render("/"))?.[1] ?? "";
    expect(visibleText(h1)).toMatch(/^General Mao, the online Mao card game The house makes/);
  });

  it("links the trust pages from the homepage footer", () => {
    const html = render("/");
    for (const path of ["/about", "/contact", "/privacy"]) expect(html).toContain(`href="${path}"`);
  });

  it("renders the 404 page for unknown routes", () => {
    expect(render("/404")).toContain("No such table on the docket");
  });

  it("writes one file per page, with only the 404 page unindexed", () => {
    const pages = prerenderPages();
    expect(pages.map((p) => p.file)).toEqual([
      "index.html",
      "about.html",
      "contact.html",
      "privacy.html",
      "404.html",
    ]);
    expect(pages.filter((p) => !p.indexable).map((p) => p.path)).toEqual(["/404"]);
  });
});
