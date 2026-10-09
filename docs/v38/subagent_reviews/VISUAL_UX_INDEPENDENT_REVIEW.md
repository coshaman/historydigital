# V38 독립 시각·UX 최종 재검수

검수일: 2026-10-04  
대상: 최신 `mobile-choice-direction.png`, `styles.css`, `main20-runtime.js`, `MAIN_20MIN_DIALOGUE.json`

이번 최종 재검수에서 C03에는 callback이 없고 C06에 1개의 callback이 있는지, 현재 장면 기반 런타임 회수 경로가 이를 사용하는지 다시 대조했다. C06 callback 연결 P1은 해소됐다.

## 최종 판정

**PASS — P0 0건, P1 0건, P2 1건.**

실제 390×844 PNG에서 세 choice card 전체가 화면 안에 보이며 제목과 방향 meta가 읽힌다. 카드가 하단 navigation에 가려지거나 서로 겹치지 않는다. C03 표기도 화면과 evidence state에 일치한다.

## 확인 결과

- choice 영역은 모바일에서 단일 열로 배치되고 dialogue 영역이 스크롤 가능하다. 최신 PNG의 세 번째 카드도 하단 바 위에서 완결되어 초기 viewport에서 잘리지 않는다.
- runtime은 `choiceButton()`에서 선택문과 `알림·기록·이동·위험` meta를 분리 렌더링한다.
- C07-C의 reaction/sequence는 동일한 Alexei 종결로 통일되어 화면상 register 불일치가 없다.
- E07-B와 Alexei callback register도 공식 기록 맥락의 존댓말로 정리됐다.

## P2

register matrix는 데이터에 존재하지만 `main20-runtime.js`가 이를 실행 시 검증하지 않는다. 현재 시각·사용성 결함은 아니므로 P2 권고로 남긴다.

## 결론

시각·UX 범위와 전체 V38 최종 판정은 **PASS**다. P0/P1은 없으며 register matrix의 런타임 검증 연결만 P2 권고로 남긴다.
