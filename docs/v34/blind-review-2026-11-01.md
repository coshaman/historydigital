# V34 blind onboarding and quest guidance review

Date: 2026-11-01

Origin: local app at `http://127.0.0.1:4188/`
Method: two fresh Chromium contexts, browser-rendered text and ordinary keyboard/touch-button controls only. Each context started with empty browser storage. `/api/rpg/*` was intercepted and aborted; no provider request was made.

## Run A — desktop, 1366 × 768

1. Fresh start showed the observer identity, quest title “교정쇄의 행선지,” a named target (안나), reason, and a concrete route: 오른쪽 1칸 → 위 2칸 → 왼쪽 3칸, then E. The tutorial separately prompted approaching someone. The directions were sufficiently explicit to follow without interpreting the map art.
2. Pressed J. The journal opened on the goal tab and repeated the target, reason, route, location, and progress. Inventory, people, sources, and history tabs all switched; Escape closed it. Before possession, some sections were empty, but the journal stated that no items/records were present.
3. Following the displayed route and pressing E opened 안나’s inspection; “몸을 빌린다” was visible and possession succeeded. The tracker immediately changed identity and replaced `0 / 3` with `0 / 1`.
4. The new task named the “신문 가판대,” said why it mattered, and said E was available nearby. E opened a source view titled “호리와 칼리니치,” with an explicit “원문과 번역 펼치기” action. Selecting it revealed the source text and updated the next task to reaching the printshop exit.

## Run B — mobile/touch, 390 × 844

1. Started again in a fresh context. Used the on-screen arrow buttons to follow the same route, then “살펴보기”; the named Anna target was reached and possession worked.
2. Used the on-screen “살펴보기” button at the newspaper stand and selected “원문과 번역 펼치기.” The task changed to an exit route: 오른쪽 15칸 → 위 5칸. Following it with the touch pad and pressing “살펴보기” transitioned into the printshop. The transition briefly showed “문을 나서다” with no action buttons; the tracker then gave the next target, “교정쇄가 놓인 작업대,” and its two-step route.
3. Followed the short route and inspected the workbench. The consequential action was visible with useful immediate subcopy: a coworker could see it, it would remain in a comparison memo rather than the official ledger, and retaining the copy would delay the decision.
4. “가까이서 말하기” was enabled. Opening it displayed a contextual Anna line and an always-visible text input. The intercepted session-start request failed closed; the UI stated it was offline and kept prepared replies/input available. Submitting “오늘은 어떤 일이 바쁘세요?” produced the bounded fallback “그건 내가 직접 본 일이 아니에요.” The input remained available. The browser intercepted both session-start attempts; no `/api/rpg/dialogue` or external provider call completed.

## Findings

- **Reachability:** The first target and the tested first quest path were reachable by both keyboard and mobile touch controls. The displayed walk directions matched the actual route through the map and into the printshop. The objective pin was not needed to infer the route.
- **Journal:** J, all five tabs, and Escape worked. Goal information was actionable; inventory and empty-state text were understandable. The journal did not interrupt or reset the current goal.
- **Possession and dialogue:** Inspection exposed the possession action. After possession, the tracker gave a source task. At the workbench, talking and typed fallback both remained available with network calls blocked.
- **Ambiguity / polish:** The progress label changes from `0 / 3` to `0 / 1` immediately after possessing Anna, without explaining the scope change; this can look like lost progress. Reading the newspaper requires two distinct actions (E, then “원문과 번역 펼치기”), although the tracker only says “읽으세요.” The printshop transition has a brief blank-action screen, but the tracker updates to a clear next step. The label `「신문 가판대」을 읽으세요` has an awkward particle; `「신문 가판대」를 읽으세요` reads naturally.
- **Coverage limit:** These were first-run onboarding and first-quest journeys through the printshop decision prompt, not a full campaign or ending playthrough. No edits or game-state injection were used.

## Follow-up fixes and verification

- Progress now stays scoped to the active quest’s authored actions, so possession does not change the displayed denominator from 3 to 1.
- The source instruction now explicitly names both physical steps: press E at the document, then select its reading action. The target label uses a natural location construction.
- Existing browser automation was updated to use the visible five-tab journal instead of the intentionally hidden legacy host notebook, and to assert against the current dialogue line rather than a duplicated transcript entry.
- Rechecked by the V34 browser journey, focused quest guidance tests, and the V33 acceptance suite. The printshop door can still show a brief transition state between maps; the mission tracker immediately gives the next action on the destination map.
