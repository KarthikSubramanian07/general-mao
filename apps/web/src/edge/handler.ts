// Edge routing for Cloudflare Pages (wired up in functions/_middleware.ts).
//
// - Markdown content negotiation: `Accept: text/markdown` on any public page gets
//   a Markdown rendition with `Content-Type: text/markdown` and `Vary: Accept`.
//   Browsers keep getting HTML. `<path>.md` URLs serve the same Markdown directly.
// - Real 404s: only known routes get the app. Everything else falls through to
//   static assets, where Pages answers unknown paths with 404.html and a 404 status.
//   Agents asking for Markdown get a Markdown 404 body instead.
// - In-app routes (/play, /t/:code, /watch/:code) get the unrendered app shell.

import { markdownPages, NOT_FOUND_MARKDOWN, tableMarkdown } from "../content/markdown.js";

export interface AssetFetcher {
  fetch(input: Request | string): Promise<Response>;
}

export interface EdgeContext {
  request: Request;
  next: () => Promise<Response>;
  assets: AssetFetcher;
}

/** The unrendered SPA shell, written by scripts/prerender.mjs as dist/app.html. */
export const SHELL_PATH = "/app";

const TABLE_RE = /^\/(t|watch)\/([A-HJ-NP-Z2-9]{6})$/i;
/** Build artifacts that must not be reachable as pages of their own. */
const RESERVED = new Set(["/app", "/app.html", "/404", "/404.html"]);

type Route =
  | { kind: "page"; markdown: string }
  | { kind: "app"; markdown: string }
  | { kind: "markdown-file"; markdown: string }
  | { kind: "reserved" }
  | { kind: "other" };

function mediaQ(accept: string, types: string[]): number | null {
  let best: number | null = null;
  for (const part of accept.split(",")) {
    const [rawType, ...params] = part.trim().split(";");
    const type = rawType?.trim().toLowerCase();
    if (!type || !types.includes(type)) continue;
    let q = 1;
    for (const p of params) {
      const [k, v] = p.trim().split("=");
      if (k?.trim().toLowerCase() === "q" && v !== undefined) {
        const n = Number.parseFloat(v);
        q = Number.isFinite(n) ? Math.min(Math.max(n, 0), 1) : 0;
      }
    }
    best = best === null ? q : Math.max(best, q);
  }
  return best;
}

/**
 * True when the client explicitly ranks Markdown at least as high as HTML.
 * Wildcards alone never select Markdown, so browsers are unaffected.
 */
export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  const md = mediaQ(accept, ["text/markdown", "text/x-markdown"]);
  if (md === null || md <= 0) return false;
  const html =
    mediaQ(accept, ["text/html", "application/xhtml+xml"]) ??
    mediaQ(accept, ["text/*"]) ??
    mediaQ(accept, ["*/*"]) ??
    0;
  return md >= html;
}

function normalize(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : pathname;
}

export function resolveRoute(pathname: string): Route {
  const path = normalize(pathname);
  const pages = markdownPages();

  if (path === "/play") return { kind: "app", markdown: pages["/play"] as string };
  const table = TABLE_RE.exec(path);
  if (table) {
    const spectate = table[1]?.toLowerCase() === "watch";
    return { kind: "app", markdown: tableMarkdown((table[2] as string).toUpperCase(), spectate) };
  }
  const page = pages[path];
  if (page !== undefined) return { kind: "page", markdown: page };

  if (path.endsWith(".md")) {
    const base = path === "/index.md" ? "/" : path.slice(0, -3);
    const md = pages[base];
    if (md !== undefined) return { kind: "markdown-file", markdown: md };
  }
  if (RESERVED.has(path)) return { kind: "reserved" };
  return { kind: "other" };
}

export function markdownResponse(body: string, status: number, method: string): Response {
  return new Response(method === "HEAD" ? null : body, {
    status,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      Vary: "Accept",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function withVary(res: Response, status = res.status): Response {
  const out = new Response(res.body, { status, statusText: "", headers: res.headers });
  const vary = out.headers.get("Vary");
  const tokens = (vary ?? "").split(",").map((v) => v.trim().toLowerCase());
  if (!tokens.includes("accept") && !tokens.includes("*")) {
    out.headers.set("Vary", vary ? `${vary}, Accept` : "Accept");
  }
  return out;
}

async function notFound(ctx: EdgeContext, wantsMd: boolean): Promise<Response> {
  if (wantsMd) return markdownResponse(NOT_FOUND_MARKDOWN, 404, ctx.request.method);
  const page = await ctx.assets.fetch(new URL("/404", ctx.request.url).toString());
  return withVary(page, 404);
}

export async function handle(ctx: EdgeContext): Promise<Response> {
  const { request } = ctx;
  if (request.method !== "GET" && request.method !== "HEAD") return ctx.next();

  const url = new URL(request.url);
  const route = resolveRoute(url.pathname);
  const wantsMd = prefersMarkdown(request.headers.get("Accept"));

  switch (route.kind) {
    case "markdown-file":
      return markdownResponse(route.markdown, 200, request.method);
    case "page":
      if (wantsMd) return markdownResponse(route.markdown, 200, request.method);
      return withVary(await ctx.next());
    case "app": {
      if (wantsMd) return markdownResponse(route.markdown, 200, request.method);
      const shell = await ctx.assets.fetch(new URL(SHELL_PATH, url).toString());
      return withVary(shell, shell.ok ? 200 : shell.status);
    }
    case "reserved":
      return notFound(ctx, wantsMd);
    case "other": {
      const res = await ctx.next();
      if (res.status !== 404) return res;
      // Pages already answered with 404.html; only the Markdown body differs.
      return wantsMd ? markdownResponse(NOT_FOUND_MARKDOWN, 404, request.method) : withVary(res);
    }
  }
}
