# Russian Lives: Act III — V36 open-world build and verification

This repository contains the Vercel-only web game. It keeps the V35/Act III campaign, document reader, possession system, literary realms, Vercel dialogue API, and five historical endings while adding the 1847 Petersburg resident simulation and connected city districts.

Both 3D scenes load the pinned Three.js 0.180.0 modules from `vendor/three/`; they do not depend on a runtime CDN request. The Vercel `dist-v33/` output includes the full `chancery.html` runtime, its required data and visual assets, and the vendored modules. The MIT license is included alongside them. The 3D desk idles without a continuous render loop and redraws on interaction, resize, or camera focus changes.

## Run locally

```powershell
npm ci
npm run build:v33
npm run start
```

Open `http://127.0.0.1:4173/`. The local server serves the static build and same-origin `/api/rpg/*` functions. Without an API key, the game remains playable with its labeled offline dialogue path.

## Verify

```powershell
npm run check
npm run v36-personal-life-chain-test
npm run v36-full-day-36
npm run v36-city-map-acceptance
npm run v36-six-batch-browser
npm run v36-browser-acceptance
npm run acceptance:v36
```

The integrated gate clears `OPENAI_API_KEY`, so it does not make a paid model request. The separate `npm run v36-live-ai-browser` command makes one real generation and requires a key in ignored `.env.local`.

`docs/v36/ACCEPTANCE.json` records each gate and result. The release ZIP contains a root-level runnable source tree, `src/`, `config/`, `maps/`, `npc/`, `assets/`, `quests/`, `historical/`, `qa/`, and curated `screenshots/`. `manifest.sha256` covers the packaged files except itself and the compatibility copy `SHA256SUMS.txt`.

## Deploy to Vercel

- Use the repository root as the Vercel **Root Directory**.
- Set the build command to `npm run build:v33` and the output directory to `dist-v33`.
- Keep the checked-in `vercel.json` function routes; `/api/rpg/health`, `/api/rpg/session/start`, and `/api/rpg/dialogue` are same-origin Vercel Functions.
- Add `OPENAI_API_KEY` as a Sensitive Environment Variable in Vercel Project Settings. Select Production and Preview as needed, then redeploy after changes. Never place the key in a `VITE_*`/browser variable or commit it.
- No Cloudflare Worker, Pages project, or proxy is used.

The health route reports whether a key is configured; it does not prove a model reply was generated. Confirm a successful `/api/rpg/dialogue` response and the in-game `AI 생성 답변` label. Provider failure remains distinguishable from generated text and the offline path remains available.

## Historical and verification limits

The named residents and household-level incidents are fictional gameplay reconstructions. Several outdoor scenes are intentionally stylized and not georeferenced. Period maps, prints, and texts are cited as contextual evidence with those limits stated; they do not prove a specific invented address or household. `V36_FINAL_STATUS.md` identifies the current unmet requirements and must not be read as a completion claim.
