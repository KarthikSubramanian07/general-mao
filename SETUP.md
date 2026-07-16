# Setup

The shortest path from clone to a running General.

## Run it locally (under 5 minutes)

1. **Install**
   ```bash
   npm install
   ```
2. **Start both dev servers** (worker on :8787, site on :5173)
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173`, convene a table, share the code with a second browser tab.

That is it. With no API key, the deterministic stub serves a curated ruleset and the whole game is playable at zero cost.

## Deploy it (when you choose)

You must be logged into Cloudflare once: `npx wrangler login`.

1. **Provision D1 + KV and wire the config** (idempotent)
   ```bash
   ./setup.sh
   ```
2. **(Optional) turn on real ruleset generation.** Without this, the stub runs.
   ```bash
   cd apps/server && npx wrangler secret put ANTHROPIC_API_KEY
   ```
3. **Deploy the API** and note the Worker URL it prints
   ```bash
   npm run deploy --workspace=@mao/server
   ```
4. **Deploy the site**, pointing it at that Worker URL
   ```bash
   VITE_API_BASE="https://<worker-url>" npm run deploy --workspace=@mao/web
   ```

The site lands at `https://general-mao.pages.dev`.

## Enable the git hooks (optional)

```bash
npx lefthook install
```

Runs Biome and the typecheck on staged files before each commit, and the test suite before each push.
