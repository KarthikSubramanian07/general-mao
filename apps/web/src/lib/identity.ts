// A stable per-browser identity so a player keeps their seat (and hand) across
// reloads and reconnects. No account required. Per-table seat tokens prove the
// claim so a guessed playerId cannot steal another player's hand.

const ID_KEY = "gm:playerId";
const NAME_KEY = "gm:name";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `p-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

function tokenKey(code: string): string {
  return `gm:token:${code.toUpperCase()}`;
}

export function getPlayerId(): string {
  let id = localStorage.getItem(ID_KEY);
  if (!id) {
    id = uuid();
    localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}

export function setName(name: string): void {
  localStorage.setItem(NAME_KEY, name.slice(0, 24));
}

export function getTableToken(code: string): string {
  return localStorage.getItem(tokenKey(code)) ?? "";
}

export function setTableToken(code: string, token: string | null): void {
  const key = tokenKey(code);
  if (!token) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, token);
}
