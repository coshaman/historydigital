# MAIN01 Black-box Beta Test

- Date: 2026-11-18 (Asia/Seoul)
- Tester: independent first-time tester attempt, followed by direct visible-browser play
- Browser target: `https://historydigital.vercel.app/`
- Scope: MAIN01 entry, first objective, immediate dialogue, and whether the player can identify the next action
- Result: **P1 entry blocker reproduced and fixed in code.** The patched local build could not be opened in the browser in this environment, so the post-fix click-through and full ending remain unverified.

## Reproduction on the deployed build before the fix

1. Load the game without an existing run; the world begins on 1847-06-01 at the Nevsky printshop.
2. Open **역사 현장** and select **금지된 삽화 연감 · 도입 퀘스트**.
3. The menu explains that the story is in 1848 but names **교정쇄의 행선지** as the first task.
4. Selecting it leaves the player in June 1847 at the printshop, with the MAIN01 progress display at `0 / 3` and the instruction to move right once and press E.
5. Move right and inspect. The interaction opens a conversation with Ekaterina. After two story-related exchanges, the progress remains `0 / 3` and the interface still does not name the next required task.

The dialogue itself reacted to the proof-reading topic. The blocking problem was the route into the story and the disconnect between the selected MAIN01 label, the unrelated 1847 task, and its completion progress.

## Root cause and code fix

`resolveV47StoryEntry` treated every unresolved quest in earlier campaign arcs as a mandatory gate. On a new save, that routed MAIN01 through the unrelated 1847 printshop quest and the rest of its campaign before the first 1848 MAIN01 beat.

The fix makes MAIN01 directly startable from **역사 현장**. Selecting it moves the save to the first authored MAIN01 scene on 1848-02-12, opens the bookshop map, and places the player in the first eligible story role. It leaves the skipped 1847 quest unresolved instead of fabricating completion.

## Verification status

- `node --test scripts/v47-story-entry.test.mjs`: **PASS**, 7 tests, including direct scene/date/map/role entry and preservation of the unrelated quest.
- `npm run build:v33`, `npm run static-integrity`, and `npm run lint`: **PASS**.
- `npm run check`: **FAIL** at the existing `scripts/v37-bulk-food-supply-test.mjs` assertion (`30 !== 18`, expected 18 bread portions). The V47 story-entry tests earlier in that run passed; this food-supply failure is outside this change.
- A fresh local server on port 4175 could not be reached by the browser (`ERR_CONNECTION_TIMED_OUT`); ports 4173 and 4174 were also unavailable. The visible browser test therefore used the deployed pre-fix version.
- Full MAIN01 completion, the ending screen, and post-fix UI behavior were **not verified** in this beta run.
