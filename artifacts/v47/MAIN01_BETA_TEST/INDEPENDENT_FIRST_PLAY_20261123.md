# MAIN01 fresh-play beta check — 2026-11-23

## Result

The fresh-context browser check completed the opening objective and reached the March 9 printwork objective. It used a new Playwright context with empty local storage and clicked visible controls; no save state was injected.

## Player path verified

1. Opened **역사 현장** and selected **금지된 삽화 연감**.
2. The opening task showed **부록은 어디 있습니까?**, the bookshop location, Lev as the responsible character, the route (**왼쪽 10칸 → 아래 1칸**), the E interaction, and the two available choices.
3. Followed the route, opened the physical scene, selected **구독 장부에서 이름을 찾는다**, and saw the reservation receipt and relationship change in the journal.
4. Used the visible **3월 9일 자료로 이어가기** action. The next task named Ekaterina, the printshop, and said to finish the seven physical typesetting steps before choosing **교정쇄와 활자 수를 맞춘다**.
5. Opened the roster and selected Ekaterina. The game moved her to the printshop and updated the task to **인쇄 작업 1/7 · 활자 상자** with a usable destination pin and route instructions.

## UI and runtime

- Desktop viewport: 1365×768. Mobile viewport: 390×844.
- No horizontal overflow at either size. Quest details remain in the scrollable journal panel; at mobile size it reports `overflow-y: auto` and additional scroll height.
- Browser page errors: 0.
- The opened selection and date transition each displayed an actionable button.

## Findings

- No gameplay defect was reproduced in this route, so no game code was changed.
- The first subagent browser attempt stopped at the menu because its probe queried a missing `#map-name` selector. This was a test-driver problem, not a game failure; the fresh-context replay used the actual visible UI and reached the next objective.
- This is a partial beta route. It does not verify the full MAIN01 story, its endings, AI dialogue, or later branch recovery.

## Evidence

Screenshots are in `artifacts/v47/MAIN01_INDEPENDENT_FIRST_PLAY/`:

- `01-fresh-start.png`
- `02-story-menu.png`
- `03-first-objective.png`
- `04-first-interaction.png`
- `04-first-choice.png`
- `05-opening-complete.png`
- `06-march-objective.png`
- `07-role-selection.png`
- `07-role-action-guidance.png`
- `08-role-action-mobile.png`

Replay command: `node scripts/v47-main01-first-play-browser.mjs` (requires the `dist-v33` build and installed Chrome).
