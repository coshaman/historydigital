# MAIN20 Final Submission Patch Design

## Goal

Make the five-scene MAIN20 route the default production game while preserving the existing V28 24-case route as an explicit archive/debug route. Add only the requested onboarding, window roundtrip, evidence, copy cleanup, and reproducible packaging changes.

## Constraints

- Do not add cases, endings, characters, literary borrowings, or a second dialogue source.
- `narrative/MAIN_20MIN_DIALOGUE.json` remains the single source of truth.
- Existing reader, provenance, save/load, resolver, actor/visibility, chronology, and V37 tie behavior are regression-only.
- Human playtest remains `PENDING` unless a human actually completes it.

## Design

1. **Route boundary:** `main20-runtime.js` mounts for `/`, `#main`, and `?main20`; `#archive-v28` mounts the existing V28 runtime. The legacy route remains available and is never used as MAIN20 evidence.
2. **Onboarding:** Use an authored `onboarding` block in `MAIN_20MIN_DIALOGUE.json` before C03. It contains 4–8 character lines and one short player response choice, all rendered by the existing dialogue/choice primitives. No popup or new system.
3. **Window:** Preserve the existing Three architectural opening as the structural layer. The DOM `.petersburg-window` becomes a synchronized glass/exterior interaction layer. A roundtrip snapshot stores main20 phase, scene, choice/reaction state, and per-scene reader scroll; opening hides paper/dialogue/choices/tools and closing restores the snapshot.
4. **Evidence:** Add a MAIN20-only browser evidence runner under `scripts/` writing `artifacts/final-main20/`. It captures all four requested viewports and named states, measures stable outer play-area width across short/long dialogue and 1/3-choice layouts, and records mobile overflow/readability geometry.
5. **Package:** Replace the broad evidence README with a minimal reproducible README. Stage only the files referenced by advertised commands, include scripts and `package-lock.json`, omit `node_modules`, add JSON/PNG/hash/server extraction checks, and keep V28 evidence separate.

## Acceptance

- Default URL visibly starts MAIN20 and archive URL visibly starts V28.
- Window open/close restores exact main20 state and reader scroll.
- MAIN20 onboarding is visible in a real production browser.
- Four viewports have no horizontal overflow and readable RU/KO/choices.
- Five endings are captured through MAIN20 production route.
- All frozen-contract audits remain PASS; P0/P1 = 0.
- `FINAL_MAIN20_RELEASE_CANDIDATE` is reported only after clean extraction and command execution; `HUMAN_PLAYTEST` remains separate.
