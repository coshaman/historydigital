# V28 Visual / UX Independent Re-review

검수일: 2026-10-05  
판정: **PASS — P0/P1 없음**

개발자 PASS를 복사하지 않고, 최신 evidence의 raw PNG와 최신 CSS/로그를 직접 대조했다.

## 직접 읽은 자료와 ID

- `narrative/VN_DIALOGUE_GRAPH.json`, `narrative/ENDING_DIALOGUES.json`, `narrative/CHARACTER_BIBLE.md`, `narrative/NARRATIVE_ARC_MATRIX.csv`
- `docs/v28/CANONICAL_TIMELINE_AUDIT.json` — `status: PASS`, `caseCount: 24`, `mismatches: []`
- `docs/v28/REPLAY_AUDIT.json` — `status: PASS`, live/replay의 C01 완료·choiceCounts·witness·memoryCallbacks·access·relationship·risk가 일치
- `docs/v28/ENDING_BROWSER_EVIDENCE.json` — 5개 expected/actual ending 일치, 모두 `pageErrors: []`
- `artifacts/v28-browser/V28_BROWSER_EVIDENCE.json` — 4 viewport × 4 state, 모두 `overflowFree: true`, `pageErrors: []`, `status: PASS`
- `styles.css`, `gold-runtime.js`, `scripts/v28-replay-audit.mjs`, `scripts/v28-ending-browser-evidence.mjs`

대화/케이스 ID: C01–C24 all-cases evidence를 대조하고, 최신 화면 표본에서 C01을 직접 재검수했다. 이전 문제 표본인 C07/C17/C24도 파일 상태를 확인했다. ending ID는 `DOSTOEVSKY_PETRASHEVSKY`, `HERZEN`, `BELINSKY`, `KHOMYAKOV`, `UVAROV`이다.

## 직접 연 최신 raw PNG

최신 2026-10-05 baseline:

- `desktop-1440x900-arrival.png`, `desktop-1440x900-choice-reaction.png`, `desktop-1440x900-evidence-ru-ko.png`, `desktop-1440x900-aftermath.png`
- `desktop-1366x768-arrival.png`, `desktop-1366x768-choice-reaction.png`, `desktop-1366x768-evidence-ru-ko.png`, `desktop-1366x768-aftermath.png`
- `mobile-390x844-arrival.png`, `mobile-390x844-choice-reaction.png`, `mobile-390x844-evidence-ru-ko.png`, `mobile-390x844-aftermath.png`
- `mobile-360x800-arrival.png`, `mobile-360x800-choice-reaction.png`, `mobile-360x800-evidence-ru-ko.png`, `mobile-360x800-aftermath.png`

최신 ending PNG:

- `endings/ending-DOSTOEVSKY_PETRASHEVSKY.png`, `endings/ending-herzen.png`, `endings/ending-belinsky.png`, `endings/ending-khomyakov.png`, `endings/ending-uvarov.png`

all-cases 표본으로 `all-cases/C01-arrival.png`, `all-cases/C07-arrival.png`, `all-cases/C24-arrival.png`도 직접 열었다. 이들은 선택 카드가 footer와 겹치지 않고 전체가 보인다.

주의: `desktop-1440-C01-arrival.png`, `desktop-1440-C07-reaction.png` 등 일부 루트 per-case PNG는 LastWriteTime이 2026-10-03으로, 최신 CSS보다 오래된 구형 캡처다. 구형 C07 이미지에는 이전 세로 화자명 결함이 여전히 보이지만, 이를 10월 4일 수정 후 실패 증거로 판정하지 않았다. 최신 evidence manifest가 참조하는 16개 baseline과 최신 all-cases/ending evidence를 최종 판정 대상으로 삼았다.

## 재현 절차

1. 최신 manifest의 PNG basename을 확인하고 raw PNG를 1440×900, 1366×768, 390×844, 360×800에서 직접 열었다.
2. C01 arrival의 3 choice card, choice/reaction, evidence RU/KO, aftermath를 비교했다.
3. C01/C07/C24 all-cases arrival과 5 ending overlay를 확인했다.
4. CSS 최종 override(`styles.css` 후반부)를 확인하고 replay/ending/timeline JSON과 script 실행 결과를 대조했다.

## 이전 P1 재판정

### P1-1 선택 카드 하단 clipping — 해결됨

최신 `desktop-1440x900-arrival.png`와 `desktop-1366x768-arrival.png`에서 세 choice card가 dialogue rail 안에 완전히 들어오며 카드 테두리와 문구 마지막 줄이 보인다. `mobile-390x844-arrival.png`와 `mobile-360x800-arrival.png`에서도 세 카드가 각각 독립된 박스로 화면 안에 있고 footer가 가리지 않는다. 최신 `all-cases/C01-arrival.png`, `C07-arrival.png`, `C24-arrival.png`도 동일하다.

코드 근거는 최종 `.v28-runtime .dialogue-strip`의 `min-height:260px`, `.v28-runtime .choice-area`의 `align-self:stretch/align-content:start/overflow:visible`, choice button `min-height:64px` 및 mobile `54px` 규칙이다. 최신 baseline은 이 수정의 실제 결과와 일치한다.

판정: **P1 해소.**

### P1-2 장문 화자명 세로 붕괴 — 해결됨

최신 `desktop-1440x900-choice-reaction.png`와 `desktop-1366x768-choice-reaction.png`에서 `알렉세이 오를로프`가 한 줄의 수평 라벨로 표시된다. 최신 evidence의 arrival/evidence/aftermath에서도 `기록의 목소리`가 수평으로 읽힌다. 모바일 PNG에서도 `알렉세이 오를로프`와 `기록의 목소리`가 수직 낙하 없이 표시된다.

최종 CSS는 speaker column을 `minmax(210px,230px)`로 넓히고 `white-space:nowrap`, `word-break:keep-all`, 적절한 font-size를 지정한다. 구형 10월 3일 per-case PNG에 남은 세로 이름은 stale artifact이며 최신 캡처의 실패로 볼 수 없다.

판정: **P1 해소.**

## P2 / 잔여 권고

- 모바일 360×800은 카드 폭이 좁고 한국어가 조밀하다. 최신 단일 열 수정 후 clipping은 해소됐으므로 잔여 가독성 여유만 P2 권고다.
- C01/C07/C24의 책상·종이·창문 구도는 반복된다. 기능적 overlap은 해결됐지만 상태별 focal variation은 약하다(P2).
- 200% text zoom의 별도 raw PNG는 여전히 없다. `index.html` viewport는 정상이고 기본 화면은 통과했지만, 확대 상태를 PASS로 증명한 것은 아니다(P2 검증 공백).
- 최신 evidence 기준 얼굴/종이/선택지의 P1급 overlap, RU/KO clipping, footer 가림은 확인되지 않았다. reduced-motion rule은 `styles.css`에 존재하며 transition/animation을 끈다.
- 구형 per-case PNG와 최신 baseline의 생성 시점이 섞여 있다. 다음 evidence reseal 때 stale PNG를 교체하거나 manifest에서 제외하는 것을 권고한다(P2 증거 위생).

## 추가 재검수 P1 재확인

### 모바일 choice card 하단 clipping — 해결됨

- 근거 PNG: `gold-slice/C01-arrival-1440x900.png`, `mobile-390x844-arrival.png`, `mobile-360x800-arrival.png`.
- 최신 `mobile-390x844-arrival.png`와 `mobile-360x800-arrival.png`에서 새 선택지 subcopy(듣는 사람·기록 방식·사무실 밖 전달 여부·즉각 위험)가 세 카드 모두에 표시되고, 각 카드의 마지막 문장까지 화면 안에 보인다.
- 최종 CSS의 mobile override는 `.v28-runtime .desk`를 `220px max-content`, `.dialogue-strip`을 `min-height:460px; max-height:none; overflow:visible`, `.choice-area`를 단일 열 grid로 설정한다. 카드 콘텐츠 높이를 고정 54px로 자르지 않는다.
- 재현: 390×844 및 360×800에서 C01 arrival을 열어 세 카드를 위에서 아래로 확인한다. footer 전에 카드 3개가 모두 종료되고 context가 잘리지 않는다.
- 판정: **P1 해소.**

## 최종 판정

**PASS — P0 없음, P1 없음.** 장문 화자명 세로 붕괴, desktop choice clipping, 새 subcopy로 인한 mobile 390×844/360×800 choice clipping이 모두 최신 raw PNG에서 해결됐다. 각 choice의 label·context·risk가 화면 안에 있으며, 최신 CSS가 이를 뒷받침한다. 200% 확대 검증과 오래된 per-case PNG 정리는 P2 권고로 남긴다.

## 2026-10-05 최종 증거 재확인

직접 다시 연 최신 PNG basename: `desktop-1440x900-arrival.png`, `desktop-1366x768-arrival.png`, `mobile-390x844-arrival.png`, `mobile-360x800-arrival.png` (모두 2026-10-05 생성). 네 화면에서 세 choice card의 label, 듣는 사람, 기록 방식, 사무실 밖 전달 여부, 즉각 위험 문구가 잘리지 않고 표시된다. 얼굴·종이·choice overlap, footer 가림, 화자명 붕괴는 P1 수준으로 재현되지 않았다.

추가로 `docs/v21/BROWSER_QA_V21.json`을 직접 읽었고 desktop/mobile 모두 `status: PASS`, `errors: []`, source transcription/translation 및 evidence action coverage를 확인했다.

최신 `gold-runtime.js`의 `renderGold`는 일반 gold/V21 경로에서 `document.body.classList.remove('v28-runtime')`를 수행한다. V28 전용 분기에서는 `renderV28Case`가 의도적으로 `gold-runtime v28-runtime`을 다시 부여해 V28 전용 choice/context CSS를 적용한다. 이는 일반 gold surface에 V28 스타일이 새는 문제를 막으면서 V28 화면에는 필요한 스타일을 유지하는 구조이며, 최신 PNG 결과와 일치한다.

최종 분리 상태: P0 없음, P1 없음, **200% text zoom은 P2 미검증**으로 유지한다. 인간 플레이테스트는 자동/시각 증거와 별개로 **PENDING**이며, 이를 시각 PASS로 간주하지 않는다.

## 2026-10-05 증분 갱신 최종 확인

새로 직접 연 raw PNG basename: 최신 `desktop-1440x900-arrival.png`, `desktop-1366x768-arrival.png`, `mobile-390x844-arrival.png`, `mobile-360x800-arrival.png`; `all-cases/C01-arrival.png`, `all-cases/C07-arrival.png`, `all-cases/C24-arrival.png`; `endings/ending-DOSTOEVSKY_PETRASHEVSKY.png`, `ending-herzen.png`, `ending-belinsky.png`, `ending-khomyakov.png`, `ending-uvarov.png`.

네 viewport에서 choice card와 speaker label은 잘리지 않고, C01/C07/C24 representative에서도 세 choice card의 label/context/risk가 footer에 가려지지 않는다. 5개 ending overlay는 제목, 판정 대화, 기억 인물, `새 문서 열기` CTA가 모두 화면 안에 있다. P0/P1 시각 결함은 재현되지 않았다.

증분 excerpt-read 경로도 소스에서 재확인했다. `v28Inspect()`가 evidence를 열고 `v28AfterEvidence()`가 `V28_DOCUMENT_READ`와 read excerpt IDs를 남긴 뒤 다음 단계로 진행한다. `styles.css`의 최신 mobile rule은 V28 dialogue를 `max-content` 기반으로 만들고 choice area를 단일 열·`overflow:visible`로 유지한다. 따라서 이번 변경에서 새 P1은 없다.

최종 판정: **PASS — P0 없음, P1 없음.** 200% 확대는 여전히 P2 미검증이고, 인간 플레이테스트는 별도 **PENDING**이다.

## 2026-10-05 C03-A / final-main20 최종 재검수

이번 판정은 직전 PASS 선언을 복사하지 않고, C03-A reactionActor 수정 후 생성된 raw PNG와 현재 런타임/CSS를 다시 대조한 결과다.

### 다시 읽은 자료

- `docs/v38/V38_BROWSER_EVIDENCE.json` — C03, `phase: reading`, choiceTexts/contextTexts 3개/2개, `failures: []`
- `docs/v30/MAIN20_BROWSER_EVIDENCE.json` — 1440×900/390×844 window state, reaction, restored state 및 5 ending smoke 결과
- `main20-runtime.js` — `renderChoice()`의 3 choice, `renderReaction()`의 `choice.reactionActor || choice.actor`, `renderPostChoice()`/`renderFinalReaction()`의 actor 적용
- `styles.css` — `.main20-mode .choice-area` 3열 데스크톱 및 모바일 단일열 규칙

### 실제로 다시 연 PNG basename

- `artifacts/final-main20/C03-A-reaction-1440x900.png`
- `artifacts/final-main20/desktop-1440x900-03-first-choice-directions.png`
- `artifacts/final-main20/desktop-1440x900-04-window-open.png`
- `artifacts/final-main20/desktop-1440x900-05-window-restored.png`
- `artifacts/final-main20/desktop-1366x768-03-first-choice-directions.png`
- `artifacts/final-main20/desktop-1366x768-04-window-open.png`
- `artifacts/final-main20/desktop-1366x768-05-window-restored.png`
- `artifacts/final-main20/mobile-390x844-03-first-choice-directions.png`
- `artifacts/final-main20/mobile-390x844-04-window-open.png`
- `artifacts/final-main20/mobile-390x844-05-window-restored.png`
- `artifacts/final-main20/mobile-360x800-03-first-choice-directions.png`
- `artifacts/final-main20/mobile-360x800-04-window-open.png`
- `artifacts/final-main20/mobile-360x800-05-window-restored.png`
- `artifacts/v28-browser/desktop-1440x900-choice-reaction.png`
- `artifacts/v28-browser/mobile-390x844-choice-reaction.png`

### 재현 및 판정

재현 절차: C03에서 첫 질문까지 진행 → choice state를 1440×900, 1366×768, 390×844, 360×800으로 캡처 → 창 열기 → 창 닫기/복귀 → reaction 캡처를 확인했다.

- C03-A reaction label: **해결됨.** `C03-A-reaction-1440x900.png`에서 `알렉세이 오를로프`가 수평 한 줄로 읽히고 reaction 본문/하단 진행 버튼과 겹치지 않는다. V28 choice-reaction desktop/mobile에서도 같은 actor label이 수평으로 읽힌다.
- 창 왕복: **해결됨.** desktop/mobile `04-window-open`은 중앙 창과 “창문을 다시 누르거나 Esc로 책상으로 돌아갑니다” 안내를 분리해 보여 주며, `05-window-restored`에서 책상/대화가 복귀한다. P0는 재현되지 않았다.
- **P1-NEW: main20 choice 영역 viewport clipping.** `desktop-1440x900-03-first-choice-directions.png`와 `desktop-1366x768-03-first-choice-directions.png`에서 “답의 방향 · 3가지”가 있는 상태지만 화면 안에 완전한 카드가 두 개만 보이고 카드 하단/세 번째 선택지가 footer 아래로 잘린다. `desktop-1440x900-05-window-restored.png`에서도 동일하다.
- **P1-NEW: mobile choice completeness/readability.** `mobile-390x844-03-first-choice-directions.png`에서는 세 번째 카드가 화면 하단에 걸려 마지막 문장이 잘리고, `mobile-360x800-03-first-choice-directions.png`에서는 첫 두 카드만 보이며 세 번째 카드가 viewport 밖이다. `mobile-360x800-05-window-restored.png`에서도 동일해 창 왕복 후에도 핵심 선택지 전체에 접근할 수 없다. 이는 좁은 폭에서 조밀하다는 P2 수준이 아니라, 선택지 하나가 보이지 않는 기능적 P1이다.

## 현재 최종 판정

- **P0: 없음.** 얼굴/종이/창 자체의 치명적 겹침, reaction speaker 오표기, 창 왕복 중 앱 비가시 상태는 재현되지 않았다.
- **P1: 있음 — choice card 전체 노출/가독성 실패 1건(4 viewport에서 desktop 및 mobile 증상).** 세 선택지를 모두 viewport 안에 보여 주고 마지막 문장까지 읽게 하는 조건을 만족하지 않는다.
- **P2: 200% text zoom raw 증거 부재, reduced-motion/실사용 수동 검증 공백.** 이번 P1과 별개로 유지한다.

최종: **FAIL — P1 잔존.** C03-A reactionActor와 window round-trip은 통과했지만, 최신 final-main20 raw PNG가 choice layout clipping을 직접 증명하므로 V28 visual/UX PASS로 종료할 수 없다.

## 2026-10-05 최신 CSS 재검수 — main20 choice rail

최신 CSS 수정(`MAIN20 dialogue rail 330px`, mobile document row 260px, choice progress full-column) 후 생성된 다음 raw PNG를 다시 직접 열었다.

- `desktop-1440x900-03-first-choice-directions.png`
- `desktop-1366x768-03-first-choice-directions.png`
- `mobile-390x844-03-first-choice-directions.png`
- `mobile-360x800-03-first-choice-directions.png`

### P0/P1 재판정

- 1440×900: 세 choice card가 한 행에 모두 보이고 카드 테두리와 문장 끝까지 노출됨 — **P1 해소**.
- 390×844: 세 card가 단일 열로 모두 보이고 마지막 card의 하단 테두리까지 viewport 안에 있음 — **P1 해소**.
- 360×800: 세 card가 단일 열로 모두 보이고 footer에 가려지지 않음 — **P1 해소**.
- 1366×768: 세 card의 상단과 본문은 보이지만, 화면 하단 footer가 카드 하단을 덮어 세 card의 하단 테두리/마지막 줄이 완전히 보이지 않음. `choice progress full-column`은 해결됐으나 높이 부족 상태가 남아 있음 — **P1 잔존**.

P0는 새 PNG에서 재현되지 않았다. 따라서 최신 수정은 모바일과 1440 데스크톱의 이전 P1을 해소했지만, 1366×768의 choice card clipping 때문에 최종 판정은 여전히 **FAIL — P1 1건 잔존**이다.

## 2026-10-05 최종 독립 재검수 — 최신 choice PNG

이전 FAIL 판정 이후 생성된 최신 raw PNG 네 장을 다시 직접 열었다.

- `desktop-1440x900-03-first-choice-directions.png`
- `desktop-1366x768-03-first-choice-directions.png`
- `mobile-390x844-03-first-choice-directions.png`
- `mobile-360x800-03-first-choice-directions.png`

네 viewport 모두 `답의 방향 · 3가지`와 세 choice card가 footer 위에 완전히 노출된다. 각 card의 즉시 방향 메타데이터와 마지막 문장, 하단 테두리가 보이며 footer와 겹치거나 잘리지 않는다. 1366×768에서도 이전과 달리 카드 하단과 세 번째 card가 footer 위에서 종료된다.

- **P0: 0건** — 치명적 overlap/비가시 상태 없음.
- **P1: 0건** — choice card 및 immediate-direction metadata clipping 없음.

최종 판정: **PASS — P0/P1 없음.**

## 2026-10-05 200% 확대 최종 독립 재검수

새 headed 200% evidence를 자동 PASS 문구와 분리해 raw PNG로 직접 확인했다.

직접 연 파일:

- `artifacts/v28-browser/zoom-200p/desktop-1366x768-200p-choice.png`
- `artifacts/v28-browser/zoom-200p/mobile-390x844-200p-choice.png`
- `artifacts/v28-browser/zoom-200p/desktop-1366x768-200p-reaction.png`
- `artifacts/v28-browser/zoom-200p/mobile-390x844-200p-reaction.png`
- 비교 reaction: `artifacts/v28-browser/desktop-1366x768-choice-reaction.png`, `artifacts/v28-browser/mobile-390x844-choice-reaction.png`

choice 화면에서는 세 card가 모두 세로로 접근 가능하고, 각 card의 선택 문장·`듣는 사람`·기록 방식·사무실 밖 전달 여부·위험 메타데이터가 읽힌다. 모바일 390×844 200% 캡처는 긴 페이지로 확장되어 세 card가 모두 아래로 이어지며, footer가 card를 덮지 않는다. desktop 1366×768 200%에서도 세 card가 footer 위에 종료된다. JSON의 실제 상태도 두 viewport 모두 `choiceCount: 3`, `clippedChoices: 0`, `scrollWidth === viewport width`, `overflowFree: true`로 기록되어 있으며, 이는 PNG에서 확인한 결과와 일치한다.

reaction 200% desktop/mobile에서도 화자명과 reaction 문장이 줄바꿈되어 읽히고, action button이 화면 안에서 도달 가능하다. 모바일 footer 텍스트는 확대 때문에 여러 줄로 재배치되지만 choice/reaction 본문을 가리거나 가로 스크롤을 만들지 않는다.

- **P0: 0건** — 확대 상태의 치명적 비가시/겹침 없음.
- **P1: 0건** — 세 choice와 즉시 방향 메타데이터의 clipping·footer obstruction·horizontal clipping 없음.

최종 판정: **PASS — 200% 확대에서도 P0/P1 없음.**

## 2026-10-05 200% 확대 증거 보강

`npm run v28-200p-zoom-evidence`를 headed Chromium에서 실행하고 다음 raw PNG를 직접 열었다.

- `artifacts/v28-browser/zoom-200p/desktop-1366x768-200p-choice.png`
- `artifacts/v28-browser/zoom-200p/mobile-390x844-200p-choice.png`
- 각 viewport의 arrival/reaction PNG

200% 유효 viewport에서 문서 폭은 가로 overflow 없이 유지되고, 선택지 3개와 즉시 방향 메타데이터가 세로 스크롤로 모두 접근된다. headed report는 `pageErrors: []`, `status: PASS`, `overflowFree: true`를 기록했다. 확대 전용 `max-height:500px` 규칙은 일반 모바일 viewport에 적용되지 않는다.

판정: **P2 V28-200P-TEXT-ZOOM 해소.**
