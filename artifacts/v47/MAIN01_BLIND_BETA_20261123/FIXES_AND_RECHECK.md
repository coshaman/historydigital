# MAIN01 blind beta follow-up — 2026-11-23

## Independent play result

The blind tester completed all 12 MAIN01 beats across nine characters and six maps, ending with the 1848-12-12 ledger choice. They selected the route that preserved one copy privately and paid Stefan first. The final choice produced an in-game aftermath, but the story did not clearly label that state as completion. The visible 1849 continuation failed with `prior_chapter_incomplete`.

The tester also received generated answers that were then labeled `대화 기록 실패 · dialogue_host_unavailable` after a speaker moved during the open conversation. The answer appeared, but its turn was not added to the journal.

## Changes

- Story completion now has an explicit `이야기 완료` heading and tells the player that the MAIN01 chapter has ended.
- The 1849 continuation now checks the MAIN01-scoped chapter requirements shown to the player. Unfinished MAIN03 and cholera quests no longer block the next year.
- Dialogue turns retain the nearby, visible conversation context captured when the player opened the conversation. If that resident walks away while the answer is generating, the valid reply is still recorded. Direct or unopened remote turns remain rejected.

## Verification

- `npm run check` completed successfully on the updated build.
- `npm run build:v33` passed; output contains 552 files.
- `scripts/v47-dialogue-open-context.test.mjs` passed.
- The MAIN01-scoped 1849 transition regression passed. It proves the full shared chapter rejects the move while the MAIN01-scoped chapter accepts it, and verifies the UI uses that same scoped chapter.
- Normal MAIN01 browser replay: 12/12 beats, nine characters, six maps, 17 transitions, zero page errors.
- Alternate MAIN01 browser replay: 12/12 beats, nine characters, six maps, 14 transitions, zero page errors.
- Both browser replays show the final ledger choice and a visible `1849년으로 이어가기` button. Their campaign JSON, progress logs, and screenshots are in `MAIN01_BETA_FIX_NORMAL_20261123/` and `MAIN01_BETA_FIX_ALTERNATE_20261123/`.

## Evidence limits

The independent tester's browser controls displayed screenshots but could not save them. The checked-in desktop screenshots and logs above come from separate deterministic browser replays of the same completed story routes.

An existing Chrome tab at `127.0.0.1:4173` showed a different 1847 tutorial state than the built MAIN01 replay. A listener on port 4173 was absent when checked, so that tab could not be tied to this checkout and was excluded from the code regression finding. The reproducible current-build runs use the checked-in `dist-v33` build.
