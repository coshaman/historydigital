# V28 Historical / State Independent Review — Latest Recheck

검수일: 2026-10-04  
판정: **PASS** (P0 0 / P1 0)

## 직접 대조한 자료

- `narrative/VN_DIALOGUE_GRAPH.json`
- `data/v27-case-bundle.json`
- `docs/v28/ACTIVE_CONTRACT_AUDIT.json`
- `docs/v28/REPLAY_AUDIT.json`
- `docs/v28/ENDING_BROWSER_EVIDENCE.json`
- `gold-runtime.js`, `scripts/v28-active-contract-audit.mjs`, `scripts/v28-replay-audit.mjs`, `scripts/v28-ending-browser-evidence.mjs`

C01–C24 전체 graph, 72 choices, 120 bundle excerpts, 5 endings를 독립 대조했다. ending raw PNG도 직접 확인했다: `ending-dostoevsky_petrashevsky.png`, `ending-herzen.png`, `ending-belinsky.png`, `ending-khomyakov.png`, `ending-uvarov.png`.

## 검증 결과

### 72 choices의 audience / record / risk 방향

독립 스크립트로 72개 choice를 전수 검사했다.

- 각 case는 정확히 3 choices, 모두 `actionChannel: SPOKEN`
- choice 1/2/3의 `revealsTo`와 trust 대상은 각각 Alexei/Ekaterina/Pavel로 일치
- choice 1/2/3의 access record는 각각 `officialRecord`/`dossierEvidence`/`crossBorder`로 일치
- 72개 `edgeTo`는 실제 reaction node를 가리키고 reaction actor가 해당 audience와 일치
- runtime risk delta는 choice 1/2/3에 대해 0/0.25/1이며, `v28ChoiceContext()`의 공식 기록/사건철/전달 경로 및 risk 문구와 모순되지 않는다
- `replayV28Actions()`는 spoken choice의 witness/access/relationship/risk snapshot을 재구성한다

검사 결과: choice mapping issues **0건**.

### source context / provenance

`data/v27-case-bundle.json`의 24 case, 120 excerpts를 직접 검사했다. 모든 excerpt에 `excerptId`, `sourceId`, `locator`, `context`, RU 원문, KO 대응문이 있고, 각 sourceId가 해당 case의 sources에 존재한다. graph의 64 historicalClaims도 bundle source/excerpt에 모두 resolve된다.

`ACTIVE_CONTRACT_AUDIT.json`은 `PASS`, 24 cases, 72 choices, 120 excerpts, `literaryBorrowings: 0`이다. runtime에는 `v28-source-context`와 `v28ChoiceContext`가 실제 렌더링된다. source-first 및 literary borrowing 분리는 유지된다.

### 날짜·witness·ending 인과

최신 `ENDING_BROWSER_EVIDENCE.json`은 5개 route 모두 expectedEnding=actualEnding, pageErrors 0이다. raw PNG의 기억된 인물은 다음 required witness와 일치한다.

- DOSTOEVSKY_PETRASHEVSKY: Alexei + Pavel
- HERZEN: Ekaterina + Pavel
- KHOMYAKOV: Alexei + Ekaterina
- BELINSKY: Ekaterina + Pavel
- UVAROV: Alexei + Ekaterina + Pavel

choice counts, access channel, relationship totals, witnessedCharacters가 각 ending 조건을 함께 충족한다. C19→C02 역행 edge도 확인되지 않았다.

### replay

`npm run v28-replay-audit`의 최신 로그와 `docs/v28/REPLAY_AUDIT.json`은 모두 `status: PASS`, `errors: []`이다. live/replay의 completed cases, counts, witnesses, callbacks, access, relationships, risk, routed/read documents가 일치한다.

## 최종 P 판정

- **P0: 없음**
- **P1: 없음**

이전 P1이었던 chronology/choice semantics, ending witness mismatch, replay 부재는 최신 graph, bundle, runtime, audit, ending evidence에서 재현되지 않았다. 자동 PASS 문자열을 복사하지 않고 72 choices와 120 excerpts를 독립 전수 확인한 결과다.

## Final-source recheck addendum

최종 fresh 자료도 직접 대조했다: `narrative/VN_DIALOGUE_GRAPH.json`, `narrative/MAIN_20MIN_DIALOGUE.json`, `docs/v28/ACTIVE_CONTRACT_AUDIT.json`, `artifacts/v28-browser/V28_BROWSER_EVIDENCE.json`, `docs/v28/ALL_CASES_BROWSER_EVIDENCE.json`, `docs/v28/ENDING_BROWSER_EVIDENCE.json`, `docs/v28/REPLAY_AUDIT.json`, `docs/v28/CANONICAL_TIMELINE_AUDIT.json`.

`MAIN_20MIN_DIALOGUE.json`의 5 scenes/16 choices는 모두 `choiceImmediateDirections`의 audience·recordMode·leavesOffice·risk를 갖고, 13 excerpts는 sourceId·locator·RU/KO·context 및 sourceContextRanges를 모두 갖는다. `literaryBorrowings`는 빈 배열이다. fresh viewport evidence는 1440×900, 1366×768, 390×844, 360×800 모두 `overflowFree: true`, pageErrors 0, status PASS다. 24 case browser chronology와 5 ending route도 PASS이며, raw `mobile-390x844-choice-reaction.png`, `desktop-1440x900-choice-reaction.png`, `ending-belinsky.png`에서 해당 상태를 직접 확인했다.

최종 재검수에서도 **P0 0 / P1 0**을 유지한다.

## 2026-10-05 final evidence addendum

최신 fresh evidence를 다시 열었다: `artifacts/v28-browser/V28_BROWSER_EVIDENCE.json`은 4 viewport 모두 `overflowFree: true`, `pageErrors: []`, `status: PASS`; `docs/v28/ALL_CASES_BROWSER_EVIDENCE.json`은 24/24 title/date/choiceCount 및 chronological PASS; `docs/v28/ENDING_BROWSER_EVIDENCE.json`은 5/5 expected/actual ending 일치; `docs/v28/REPLAY_AUDIT.json`과 `docs/v28/SAVE_RELOAD.json`은 각각 PASS다. `CANONICAL_TIMELINE_AUDIT.json`도 24 cases, mismatches 0이다.

최신 `gold-runtime.js`의 `renderGold()`는 V28 진입 시 `v28-runtime`을 부여하고 legacy 경로 전환 시 `v28-runtime`과 `gold-choice-phase`를 제거한다. 이 클래스 수명주기는 V28 state routing과 모순되지 않는다. source-context renderer, graph choice/reaction edges, 24-case chronology, 5-ending witness state를 재확인했으며 P0/P1은 발견하지 못했다.

인간 30–60분 플레이테스트는 `docs/v28/HUMAN_PLAYTEST_STATUS.md`대로 **PENDING**으로 유지한다. 200% raw PNG도 `docs/v28/TEXT_ZOOM_BROWSER_CHECK.md`가 명시한 대로 보존된 raw capture가 없으므로 미완료로 유지한다. 이는 이번 historical/state P0/P1 판정을 PASS로 바꾸지는 않지만 전체 release 완료와 혼동하지 않는다.

## 2026-10-05 latest independent audit addendum

이번 재검수에서 개발자 PASS 문자열을 근거로 사용하지 않고 다음 최신 파일을 다시 직접 읽었다: `narrative/VN_DIALOGUE_GRAPH.json`, `data/v27-case-bundle.json`, `docs/v28/ACTIVE_CONTRACT_AUDIT.json`, `docs/v28/REPLAY_AUDIT.json`, `docs/v28/SAVE_RELOAD.json`, `docs/v28/CANONICAL_TIMELINE_AUDIT.json`, `docs/v28/ALL_CASES_BROWSER_EVIDENCE.json`, `docs/v28/ENDING_BROWSER_EVIDENCE.json`, `artifacts/v28-browser/V28_BROWSER_EVIDENCE.json`, 최신 `gold-runtime.js`.

독립 전수 대조 결과: C01–C24 **24 cases**, **72 choices**, **64 historical claims**, **120 excerpts**, **5 endings**. Node 검사에서 case별 3 choices, 날짜와 graph dateRange, 모든 `edgeTo` resolve, reaction actor와 `revealsTo` 일치, SPOKEN channel, choice 1/2/3의 Alexei/Ekaterina/Pavel witness 및 officialRecord/dossierEvidence/crossBorder mapping, 모든 claim/excerpt provenance resolve를 확인했고 issues는 0건이었다.

실제 raw PNG도 다시 열었다: `artifacts/v28-browser/all-cases/C03-arrival.png`, `artifacts/v28-browser/all-cases/C24-arrival.png`, `artifacts/v28-browser/endings/ending-DOSTOEVSKY_PETRASHEVSKY.png`, `artifacts/v28-browser/endings/ending-uvarov.png`. C03는 1837-03, C24는 1849-12-22로 표시되며, ending PNG의 기억된 witness가 evidence의 DOSTOEVSKY=Alexei+Pavel, UVAROV=Alexei+Ekaterina+Pavel과 일치한다. 나머지 ending route도 evidence에서 expectedEnding=actualEnding 및 pageErrors 0을 확인했다.

`REPLAY_AUDIT.json`은 `status: PASS`, `errors: []`이며 live/replay의 completed cases, choice counts, witnesses, memory callback, access, relationships, risk, routed/read documents가 일치한다. `SAVE_RELOAD.json`도 reaction phase resume과 pageErrors 0을 확인한다. 따라서 chronology, choice semantics, provenance, ending witness causality, replay/save 상태에서 이전 P1의 재발은 확인되지 않았다.

## 최종 판정

- **P0: 0건**
- **P1: 0건**
- **P2: 이번 historical/state 범위에서 신규 없음**
- **판정: PASS**

인간 30–60분 플레이테스트와 200% text-zoom의 보존된 raw capture는 기존 기록대로 아직 PENDING/미완료이며, 이는 이번 historical/state P0/P1 판정과 별개다.

## 2026-10-05 C03-A post-fix recheck

`narrative/MAIN_20MIN_DIALOGUE.json`, `docs/v28/ACTIVE_CONTRACT_AUDIT.json`, `docs/v38/V38_BROWSER_EVIDENCE.json`, 그리고 실제 `artifacts/final-main20/C03-A-reaction-1440x900.png` 및 `artifacts/v38-browser/desktop-choice-direction.png`를 다시 직접 대조했다. C03-A의 화면 reaction speaker는 **알렉세이 오를로프**이고, canonical JSON의 `reactionActor: "alexei"`, 관계 변화 `alexei: 1`, `public_citation` 및 `C03-R1,C03-R2` provenance와 일치한다. PNG에는 1837년 1월 31일, C03, 수정된 반응 문장 “좋아. 원인은 아직 비워 두자...”가 실제로 표시된다.

MAIN20 독립 검사 결과는 C03→C06→C07→E02→E07, 16 choices, 13 excerpts, `literaryBorrowings: []`, issues 0건이다. 모든 choice에 reactionActor·semantic이 있고, 선택 excerpt가 장면 내 provenance에 resolve되며, excerpt의 RU/KO·locator·context와 availableDate 경계가 유지된다. V38 browser evidence는 desktop/mobile choice와 contiguous-context PNG 4개, failures 0건이다.

이 변경은 V28 graph의 24 cases/72 choices 및 5 ending invariant와 충돌하지 않는다. 최신 active-contract는 24/72/120 및 literaryBorrowings 0을 유지한다.

### 최종 판정

- **P0: 0건**
- **P1: 0건**
- **P2: 신규 없음**
- **판정: PASS**
