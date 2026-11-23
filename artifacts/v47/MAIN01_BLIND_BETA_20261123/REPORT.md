# MAIN01 blind beta — 2026-11-23

## Result
- Fresh run at `http://localhost:4173/`; selected **Forbidden Illustrated Almanac** from the historical-event menu.
- Followed the event from 1848-02-12 to the final ledger choice on 1848-12-12. The notebook then changed to **Printed Almanac Afterstory** and said the choice had left its mark. This is an in-story ending, though no dedicated ending screen/card appeared.
- Tried **1849 onward**. The visible button was blocked with `prior_chapter_incomplete`; this was the stopping point.
- Ending choice: preserve one copy secretly and pay Stefan’s wages first; subscribers still wait for refunds.

## Play steps
1. Opened the historical-event menu and chose **금지된 삽화 연감 · 지금 시작**.
2. Followed exact grid directions to Lev at the bookshop and checked the subscriber ledger; advanced to Mar 9.
3. Traversed to the print shop; completed the 21-character typesetting task, chose careful proofing, dry paper, subscriber notice, dispatch hold, worker proof, and preserved the unbound copy. Compared proof and type count; advanced to Apr 28.
4. At the bookstore, returned part of Anna’s deposit; advanced to May 18. Read and recorded the cited *Talnikov Family* source, then chose to read the copy together after work; advanced to Jul 22.
5. Paid Stefan’s wages first; advanced to Sep 18. Read and recorded Panayev’s authorization letter and Krylov’s review. Chose to record the scene the report objected to; advanced to Nov 1.
6. Took Ekaterina’s perspective, entered the print shop, and reconciled bundled copies against the order ledger; advanced to Nov 2.
7. Took Anna’s perspective, followed her lodging-yard quest, and claimed the unpaid mending fee; advanced to Nov 6.
8. Took Lev’s perspective, examined the damp sealed parcel, and returned it to the bookshop; advanced to Nov 29.
9. Refunded subscribers rather than promising delivery; advanced to Dec 6. Took Darya’s perspective, reached Sofia’s salon, and held a small reading circle; advanced to Dec 12.
10. At the final ledger, chose to hide one copy and pay Stefan. The notebook moved to the afterstory. The 1849 transition remained blocked as noted above.

## Findings
- **Quest clarity:** Strong navigation guidance. The notebook consistently gave a destination, role, task, and exact grid movement. The roster’s “current quest target” label helped. The “go to,” “talk to,” and “take their perspective” actions were not obvious at first; trying to talk at a distance returned “no one nearby.” One initial route led back to the alley, but the next exact route resolved it.
- **Dialogue goals:** The board clearly gives the exact question, target, two-perspective requirement, and notebook follow-up. The board stayed at 0/2 during the main story; completing it was not required to continue, and I did not finish the two-person notebook conclusions.
- **Typed response:** After the event, typed the board’s exact first question to Stefan. He gave a relevant answer about needing the objection identified and the proof shown. The board stayed at 0/2 because it names Ekaterina as the target. The UI then showed `대화 기록 실패 · dialogue_host_unavailable` despite displaying the generated answer and follow-up choices. The same visible failure appeared after an earlier coherent Avdotya response.
- **Story coherence:** The dated chain links proofreading/censorship to workers’ wages, returns, subscriber refunds, and the risk of preserving a copy. Ledger changes show money, objects, trust, and delayed obligations. Historical events are framed through evidence and review rather than changing documented outcomes.
- **Presentation and assets:** Warm pixel-art rooms and paper/ink styling suit the premise. Source readers showed original text, Korean translation, dates, citations, and disclosed when an archival image was not checked. The desktop layout was readable; the discussion board can feel dense because it repeats context and instructions.
- **End-state issue:** The notebook feels conclusive, but the 1849 transition says `prior_chapter_incomplete` without naming a prerequisite. No explicit ending label confirms whether this is intended closure or an incomplete chapter.

## Stop and screenshots
At 1848-12-12 06:21 in the Nevsky print shop, after the final ledger choice; notebook shows **Printed Almanac Afterstory**. I tried the 1849 transition and observed `prior_chapter_incomplete`. I captured browser screenshots during play, but the available browser UI tool only displayed them and provided no way to save image files into this folder, so no screenshot files are attached.
