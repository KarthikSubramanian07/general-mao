/**
 * The Worker: a thin matchmaking API (Hono) in front of the TableServer Durable
 * Objects. WebSocket upgrades for a table are routed to its DO by partyserver;
 * everything else is a small JSON API. No game logic and no secrets live here.
 */

import { themeCatalog } from "@mao/ai";
import { tableConfigInputSchema } from "@mao/protocol";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getServerByName, routePartykitRequest } from "partyserver";
import { isValidCode, makeTableCode, normalizeCode } from "./codes.js";
import type { Env } from "./env.js";

export { TableServer } from "./table.js";

const app = new Hono<{ Bindings: Env }>();

const ALLOWED_ORIGINS = new Set([
  "https://general-mao.pages.dev",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
]);

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Cloudflare Pages preview deployments for this project.
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && u.hostname.endsWith(".general-mao.pages.dev");
  } catch {
    return false;
  }
}

app.use(
  "/api/*",
  cors({
    origin: (origin) => (isAllowedOrigin(origin) ? origin : ""),
    allowMethods: ["GET", "POST", "OPTIONS"],
    maxAge: 86400,
  }),
);

app.use("/api/*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("Referrer-Policy", "no-referrer");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
});

app.get("/api/health", (c) => c.json({ ok: true, service: "general-mao", ts: Date.now() }));

app.get("/api/themes", (c) => c.json({ themes: themeCatalog() }));

/** Soft create-table rate limit: 8 tables per IP per minute via KV. */
const TABLE_CREATE_LIMIT = 8;
const TABLE_CREATE_WINDOW_SEC = 60;

async function allowTableCreate(env: Env, ip: string): Promise<boolean> {
  if (!env.CONFIG) return true;
  const key = `rl:tables:${ip || "unknown"}`;
  const raw = await env.CONFIG.get(key);
  const count = raw ? Number.parseInt(raw, 10) : 0;
  if (Number.isFinite(count) && count >= TABLE_CREATE_LIMIT) return false;
  const next = (Number.isFinite(count) ? count : 0) + 1;
  await env.CONFIG.put(key, String(next), { expirationTtl: TABLE_CREATE_WINDOW_SEC });
  return true;
}

app.post("/api/tables", async (c) => {
  const ip =
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!(await allowTableCreate(c.env, ip))) {
    return c.json({ error: "too many tables; wait a minute" }, 429);
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = tableConfigInputSchema.safeParse(body?.config ?? {});
  if (!parsed.success) {
    return c.json({ error: "invalid config" }, 400);
  }
  const byoRules = typeof body?.byoRules === "string" ? body.byoRules.slice(0, 4000) : null;

  const code = makeTableCode();
  const stub = await getServerByName(c.env.Table, code);
  const res = await stub.fetch("https://table/init", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ config: parsed.data, byoRules }),
  });
  if (!res.ok) return c.json({ error: "could not create table" }, 500);
  return c.json({ code });
});

app.get("/api/tables/:code/info", async (c) => {
  const code = normalizeCode(c.req.param("code"));
  if (!code) return c.json({ error: "invalid code" }, 400);
  const stub = await getServerByName(c.env.Table, code);
  const res = await stub.fetch("https://table/info");
  return new Response(res.body, {
    status: res.status,
    headers: { "content-type": "application/json" },
  });
});

app.get("/api/tables/:code/exists", async (c) => {
  const code = normalizeCode(c.req.param("code"));
  if (!code || !isValidCode(code)) return c.json({ valid: false, exists: false });
  const stub = await getServerByName(c.env.Table, code);
  const res = await stub.fetch("https://table/info");
  if (!res.ok) return c.json({ valid: true, exists: false });
  const info = (await res.json().catch(() => null)) as { inited?: boolean } | null;
  return c.json({ valid: true, exists: !!info?.inited });
});

app.get("/", (c) =>
  c.text("General Mao API. The only rule I may tell you is this one.", 200, {
    "content-type": "text/plain; charset=utf-8",
  }),
);

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return (await routePartykitRequest(request, env as never)) || app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
