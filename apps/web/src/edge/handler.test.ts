import { describe, expect, it, vi } from "vitest";
import { NOT_FOUND_MARKDOWN } from "../content/markdown.js";
import { type EdgeContext, handle, prefersMarkdown, resolveRoute } from "./handler.js";

const ORIGIN = "https://general-mao.pages.dev";

/** A fake Pages context: `next` serves static pages, `assets` serves any path. */
function ctx(
  path: string,
  init: { accept?: string; method?: string; staticStatus?: number } = {},
): EdgeContext & { next: ReturnType<typeof vi.fn>; assetPaths: string[] } {
  const assetPaths: string[] = [];
  const html = (body: string, status = 200) =>
    new Response(body, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
  const next = vi.fn(async () => html(`static:${path}`, init.staticStatus ?? 200));
  return {
    request: new Request(`${ORIGIN}${path}`, {
      method: init.method ?? "GET",
      headers: init.accept ? { Accept: init.accept } : {},
    }),
    next,
    assetPaths,
    assets: {
      fetch: async (input) => {
        const p = new URL(typeof input === "string" ? input : input.url).pathname;
        assetPaths.push(p);
        return html(`asset:${p}`);
      },
    },
  };
}

describe("prefersMarkdown", () => {
  it.each([
    ["text/markdown", true],
    ["text/x-markdown", true],
    ["text/markdown, text/html", true],
    ["text/html, text/markdown", true],
    ["text/markdown;q=0.9, */*;q=0.1", true],
    ["text/markdown;q=0.5, text/html", false],
    ["text/markdown;q=0", false],
    ["text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", false],
    ["*/*", false],
    ["text/*", false],
    ["", false],
  ])("%j -> %s", (accept, expected) => {
    expect(prefersMarkdown(accept)).toBe(expected);
  });

  it("treats a missing header as HTML", () => {
    expect(prefersMarkdown(null)).toBe(false);
  });
});

describe("resolveRoute", () => {
  it("classifies pages, app routes, markdown files, and reserved build artifacts", () => {
    expect(resolveRoute("/").kind).toBe("page");
    expect(resolveRoute("/about").kind).toBe("page");
    expect(resolveRoute("/privacy/").kind).toBe("page");
    expect(resolveRoute("/play").kind).toBe("app");
    expect(resolveRoute("/t/ABC234").kind).toBe("app");
    expect(resolveRoute("/watch/abc234").kind).toBe("app");
    expect(resolveRoute("/index.md").kind).toBe("markdown-file");
    expect(resolveRoute("/contact.md").kind).toBe("markdown-file");
    expect(resolveRoute("/app").kind).toBe("reserved");
    expect(resolveRoute("/404.html").kind).toBe("reserved");
    // Codes use an alphabet without O/0/I/1 and are exactly six characters.
    expect(resolveRoute("/t/ABC2340").kind).toBe("other");
    expect(resolveRoute("/t/OOOOOO").kind).toBe("other");
    expect(resolveRoute("/nope.md").kind).toBe("other");
    expect(resolveRoute("/llms.txt").kind).toBe("other");
  });
});

describe("handle: markdown negotiation", () => {
  it("serves the homepage as Markdown with Vary: Accept", async () => {
    const c = ctx("/", { accept: "text/markdown" });
    const res = await handle(c);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    expect(res.headers.get("Vary")).toBe("Accept");
    const body = await res.text();
    expect(body.startsWith("# General Mao")).toBe(true);
    expect(body.length).toBeGreaterThan(500);
    expect(c.next).not.toHaveBeenCalled();
  });

  it("keeps serving HTML to browsers, adding Vary: Accept", async () => {
    const c = ctx("/", { accept: "text/html,*/*;q=0.8" });
    const res = await handle(c);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("Vary")).toBe("Accept");
    expect(await res.text()).toBe("static:/");
  });

  it("appends Accept to an existing Vary header without duplicating it", async () => {
    const c = ctx("/about");
    c.next.mockResolvedValueOnce(new Response("x", { headers: { Vary: "Accept-Encoding" } }));
    expect((await handle(c)).headers.get("Vary")).toBe("Accept-Encoding, Accept");
  });

  it.each(["/about", "/contact", "/privacy", "/play"])("negotiates %s", async (path) => {
    const res = await handle(ctx(path, { accept: "text/markdown" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
    expect(await res.text()).toMatch(/^# /);
  });

  it("serves .md URLs regardless of Accept", async () => {
    const res = await handle(ctx("/privacy.md"));
    expect(res.headers.get("Content-Type")).toContain("text/markdown");
    expect(await res.text()).toMatch(/^# Privacy policy/);
  });

  it("returns an empty body for HEAD", async () => {
    const res = await handle(ctx("/", { accept: "text/markdown", method: "HEAD" }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("passes non-GET requests straight through", async () => {
    const c = ctx("/", { accept: "text/markdown", method: "POST" });
    await handle(c);
    expect(c.next).toHaveBeenCalledOnce();
  });
});

describe("handle: app routes", () => {
  it("serves the unrendered shell for tables", async () => {
    const c = ctx("/t/ABC234");
    const res = await handle(c);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("asset:/app");
    expect(res.headers.get("Vary")).toBe("Accept");
  });

  it("describes a table in Markdown for agents", async () => {
    const res = await handle(ctx("/watch/abc234", { accept: "text/markdown" }));
    const body = await res.text();
    expect(body).toContain("ABC234 (spectating)");
    expect(body).toContain("/api/tables/ABC234/info");
  });
});

describe("handle: real 404s", () => {
  it("returns a Markdown 404 for unknown paths", async () => {
    const c = ctx("/some-path-that-does-not-exist", { accept: "text/markdown", staticStatus: 404 });
    const res = await handle(c);
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("text/markdown; charset=utf-8");
    const body = await res.text();
    expect(body).toBe(NOT_FOUND_MARKDOWN);
    expect(body).toContain("/llms.txt");
    expect(body).toContain("/sitemap.xml");
  });

  it("keeps the HTML 404 page and status for browsers", async () => {
    const res = await handle(ctx("/nope", { staticStatus: 404 }));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("static:/nope");
    expect(res.headers.get("Vary")).toBe("Accept");
  });

  it("does not let build artifacts masquerade as pages", async () => {
    const c = ctx("/app");
    const res = await handle(c);
    expect(res.status).toBe(404);
    expect(c.assetPaths).toEqual(["/404"]);
    expect(c.next).not.toHaveBeenCalled();
  });

  it("leaves existing static files untouched", async () => {
    const c = ctx("/llms.txt", { accept: "text/markdown" });
    const res = await handle(c);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("static:/llms.txt");
  });
});
