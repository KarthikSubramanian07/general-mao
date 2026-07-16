import type { Difficulty, RulesetMode } from "@mao/protocol";
import { API_BASE } from "./config.js";

export interface ThemeCard {
  id: string;
  name: string;
  theme: string;
  difficulty: Difficulty;
  blurb: string;
}

export interface CreateTableInput {
  mode: RulesetMode;
  difficulty: Difficulty;
  themeId?: string | null;
  maxPlayers?: number;
  byoRules?: string | null;
}

export async function fetchThemes(): Promise<ThemeCard[]> {
  const res = await fetch(`${API_BASE}/api/themes`);
  if (!res.ok) throw new Error("could not load themes");
  const data = (await res.json()) as { themes: ThemeCard[] };
  return data.themes;
}

export async function createTable(input: CreateTableInput): Promise<string> {
  const res = await fetch(`${API_BASE}/api/tables`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      config: {
        mode: input.mode,
        difficulty: input.difficulty,
        themeId: input.themeId ?? null,
        maxPlayers: input.maxPlayers ?? 6,
      },
      byoRules: input.byoRules ?? null,
    }),
  });
  if (!res.ok) throw new Error("the General declined to convene a table");
  const data = (await res.json()) as { code: string };
  return data.code;
}

export interface TableInfo {
  code: string;
  phase: string;
  players: number;
  mode: string;
  difficulty: string;
  penalties: number;
}

export async function fetchTableInfo(code: string): Promise<TableInfo | null> {
  const res = await fetch(`${API_BASE}/api/tables/${code}/info`);
  if (!res.ok) return null;
  return (await res.json()) as TableInfo;
}
