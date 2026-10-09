# Historical / State-Machine Independent Review — final

검수일: 2026-10-04  
대상: 최신 canonical `narrative/MAIN_20MIN_DIALOGUE.json`, `main20-runtime.js`, `styles.css`, audit 출력, 새 V38 PNG

## 최종 판정

**PASS — P0 0건, P1 0건, P2 1건.**

### C06 callback — PASS

JSON을 직접 확인한 결과 `C03.memoryCallbacks`는 null/0개이고 `C06.memoryCallbacks`는 1개다. C06 callback은 `actionsAny: public_citation, preserve_public_grief, trace_print_route`, `relevanceScenes: ["C06"]`를 갖는다. 이는 C03의 세 initial choice action을 모두 회수한다.

`main20-runtime.js`의 `renderIntro → memoryLine(current) → selectMemoryCallbacks(current)` 경로는 현재 scene의 callback만 순회한다. 따라서 C03 선택 history가 있으면 C06 intro에서 해당 Alexei callback이 선택된다. 이전 owner 오배치 P1은 해소됐다.

### Alexei callback register — PASS

C06/C07/E02/E07 Alexei callback을 모두 직접 읽었다. 문장 종결은 각각 `-습니다/-겠습니다`, `-습니다/-군요`, `-군요`, `-습니다/-군요` 계열로 정리되어 이전의 `...는군`, `...보이는군` 혼용이 제거됐다. E07-B도 `나눴군요`, `있습니다`로 일치한다.

### C07-C reaction — PASS

`reaction`과 `reactionSequence[0]`이 모두 `유보는 회피가 아니군요.`로 일치한다. runtime은 sequence를 우선 렌더링하므로 실제 화면의 Alexei 문장도 동일하다.

### 모바일 390×844 — PASS

새 `mobile-choice-direction.png`를 직접 확인했다. C03 표기가 보이고, 세 choice card가 모두 화면 안에서 제목과 알림·기록·이동·위험 meta를 읽을 수 있다. 세 번째 카드도 footer에 가려지거나 잘리지 않는다. `styles.css`의 단일 열/스크롤 규칙과 runtime의 별도 direction span이 이에 부합한다.

### source-first / chronology — PASS

C03→C06→C07→E02→E07 순서, RU/KO provenance, later-document 차단, 빈 `literaryBorrowings`, 32개 choice direction 계약은 유지된다. 실제 역사적 결과와 가상 서기의 선택 경계도 유지된다.

## P2 — V37 legacy mismatch 재현성 권고

`ENDING_SEMANTIC_EXHAUSTIVE.json`의 semanticMismatch/noEnding/multiEnding/unresolved tie/array-order fallback은 0이지만 `legacyMismatchRoutes`는 12개이고 저장소 script의 보존 한도/PASS 기대치는 11개다. set-wise ending semantics의 P1 실패는 아니지만 동일 script·동일 산출물 재생성이 필요하다.

| 등급 | 건수 | 판정 |
|---|---:|---|
| P0 | 0 | 치명적 경로 차단/역사적 결과 변경 없음 |
| P1 | 0 | 잔존 P1 없음 |
| P2 | 1 | V37 legacy mismatch 집계 재현성 불일치 |

**최종: PASS (P2 권고 포함).**

## 2026-10-05 C03-A post-fix independent recheck

최신 `narrative/MAIN_20MIN_DIALOGUE.json`, `docs/v28/ACTIVE_CONTRACT_AUDIT.json`, `docs/v38/V38_BROWSER_EVIDENCE.json`와 raw PNG `artifacts/final-main20/C03-A-reaction-1440x900.png`, `artifacts/v38-browser/desktop-choice-direction.png`를 직접 확인했다. C03-A reaction은 PNG와 JSON 모두 Alexei Orlov (`reactionActor: alexei`)이며, 1837-01-31 C03 날짜, C03-R1/C03-R2 선택 provenance, `public_citation`, alexei 관계 +1이 일치한다.

독립 검사 결과 MAIN20은 C03→C06→C07→E02→E07, 16 choices, 13 excerpts, `literaryBorrowings: []`, issues 0건이다. 모든 choice의 reactionActor/semantic과 excerpt resolve를 확인했고, RU/KO·locator·context 및 availableDate chronology 경계가 보존된다. V38 evidence의 desktop/mobile choice 및 contiguous-context 4 PNG는 failures 0건이다. V28 active contract의 24 cases/72 choices/120 excerpts와 ending invariant도 변경되지 않았다.

### 최종 재판정

- **P0: 0건**
- **P1: 0건**
- **P2: 신규 없음**
- **판정: PASS**
