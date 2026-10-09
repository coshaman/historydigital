# V28 Narrative / Character 독립 적대 검수

검수일: 2026-10-05  
역할: `narrative/character`  
최종 판정: **PASS (P0 없음, P1 없음)**

## 최신 C03-A 재검수 — 수정 확인

최신 `narrative/MAIN_20MIN_DIALOGUE.json`에서 `C03-A.reactionActor`가 `"alexei"`로 수정된 것을 직접 확인했다. reaction 문장 `좋아. 원인은 아직 비워 두자. 빈칸을 남기는 편이 틀린 이름을 남기는 것보다 낫다.`와 알렉세이의 짧고 건조한 말투가 일치한다.

`artifacts/final-main20/C03-A-reaction-1440x900.png`를 직접 열어 화면 speaker가 **알렉세이 오를로프**로 표시되고 portrait도 알렉세이로 렌더링되는 것을 확인했다. 대사 본문과 C03 표지/날짜도 잘리지 않는다. `docs/v38/MAIN20_FINAL_EVIDENCE.md`의 최신 evidence는 onboarding·choice direction·window roundtrip·RU/KO reader·ending captures를 포함하며 human playtest는 여전히 PENDING이다.

따라서 이전 P1-2(C03-A 직접 발화가 NARRATION/`장면`으로 표시되는 문제)는 해결되었다. P0 없음, P1 없음, P2는 기존 evidence hygiene 및 200% text-zoom 미완료만 유지한다.

## 최신 한국어 대사·캐릭터 독립 재검수 — C03-A 주체 충돌 발견

최신 `narrative/VN_DIALOGUE_GRAPH.json`, `narrative/CHARACTER_BIBLE.md`, `narrative/MAIN_20MIN_DIALOGUE.json`과 최신 raw PNG `desktop-1440-C07-arrival.png`, `desktop-1440-C07-reaction.png`, `desktop-1440-C07-inspection.png`, `desktop-1440-C07-aftermath.png`, `mobile-360x800-arrival.png`, `mobile-390x844-evidence-ru-ko.png`, `endings/ending-belinsky.png`, `endings/ending-uvarov.png`를 직접 읽고 열었다. `npm run v28-korean-naturalness`는 PASS(24 case/596 utterance)였지만, 해당 audit는 actor/register 주체의 의미 충돌까지 판정하지 않는다.

### P1-2. C03-A reactionActor와 실제 문장 주체 불일치

`MAIN_20MIN_DIALOGUE.json`의 `C03-A`는 `reactionActor: "NARRATION"`인데 reaction은 `좋아. 원인은 아직 비워 두자. 빈칸을 남기는 편이 틀린 이름을 남기는 것보다 낫다.`이다. 이는 3인칭 장면 서술이 아니라 상대에게 직접 답하는 알렉세이의 짧고 건조한 발화이며, 캐릭터 바이블의 알렉세이 리듬(빈칸·책임을 앞세운 단문)과도 정확히 맞는다. 그런데 `main20-runtime.js`는 `renderFinalReaction()`에서 `choice.reactionActor || choice.actor`를 그대로 `renderDialogueLine()`에 전달하고, NARRATION은 `장면` label로 렌더링한다. 따라서 C03-A 선택 후에는 알렉세이 대사가 장면 서술 label로 표시된다. `reactionSequence`도 없어 보정 경로가 없다.

같은 결함이었던 C07-P3는 현재 `reactionActor: "NARRATION"`과 3인칭 문장으로 해결되었지만, C03-A가 남아 있으므로 이 항목은 P1이다. 최신 V28 graph PNG는 C03-A MAIN20 경로를 직접 캡처한 자료가 아니므로, 이번 P1 판정은 canonical JSON과 active MAIN20 runtime의 직접 대조에 근거한다.

결론: P0 없음, **P1-2 잔존 — FAIL**.

## 최종 재검수 — C07-P3 수정 반영 확인

최신 `narrative/MAIN_20MIN_DIALOGUE.json`의 `C07-P3`를 직접 확인한 결과 `reactionActor: "NARRATION"`으로 반영되어 있다. reaction 본문은 3인칭 장면 서술이며, 이 경우 별도 `reactionSequence`는 필요하지 않다.

최신 `main20-runtime.js`의 `labelFor('NARRATION')`은 `장면`을 반환하고, `renderDialogueLine()`은 NARRATION에 인물 portrait를 붙이지 않는다. `renderFinalReaction()`은 `choice.reactionActor || choice.actor`를 그대로 전달하므로 C07-P3는 이제 장면 label로 렌더링된다. gold-slice PNG는 V28 graph 화면의 날짜·speaker·문서 레이아웃 확인 자료로 구분했으며, MAIN20 C07-P3 판정은 최신 canonical JSON과 runtime 직접 대조로 확정했다.

최신 SHA-256은 MAIN20 JSON `D931827084AA1211CC029BE339927531138478481EAC7220A2FD55E010E78963`, `main20-runtime.js` `CBE8D3641EC8CD3C36B97B6ACABEEEB294EAD9BF14FDAFC63592C91C481E194F`, `gold-runtime.js` `2D4CA99A2843F25A22ACF28C7013B1DD4CD1965903EE9101583438CC15E34FC1`이다. `npm run v38-context-register-choice-audit`도 `PASS`(5 scenes, 4 characters, 6 situations, literaryBorrowings 0)로 재실행 확인했다.

결론: **P0 없음, P1 없음 — PASS**. 이전 C07-P3 actor/register 주체 충돌은 해결되었다.

## 최신 증거 재검수 — legacy 모바일 overflow 격리 확인

2026-10-05 최신 작업 트리를 기준으로 `narrative/VN_DIALOGUE_GRAPH.json`(C01–C24, 24 case), `narrative/ENDING_DIALOGUES.json`(5 ending), `narrative/CHARACTER_BIBLE.md`, `narrative/NARRATIVE_ARC_MATRIX.csv`, `narrative/MAIN_20MIN_DIALOGUE.json`, `gold-runtime.js`, `main20-runtime.js`, `styles.css`, `docs/v28/ISSUE_TRIAGE.csv`를 다시 직접 읽었다. `npm run v28-timeline-audit`는 `PASS / caseCount 24 / mismatches []`, `npm run v28-replay-audit`는 `PASS / errors []`로 재실행되었다. C07-P3도 최신 JSON에서 여전히 `reactionActor: "NARRATION"`이고 runtime의 `labelFor()`는 `장면`으로 표시한다.

이번에 직접 연 최신 raw PNG basename은 `desktop-1440x900-arrival.png`, `desktop-1440x900-choice-reaction.png`, `desktop-1440x900-evidence-ru-ko.png`, `desktop-1440x900-aftermath.png`, `desktop-1366x768-choice-reaction.png`, `mobile-390x844-arrival.png`, `mobile-390x844-choice-reaction.png`, `mobile-390x844-evidence-ru-ko.png`, `mobile-390x844-aftermath.png`, `mobile-360x800-arrival.png`, `mobile-360x800-choice-reaction.png`, `mobile-360x800-evidence-ru-ko.png`, `mobile-360x800-aftermath.png`, `endings/ending-belinsky.png`, `endings/ending-uvarov.png`이다. 360×800 arrival에서는 세 선택 카드가 하단 고정 바와 겹치지 않고 한국어 문장·보조 문구가 읽히며, 390×844와 데스크톱에서도 대사/원문·번역/aftermath가 잘리지 않는다. ending PNG에서는 BELINSKY와 UVAROV의 dialogue/witness 조합이 보존된다.

`docs/v28/ISSUE_TRIAGE.csv`의 `V28-LEGACY-MOBILE-OVERFLOW`는 P1/CLOSED로 기록되어 있다. 실제 `gold-runtime.js`의 legacy `renderGold()`는 V28 case가 아닐 때 `v28-runtime`을 제거하고, V28 case만 `renderV28Case()`로 진입시킨다. 따라서 이번 legacy 모바일 overflow 수정은 V28 본선의 graph 대사·캐릭터 말투·ending/replay 계약에 영향을 주지 않는 것으로 판정한다. 본선 narrative P0/P1은 새로 재현되지 않았다.

인간 플레이테스트와 200% text-zoom raw capture는 별도 미완료 상태로 유지한다. 이는 현재 narrative P1로 승격하지 않으며, `ISSUE_TRIAGE.csv`의 P2 open 항목으로 남긴다.

## 최신 active MAIN20 재검수 업데이트

최신 `narrative/MAIN_20MIN_DIALOGUE.json`, `narrative/VN_DIALOGUE_GRAPH.json`, `gold-runtime.js`, `main20-runtime.js`와 gold-slice raw PNG `C01-reaction-1440x900.png`, `C07-reaction-1440x900.png`, `C17-reaction-1440x900.png`, `C24-reaction-1440x900.png`를 다시 읽고 열었다. `npm run v38-context-register-choice-audit`는 PASS이고 5개 scene/4개 character/6개 situation을 검사한다. 32개 MAIN20 choice/postChoice에는 immediate direction의 audience/recordMode/leavesOffice/risk가 모두 있으며 `main20-runtime.js`의 `directionFor()`가 실제 choice card에 렌더링한다.

이번 재검수에서 C07-P3는 `reactionActor: "NARRATION"`으로 확인되었고, runtime은 `장면` label과 portrait 비표시 경로를 사용한다. 따라서 이전에 자동 audit가 놓쳤던 3인칭 reaction의 speaker/register 충돌은 더 이상 재현되지 않는다.

## 최종 재검수 업데이트

새 graph/ending/replay와 gold-slice PNG를 독립적으로 다시 확인했다. `npm run v28-timeline-audit`는 `PASS / caseCount 24 / mismatches []`, `npm run v28-replay-audit`는 `PASS`이며 C01 live/replay의 case, choice, witness, memory callback, access, relationship, risk, routed/read count가 일치했다. `npm run v28-all-cases-browser-evidence`는 `PASS / 24 cases / chronological true / pageErrors []`, `npm run v28-ending-browser-evidence`는 5개 ending 모두 expected/actual 일치, 각 12 cases 완료, witness state 일치, pageErrors 없음으로 종료했다.

직접 다시 연 PNG는 `artifacts/v28-browser/all-cases/C07-arrival.png`, `C08-arrival.png`, `C19-arrival.png`, `C23-arrival.png`, `C24-arrival.png`, `desktop-1440x900-choice-reaction.png`, `mobile-390x844-choice-reaction.png`, `mobile-360x800-choice-reaction.png`, `endings/ending-belinsky.png`, `endings/ending-uvarov.png` 및 canonical ending 5종이다. C07/C24 날짜는 graph와 일치했고, C08/C19/C23의 세 choice card는 사건별 문장으로 분화되어 제목 치환형 반복이 재현되지 않았다. BELINSKY는 Ekaterina+Pavel, UVAROV는 Alexei+Ekaterina+Pavel witness와 ending dialogue가 일치한다.

## 검수 범위와 실제로 읽은 자료

- `narrative/VN_DIALOGUE_GRAPH.json` 전체: C01–C24, 72개 선택, 596개 node 구조를 읽었다.
- `narrative/ENDING_DIALOGUES.json` 전체: `DOSTOEVSKY_PETRASHEVSKY`, `HERZEN`, `BELINSKY`, `KHOMYAKOV`, `UVAROV` 5개 ending을 읽었다.
- `narrative/CHARACTER_BIBLE.md`: Alexei의 봉인·날짜 중심 단문, Ekaterina의 질문 우선·원문/지명 확인, Pavel의 거리·날씨·도착 시각 중심 말투를 기준으로 삼았다.
- `narrative/NARRATIVE_ARC_MATRIX.csv` 전체: 24개 case의 목적·memory callback·dateRange를 graph와 대조했다.
- `docs/v28/V28_ACCEPTANCE.json`, `docs/v28/ENDING_BROWSER_EVIDENCE.json`, `docs/v28/RELATIONSHIP_MEMORY_TRACES.json`, `docs/v28/RELATIONSHIP_MEMORY_BROWSER_EVIDENCE.json`을 읽었다. 자동 산출물의 PASS를 독립 판정으로 사용하지 않았다.
- 관계 memory 표본: C08, C09, C23의 `V28-Cxx-MEMORY-A/E/P`와 다음 사건 callback 구조를 읽었다. 현재 `RELATIONSHIP_MEMORY_TRACES.json`은 `status: PASS`, `callbackCaseCount: 24`다.

### 실제로 연 raw PNG basename

4개 gold case의 reaction 화면을 직접 열었다: `desktop-1440-C01-reaction.png`, `desktop-1440-C03-reaction.png`, `desktop-1440-C07-reaction.png`, `desktop-1440-C17-reaction.png`, `desktop-1440-C24-reaction.png` (모두 1440x900). 5개 canonical ending 화면도 직접 열었다: `endings/ending-DOSTOEVSKY_PETRASHEVSKY.png`, `endings/ending-herzen.png`, `endings/ending-belinsky.png`, `endings/ending-khomyakov.png`, `endings/ending-uvarov.png` (모두 1440x900).

그 외 텍스트 검수 대상은 C01–C24 전부이며, gold는 C01/C07/C17/C24, 층화 표본은 C02–C06/C08–C16/C18–C23으로 읽었다. ending dialogue 5개와 72개 choice의 actor/effect/후속 node 연결도 대조했다.

## 재현 절차

1. canonical graph에서 각 Cxx의 `dateRange`, arrival → choice → reaction → inspect/evidence → memory/aftermath node를 추출했다.
2. gold 및 표본의 choice 문장, reaction 문장, aftermath/callback 문장을 이름을 가린 상태로 비교하고, effects가 실제 다음 화면 문장 변화로 이어지는지 확인했다.
3. ARC matrix의 날짜·dramaticPurpose·memoryCallback과 graph를 줄 단위로 대조했다.
4. raw reaction PNG에서 화면 우상단 날짜/제목, 문서 제목, 실제 reaction 문장을 직접 확인하고 canonical ending PNG에서 ending title/dialogue를 직접 확인했다.

## 이전 P1 해결 여부

### P1-1. canonical graph와 ARC/실제 PNG의 사건 날짜가 불일치 — 해결

현재 timeline audit가 24개 case의 graph/ARC dateRange를 모두 일치시킨다. 이전에 불일치했던 C03/C05/C06/C07/C14/C19/C21/C24는 현재 mismatch가 없다. all-cases PNG도 graph의 날짜·제목과 모두 일치한다.

직접 본 최신 C07/C24 및 all-cases PNG도 graph 날짜·제목을 표시한다.

### P1-2. 12개 case의 선택 분기가 제목 치환형 반복에 머문다 — 해결

현재 graph 집계는 72개 choice/72개 고유 choice 문장, 72개 reaction/72개 고유 reaction이다. C08/C19/C23 raw PNG에서도 세 카드가 사건별 실제 문장으로 보인다. effects만 바뀌는 가짜 분기 문제는 재현되지 않는다.

 - Ekaterina/Pavel choice도 사건별 conflict와 후속 문장으로 분화되어 있다. 실제 PNG와 graph 모두 동일한 분화를 확인했다.

### P1-3. memory trace와 browser memory evidence의 계약 불일치 — 해결

현재 `RELATIONSHIP_MEMORY_TRACES.json`은 `status: PASS`, `callbackCaseCount: 24`이며 browser evidence와 graph의 callback/witness 계약이 일치한다.

### P1-4. ending witness/dialogue 불일치 — 해결

BELINSKY의 requiredMemory/dialogue/witness는 Ekaterina+Pavel, UVAROV는 Alexei+Ekaterina+Pavel로 일치한다. fresh ending browser evidence의 5개 route가 모두 expectedEnding=actualEnding으로 종료했다.

### P1-5. replay 누락 — 해결

`gold-runtime.js`의 `replayV28Actions`가 spoken choice, document read, routed document, memory callback, ending action을 재생하며 fresh replay audit가 live/replay state 일치를 확인했다.

## P0

없음. graph, ending, replay, browser evidence 모두 존재하며 fresh 실행에서 page error가 없다.

## P1

없음. C03-A는 최신 JSON에서 `reactionActor: "alexei"`로 수정되었고, `artifacts/final-main20/C03-A-reaction-1440x900.png`에서 **알렉세이 오를로프** label/portrait와 실제 발화가 일치한다. C07-P3의 NARRATION 처리도 문장 주체와 일치한다.

## P2

- gold 및 표본의 Alexei/Ekaterina/Pavel choice는 캐릭터 축과 사건별 문장이 구분되고, `ENDING_DIALOGUES.json`의 5개 ending 문장도 관계 조합을 반영한다.
- `artifacts/v28-browser` 루트의 `ending-belinsky.png`, `ending-herzen.png` 등 legacy/top-level ending PNG는 `endings/` canonical 파일과 내용·파일명 대응이 어긋난다. `docs/v28/ENDING_BROWSER_EVIDENCE.json`이 `endings/`를 가리키므로 현재 판정을 P1로 올리지는 않지만 evidence hygiene P2다.
- graph의 `historicalClaims`에는 공백/빈 배열만 남아 있으며, 이번에 읽은 대사에서 출처 없는 역사적 발언을 새로 확인하지는 못했다. 다만 “빈 문자열 claim”도 검출하는 audit라면 실제 claim 유무를 오판할 수 있으므로 감사기 검출 기준은 P2 점검 대상이다.
- replay audit가 현재 C01 단일 live/replay 경로를 검증한다. full 12-case/5-ending replay coverage 확장은 P2다.
- legacy/top-level ending PNG와 canonical `endings/` PNG가 함께 있어 basename 혼동 여지가 있으나, 현재 evidence JSON은 canonical 경로를 사용한다.
- 이전 `desktop-1440-C07-reaction.png`·`desktop-1440-C07-inspection.png`·`desktop-1440-C07-aftermath.png`에서 긴 인물명이 좁은 speaker 영역에 세로로 쌓인 현상은 evidence hygiene P2로 남긴다. 이번 최신 `artifacts/final-main20/C03-A-reaction-1440x900.png`에서는 알렉세이 이름이 정상 가독성을 보였다. 200% text-zoom raw capture와 인간 플레이테스트는 별도 미완료다.

## 최종 판정

**PASS (P0 없음, P1 없음).** graph/ending/replay와 register 구조를 통과했고, C03-A는 최신 canonical JSON 및 최종 MAIN20 PNG에서 알렉세이 speaker/portrait/발화가 일치한다. 남은 것은 evidence hygiene와 200% text-zoom·인간 플레이테스트 성격의 P2/미완료 항목뿐이다.
