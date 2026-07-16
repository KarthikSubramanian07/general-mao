#!/usr/bin/env bash
#
# One-shot, idempotent Cloudflare provisioning for General Mao.
# Creates the D1 database and KV namespace, wires their IDs into
# apps/server/wrangler.jsonc, and applies the D1 migrations.
#
# Prerequisites: `npm install` has run, and `npx wrangler login` is done.
# Safe to run more than once.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
WRANGLER="$ROOT/apps/server/wrangler.jsonc"
cd "$ROOT/apps/server"

say() { printf "\033[1;36m›\033[0m %s\n" "$*"; }

# --- D1 -------------------------------------------------------------------
if grep -q "PLACEHOLDER_D1_ID" "$WRANGLER"; then
  say "Creating D1 database 'general-mao'…"
  OUT="$(npx wrangler d1 create general-mao 2>&1 || true)"
  D1_ID="$(printf '%s' "$OUT" | grep -oE '"?database_id"?[[:space:]]*[:=][[:space:]]*"?[a-f0-9-]{36}"?' | grep -oE '[a-f0-9-]{36}' | head -1 || true)"
  if [ -z "${D1_ID:-}" ]; then
    say "Database may already exist; looking it up…"
    D1_ID="$(npx wrangler d1 list --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);const m=a.find(x=>x.name==="general-mao");process.stdout.write(m?m.uuid:"")})')"
  fi
  if [ -z "${D1_ID:-}" ]; then echo "Could not resolve D1 id." >&2; exit 1; fi
  perl -pi -e "s/PLACEHOLDER_D1_ID/$D1_ID/" "$WRANGLER"
  say "D1 id → $D1_ID"
else
  say "D1 already configured."
fi

# --- KV -------------------------------------------------------------------
if grep -q "PLACEHOLDER_KV_ID" "$WRANGLER"; then
  say "Creating KV namespace 'CONFIG'…"
  OUT="$(npx wrangler kv namespace create CONFIG 2>&1 || true)"
  KV_ID="$(printf '%s' "$OUT" | grep -oE '"?id"?[[:space:]]*[:=][[:space:]]*"?[a-f0-9]{32}"?' | grep -oE '[a-f0-9]{32}' | head -1 || true)"
  if [ -z "${KV_ID:-}" ]; then
    say "Namespace may already exist; looking it up…"
    KV_ID="$(npx wrangler kv namespace list 2>/dev/null | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);const m=a.find(x=>/CONFIG$/.test(x.title));process.stdout.write(m?m.id:"")})')"
  fi
  if [ -z "${KV_ID:-}" ]; then echo "Could not resolve KV id." >&2; exit 1; fi
  perl -pi -e "s/PLACEHOLDER_KV_ID/$KV_ID/" "$WRANGLER"
  say "KV id → $KV_ID"
else
  say "KV already configured."
fi

# --- migrations -----------------------------------------------------------
say "Applying D1 migrations (remote)…"
npx wrangler d1 migrations apply general-mao --remote -y || say "Migrations skipped or already applied."

cat <<'DONE'

Provisioning complete.

Next steps:
  1. (Optional) Enable real ruleset generation:
       cd apps/server && npx wrangler secret put ANTHROPIC_API_KEY
     Without it, the deterministic stub runs the whole game at $0.
  2. Deploy the API:      npm run deploy --workspace=@mao/server
  3. Note the Worker URL it prints, then deploy the site:
       VITE_API_BASE="https://<worker-url>" npm run deploy --workspace=@mao/web
DONE
