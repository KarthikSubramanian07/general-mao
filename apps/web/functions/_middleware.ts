// Cloudflare Pages middleware: runs before every static asset. All logic lives in
// src/edge/handler.ts so it can be unit tested without the Workers runtime.

import { handle } from "../src/edge/handler.js";

interface PagesContext {
  request: Request;
  next: () => Promise<Response>;
  env: { ASSETS: { fetch(input: Request | string): Promise<Response> } };
}

export const onRequest = (ctx: PagesContext): Promise<Response> =>
  handle({ request: ctx.request, next: () => ctx.next(), assets: ctx.env.ASSETS });
