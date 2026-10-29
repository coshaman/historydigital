# V33 Baseline and Phase 0 Inventory

Date: 2026-10-29

## Authoritative starting point

- Project root: `C:\Users\owner\Documents\ChatGPT\history`.
- Current branch / commit: `master` / `3920422425cef04ab137c80fdafab333362ed844`.
- `origin/master` is `756f9033765329db8eec2cbdbfc175febf5d874e`; local master contains three later committed UI/document changes. The root has many pre-existing untracked audit and delivery folders. They are not inputs to this implementation and must remain untouched.
- The separate V32 worktree is `codex/v32-ai-late-game` at `57e1104b50d608c679f48843e327fa967f523e08`; its implementation commit is `735937d` plus later audits. It is based on `756f903`, not the present local master.
- Root `AGENTS.md` contains the source-first rules and game DoD, but not the titled full Web Game Quality Contract. The contract was located and read from the supplied attachment `2521366e-f986-4b30-abc1-daf881cb453b/붙여넣은 텍스트.txt`; its material rules (game-world-first, actual assets, no dashboard/AI-default UI, accessibility, real browser inspection, two-pass refinement) apply.

## Baseline commands

| Command | Result |
|---|---|
| `npm run check` | PASS: historical lint, 9 sources, exactly five endings |
| `npm run lint` | PASS: bespoke palette and reduced motion |
| `npm test -- --runInBand` | PASS: route test, five endings and E02/E04/E07 anchors |
| `npm run build` | PASS: static integrity; no bundler configured |

## Existing implementation and reuse

- The root entry is a vanilla HTML/JavaScript site with `app.js`, `gold-runtime.js`, `three-walk.js`, `main20-runtime.js`, and Three.js 0.180. Its current gameplay is not a tile RPG. No Phaser dependency, Tiled map runtime, possession state model, pixel atlas, or playable 2D maps are present in the committed root.
- Root `data/` contains source/claim/case records and the current five-ending route rules. Existing `assets/` contains the desk, old 3D route and period references. These remain preserved.
- The V32 worktree contains reusable `ai/http/turn-handler.js`, `ai/context-composer.js`, `ai/memory-store.js`, `ai/validate-turn.js`, `ai/provider/openai-responses.js`, `ai-worker/src/index.js`, `main20-ai-state-engine.js`, strict schemas, lore/source cards and offline fallback. It has no live-key verification. The V32 handler is authored for three NPC identities and must not be handed client-authored host stats or private knowledge; V33 needs a server-owned host/session adapter.
- `docs/v33/` and `artifacts/v33/` in the root are older main-route dialogue/audit evidence, not evidence of a possession RPG. They do not satisfy V33 requirements.

## Phase 0 architecture rulings

1. Build the new game as a browser-native Canvas2D runtime using 16×16 Tiled JSON tile layers and real PNG atlases. The existing project is unbundled vanilla JavaScript and already has a static Pages build; a small Canvas2D renderer avoids shipping a large framework/runtime dependency while still using actual tilemap data and sprite PNGs. Tiled JSON remains an explicit, testable content format.
2. Keep the previous Chancery game available as `chancery.html`; switch `/` to the playable RPG only after the Phase 1 movement/interaction gate passes.
3. Reuse V32 AI modules and source/lore records as imported server code/data. Keep RPG world, player, and per-host states separate. The AI service receives opaque session/scene/player input only and obtains host memory/knowledge from server-owned session storage.
4. Start with the two-map street/printshop slice and four materially different fictional hosts. Add the chancery/courtyard, historical reconstruction and literary realm only after the 2-minute Phase 1 exploration gate passes.
5. No new account system or paid service. The Cloudflare Worker remains the only secret-bearing runtime; absent credentials means honest `BLOCKED_NO_KEY` plus a complete offline route.

## Historical and visual constraints

- 1847–1849 Petersburg is the active timeline; earlier source material is only shown with an explicit date/context. Famous historical outcomes remain immutable.
- Existing source records are reused where fit. New period details and asset motifs need source IDs/URLs in the RPG provenance manifest. Public-domain underlying artwork does not automatically grant rights to repository scans.
- The local-root `AGENTS.md` DoD continues to apply: source drawer, evidence key, five exact endings, mobile/reduced-motion and source-first outcomes must remain reachable through the preserved Chancery entry.
