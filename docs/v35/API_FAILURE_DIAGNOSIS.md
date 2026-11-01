# API failure diagnosis

## What was verified

- The local live smoke completed one real generation against `gpt-5.4-mini` using the ignored `.env.local` configuration. Result: `PASS`, `responseValidated: true`. The key and generated dialogue were not printed or written to the evidence bundle.
- The same-origin `/api/rpg/health`, session start, and dialogue request completed through the repository's local Node server.
- The repository's API is a Vercel Node Function at `api/rpg/[...path].js`; the browser calls `/api/rpg/*` on the current origin.

## Most likely reason the earlier deployed call failed

The previously opened production URL was the GitHub Pages address (`coshaman.github.io/historydigital`). GitHub Pages serves static files and does not execute this repository's Node Functions. On that host, `/api/rpg/health` and `/api/rpg/dialogue` cannot reach the application handler. This is a deployment/runtime mismatch, not an invalid local key: the local live call now succeeds.

If the failing URL was already the Vercel domain, the exact historical cause cannot be recovered from this checkout because its Vercel Function logs are not available. The next likely cause is `OPENAI_API_KEY` missing from the Vercel **Production** environment at deployment time, or the deployment predating the environment-variable change. A key configured only in Preview does not configure Production, and Vercel requires a redeploy after environment changes.

## How to fix and distinguish the two cases

1. Open the Vercel deployment domain, not the GitHub Pages domain.
2. Visit `https://<vercel-domain>/api/rpg/health`. It should return `status: "ok"` and `ai: "configured"`.
3. A 404/static response means the request is not reaching the Vercel Function. Confirm the project is deployed from the repository root and that the root `api/` directory is included.
4. `ai: "BLOCKED_NO_KEY"` means add `OPENAI_API_KEY` under Vercel Project → Settings → Environment Variables, enable **Production** (and Preview if needed), mark it sensitive, and redeploy.
5. If health is configured but dialogue falls back, inspect Vercel → Logs → Functions for the safe `rpg_provider_fallback` category. `http_401` indicates credential rejection; `http_429` indicates quota/rate limiting; `network_error` or `timeout` indicates a function/provider transport problem; schema and historical-context categories indicate the game's response validator selected offline dialogue.

Never put the key in a `NEXT_PUBLIC_` variable, browser storage, a URL, or a checked-in file.
