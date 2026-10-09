# Russian Lives: Act III — V38 추가 요구사항 검증 보고서

## 결론

추가 HARD REQUIREMENTS 13–16을 현재 canonical main route에 반영했다. 기존 V37의 장면 순서, 선택 효과, 저장/불러오기, 다섯 엔딩 판정은 변경하지 않았다. 독립 최종 재검수에서 `C03.memoryCallbacks=0`, `C06.memoryCallbacks=1`과 C03 선택 history 회수, Alexei callback register 통일을 확인했으므로 전체 품질 판정은 **PASS**다. V37 legacy mismatch 집계 재현성은 P2 권고로 남긴다.

## 반영 내용

- `narrative/MAIN_20MIN_DIALOGUE.json`에 5개 핵심 장면 13개 출처 발췌의 `CONTIGUOUS_WITNESS_RANGE` 범위를 추가했다. 각 범위는 동일 sourceId, 정확한 시작·끝 locator, paragraph count, RU/KO reference를 가진다.
- 동일 JSON에 Alexei, Ekaterina, Pavel, protagonist의 6개 상황별 speech-register matrix를 추가했다. 각 상황은 문장 종결, 리듬, 어휘 표지를 가진다.
- 문학 차용은 현재 0건이다. `literaryBorrowings: []`와 public-domain/original-only 정책을 명시해 사료 원문과 허구 대사를 문학 차용으로 혼동하지 않게 했다.
- 32개 consequential choice에 audience, recordMode, leavesOffice, risk를 추가했고 런타임 선택 카드에 표시한다. 엔딩 affinity·hidden score·보장 결과는 표시하지 않는다.
- 자료 읽기 화면에 연속 문맥 범위와 문맥 목적을 표시한다.

## 검증 결과

- `npm run v38-context-register-choice-audit` — PASS
- `npm run build` — PASS
- `npm run real-build` — PASS
- `npm run test` — PASS
- `npm run check` — PASS
- `npm run lint` — PASS
- `npm run v36-actor-audit` — PASS
- `npm run v36-historical-regression` — PASS
- `npm run v36-save-migration` — PASS
- `npm run v36-readability` — PASS (1440×900, 1366×768, 390×844, 360×800)
- `npm run v36-window-roundtrip` — PASS (네 viewport, scroll restoration)
- `npm run v36-exports` — PASS
- `npm run v37-dialogue-export-parity` — PASS
- `npm run v37-ending-semantic-exhaustive` — PASS (104,976 routes; semanticMismatch 0; noEnding 0; multiEnding 0; unresolvedSemanticTie 0; arrayOrderFallback 0)
- `npm run v37-real-build-browser` — PASS (10 production routes, five canonical endings, save/reload, desktop/mobile, page errors 0)
- `npm run v38-browser-evidence` — PASS (desktop/mobile choice-direction 및 contiguous-context raw PNG 4개)

## 증거 위치

- 요구사항별 machine-readable 결과: `docs/v38/V38_REQUIREMENTS_13_16.json`
- 브라우저 DOM/스크린샷 결과: `docs/v38/V38_BROWSER_EVIDENCE.json`
- 추가 요구사항 전용 raw PNG: `artifacts/v38-browser/`
- V37 ending/browser 결과: `docs/v37/`, `artifacts/v37/BROWSER_ACCEPTANCE/`
- V36 reader/window/source export 결과: `docs/v36/`, `artifacts/v33/V36_20261004_READER_WINDOW/`
- canonical manuscript: `narrative/MAIN_20MIN_DIALOGUE.json`
- generated exports: `docs/v36/MAIN_20MIN_DIALOGUE_ALL.md`, `docs/v36/MAIN_20MIN_DIALOGUE_ALL.tsv`

## 한계

자동 브라우저 검증과 독립 감사는 인간 플레이테스트를 대체하지 않는다. 실제 인간이 느끼는 말투의 자연스러움과 몰입감은 별도 플레이테스트가 필요하다. 이번 변경은 그 평가를 자동 PASS라고 주장하지 않는다.
