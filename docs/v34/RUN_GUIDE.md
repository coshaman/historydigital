# V34 evidence run guide

## Local play

1. Install the checked-in lockfile dependencies with `npm ci`.
2. For the evidence harness, start the local server on the expected port with `$env:PORT=4188; npm start`; open `http://127.0.0.1:4188/`. For ordinary play, `npm start` uses the default port `4173`.
3. To enable the optional Vercel Node Function locally, put `OPENAI_API_KEY` in the ignored `.env.local` file. It is read by the local server and is never a browser variable. Do not commit or archive `.env.local`.
4. Use the arrow keys or WASD to move, E or the on-screen action to inspect, J to open the journal, and the journal tabs to review goals, possessions, relations, sources, and history.

## Vercel-only deployment

Import the repository in Vercel with its root directory set to the repository root. `vercel.json` builds the static game into `dist-v33`; `/api/rpg/*` is served by the root `api/` Node Function. In **Project → Settings → Environment Variables**, add `OPENAI_API_KEY`, mark it Sensitive, select Production and any Preview/Development scopes you need, then redeploy. Keep the variable name exact and never prefix it with `NEXT_PUBLIC_`. No Cloudflare service is required.

Without the variable, the game remains playable and reports the bounded authored-dialogue fallback. Vercel API Functions can also be exercised through mocks without making a provider request.

## Reproduce V34 evidence

```powershell
npm run v34-quest-guidance-test
npm run v34-browser-evidence
npm run acceptance:v33
npm run v34-create-evidence
```

The browser evidence script mocks online behavior and blocks requests in offline journeys. It records viewport screenshots under `docs/v34/screenshots/`; `QA_MATRIX.csv` maps checks to captures. `five-ending-trace.json` summarizes the route-matrix and browser-ending checks. `file-manifest.json` hashes the source, reports, and screenshots in the package.
