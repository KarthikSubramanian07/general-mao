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

app.use("/api/*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"] }));

app.get("/api/health", (c) => c.json({ ok: true, service: "general-mao", ts: Date.now() }));

app.get("/api/themes", (c) => c.json({ themes: themeCatalog() }));

app.post("/api/tables", async (c) => {
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
  return c.json({ valid: !!code && isValidCode(code) });
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
