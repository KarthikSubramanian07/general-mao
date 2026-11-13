#!/usr/bin/env bash
#
# One-shot, idempotent Cloudflare provisioning for General Mao.
# Creates the KV namespace and wires its ID into apps/server/wrangler.jsonc.
#
# Prerequisites: `npm install` has run, and `npx wrangler login` is done.
# Safe to run more than once.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
WRANGLER="$ROOT/apps/server/wrangler.jsonc"
cd "$ROOT/apps/server"

say() { printf "\033[1;36m›\033[0m %s\n" "$*"; }

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
