# V34 baseline

- Repository: `coshaman/historydigital`
- Branch: `codex/v33-possession-rpg`
- Commit: `828a7442dafe2de5063bf4b41ba6cbd6750af543`
- Test origin: local Node server at `http://127.0.0.1:4188/`, started without `OPENAI_API_KEY`.
- Viewport: Chromium, 1366 × 768 CSS pixels, device scale 1.
- Browser console/page errors on initial load: none.
- Raw initial screenshot: `baseline-1366x768.png`.

## Two-minute first-play reproduction

1. Open `/` in a fresh browser context. The opening text says to walk, while the map shows several people with no candidate name or actionable marker. `가까이서 말하기` is disabled; no tutorial or first objective is shown.
2. Press ← four times, ↑ twice, then E. In this captured run the inspected person was Pavel Antonov. The game offers `몸을 빌린다`, but provides no route confirmation or candidate explanation. Screenshot: `baseline-after-inspect.png`.
3. Click `몸을 빌린다`. The HUD changes to Pavel and the scene describes his courier role and 11 kopeks. The host notebook element becomes available, but its contents are hidden inside a collapsed `<details>`; the visible journal still does not show an actionable quest step or destination. Screenshot: `baseline-after-possess.png`.
4. Open the notebook and inspect its current facts. It is a compact list of role, objective, allowed/forbidden locations, inventory, knowledge and relations rather than a prioritized action with a route. No player-written input is shown because no conversation has been opened yet.
5. The nearest-person interaction can be tested by walking to a visible NPC and pressing E. In the no-key baseline, conversation controls are not guaranteed to include a typed form; `showConversation()` currently creates it only in the live API branch. A failed session start is caught and represented as authored replies without a truthful typed-input fallback.
6. There is no pinned objective, destination control, contextual onboarding, or stuck recovery. The player must infer an intended target from map art and the current host's private data.

## Initial root-cause notes (confirmed in source)

- `index.html` contains only a collapsed `#host-notebook` details list, no active mission tracker or tutorial panel.
- `updateHud()` writes a metadata-like list but does not derive one legal, reachable next action from the active host and quest state.
- `inspect()` reveals quest requirements only at the physical interaction, so the player can be sent exploring before learning the blocker.
- `showConversation()` conditionally renders the text form based on `hasLiveDialogue()`.
- The active journal can display a multi-turn transcript in the same area as the current NPC turn.
- The existing route is same-origin Vercel Functions; this baseline server used the same handlers with no provider key.

## Baseline scope

The baseline is an actual browser run against the current checked-in commit, not an inference from the prior V33 test suite. Post-change captures must use the same viewport for the initial and comparable gameplay states. The four required viewports, independent blind runs, and end-to-end quest/ending evidence are tracked in `QA_MATRIX.csv` after implementation.
