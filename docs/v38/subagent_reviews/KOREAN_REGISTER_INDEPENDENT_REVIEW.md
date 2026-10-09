# 한국어 대사·캐릭터 말투 독립 최종 재검수 보고서

검수 대상: 최신 `narrative/MAIN_20MIN_DIALOGUE.json`, `main20-runtime.js`, `styles.css`, `scripts/v38-context-register-choice-audit.mjs`, `artifacts/v38-browser/mobile-choice-direction.png`.

## 최종 판정

**PASS — P1 없음.** 최신 canonical JSON과 런타임, 감사 결과, 390×844 PNG를 다시 대조했다. 직전 P1이었던 C06 callback 소유 위치, C07-C 종결 불일치, Alexei callback register 혼용, 모바일 choice clipping이 모두 해결됐다. P2 수준의 한국어 다듬기 권고는 남지만 플레이 가능성·관계별 말투 검수의 차단 사유는 아니다.

## 요청 항목별 판정

| 항목 | 판정 | 확인 근거 |
|---|---|---|
| C06.memoryCallbacks 추가·C03 선택 history 회수 | **PASS** | C03에는 callback이 없고, C06에는 Alexei callback 1개가 있다. callback의 `actionsAny`는 `public_citation`, `preserve_public_grief`, `trace_print_route`이고, 모두 C03 choice action에 존재한다. C06의 `relevanceScenes`도 `C06`이다. 런타임 `selectMemoryCallbacks(current)`는 현재 C06의 callback과 이전 `state.history` action을 매칭하고, `renderIntro()` 마지막 줄에서 이를 렌더한다(`main20-runtime.js:23-25`). |
| C07-C reaction/reactionSequence 종결 통일 | **PASS** | `reaction`과 첫 sequence 항목이 모두 `유보는 회피가 아니군요.`이다(`narrative/MAIN_20MIN_DIALOGUE.json:1056-1059`). 런타임은 sequence 첫 항목을 우선 표시하므로 실제 화면에서도 종결이 일치한다(`main20-runtime.js:27`). |
| E07-B와 Alexei callback register 통일 | **PASS** | E07-B는 `나눴군요 ... 있습니다`로 정리됐다. C06/C07/E02/E07 Alexei callback도 각각 `읽겠습니다`, `섞지 않으려는군요`, `보이는군요`, `있군요`로 `-습니다/-군요` 계열을 유지한다(`narrative/MAIN_20MIN_DIALOGUE.json:858`, `:1218`, `:1604`, `:2107`). |
| 모바일 390×844 세 choice card 전체 가독성 | **PASS** | 새 `artifacts/v38-browser/mobile-choice-direction.png`에서 세 카드가 모두 viewport 안에 들어오며 각 제목과 알림·기록·이동·위험 subcopy가 footer에 가리지 않고 읽힌다. CSS의 모바일 choice strip/card 조정도 확인했다(`styles.css:301-303`). |

## P0

없음. 실제 PNG에서 진행을 막는 치명적 오류나 역사적 결과를 바꾸는 오류는 확인하지 못했다.

## P1

없음. 이전 P1 항목은 모두 해결로 판정한다.

## P2 — 비차단 권고

### P2-1. 일부 선택 subcopy는 더 자연스럽게 다듬을 수 있다

다음 표현은 의미 전달에는 문제가 없지만 한국어 리듬이 다소 기계적이다.

- C03-C `소식의 길이 판단을 바꿉니다.` → `소식이 어떤 경로로 왔는지가 판단을 바꿉니다.`
- C06-C `네 개의 모자를 놓았는지부터 추적하겠습니다.` → `네 개의 모자가 현장 어디에 있었는지부터 추적하겠습니다.`
- C03-A `상실의 크기` → `상실을 말하는 방식` 또는 `애도의 깊이`

### P2-2. protagonist 선택문과 register matrix의 명시적 매핑

`-겠습니다`, `-어요`, `-죠`, `-겠다`가 선택 채널에 따라 섞인다. 문장 자체는 수용 가능하지만, 향후 유지보수를 위해 공개·사적·공식 선택과 protagonist register를 metadata로 연결하면 좋다.

## 런타임·감사·PNG 대조

- 감사 스크립트 실행 결과: `V38_CONTEXT_REGISTER_CHOICE_AUDIT: PASS` (`scenes: 5`, `characters: 4`, `situations: 6`, `literaryBorrowings: 0`).
- 감사 스크립트는 `scene.memoryCallbacks`를 실제 대사 수집에 포함하고, C07-C의 sequence 구조와 화자 접두사 검사를 유지한다(`scripts/v38-context-register-choice-audit.mjs:40-47`).
- C06 callback은 C06 객체에 실제로 존재하며, C03 선택 action과 history 매칭이 가능하다.
- `mobile-choice-direction.png`는 390×844에서 세 카드 전체를 보여 준다. 마지막 카드도 하단 footer에 가리지 않는다.
- 런타임은 현재 장면 ID를 header/자료철에 반영하고, callback은 현재 scene의 `memoryCallbacks`만 조회한다. 이번 JSON 배치와 런타임 경로가 일치한다.
