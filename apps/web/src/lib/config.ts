// Where the game server lives. In dev both default to the local wrangler worker.
// In production these are injected at build time (see setup.sh / deploy).

const DEV = import.meta.env.DEV;

function stripTrailingSlash(s: string): string {
  return s.replace(/\/+$/, "");
}

export const API_BASE: string = stripTrailingSlash(
  import.meta.env.VITE_API_BASE ?? (DEV ? "http://localhost:8787" : ""),
);

/** Host (no protocol) for the WebSocket connection. */
export const WS_HOST: string =
  import.meta.env.VITE_WS_HOST ?? (DEV ? "localhost:8787" : API_BASE.replace(/^https?:\/\//, ""));

export const SITE_URL = "https://general-mao.pages.dev";
