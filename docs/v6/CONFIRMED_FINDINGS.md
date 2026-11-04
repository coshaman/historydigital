# V6 확인된 발견 사항

생성 시각: 2026-11-04T19:07:47.688Z

이번 문서는 기존 감사 합계를 재사용하지 않고 현재 파일을 다시 읽어 산출했다. CONFIRMED는 코드·데이터 구조에서 현재 확인된 항목이며, 브라우저에서 기록된 네트워크 실패는 별도 진단 번들에 보존되어 있다.

| # | 항목 | 상태 | 근거 |
|---:|---|---|---|
| 1 | Three.js 외부 동적 import 3건 | FIXED_LOCAL_RUNTIME | three-desk.js and three-walk.js import ./vendor/three/three.module.min.js with adjacent local core module and MIT license; package.json pins three 0.180.0 |
| 2 | 네트워크 차단 시 3D fallback | NO_CDN_PRODUCTION_PATH | local module load is the production path; runtime gate exposes fallback=true only on local load failure |
| 3 | 성능 감사가 실제 WebGL 대신 fallback 측정 | CONFIRMED | performance route starts with fallback-compatible page; WebGL availability and Three import are separate from timing assertions |
| 4 | mountCaseEvidence/setSourceReading의 번역 인자 오염 가능성 | CONFIRMED | app.js passes runtime line text through evidence mounting path; source display and translation fields are not typed at the boundary |
| 5 | 장면 단위 번역 fallback 재사용 | CONFIRMED | runtime dialogue contains repeated scene-level fallback wording; no translation_id exists in legacy runtime lines |
| 6 | case→source→excerpt 구조가 원자적으로 연결되지 않음 | CONFIRMED | manifest excerpts have sourceObjectId but no case_id (91 excerpts); case packs reference source objects separately |
| 7 | 세미콜론 결합 case ID | NOT_LITERAL_IN_CURRENT_MANIFEST | manifest case IDs containing semicolon: 0; legacy export risk remains because relation is derived rather than atomic |
| 8 | 직접 excerpt가 없는 case 수 | CONFIRMED | runtime cases: 24; atomic excerpt relations: 0; cases without direct excerpt relation: 24 |
| 9 | 미래 날짜 source의 case 연결 | CONFIRMED | future source/case relations: 48; CP01→OBJ-PETERSBURG-PLAN-1840 (1846 > 1836); CP01→OBJ-PETRASHEVSKY-1849 (1849 > 1836); CP02→OBJ-PETERSBURG-PLAN-1840 (1846 > 1836); CP02→OBJ-BELINSKY-GOGOL-1847 (1847 > 1836); CP03→OBJ-PETERSBURG-PLAN-1840 (1846 > 1837); CP03→OBJ-OZ-1848 (1848 > 1837) |
| 10 | DIRECT가 1차 인용이 아닌 archive 설명인 항목 | CONFIRMED | Petrashevsky DIRECT dossier-summary excerpts: 5; these are marked for reclassification in v6 gold data |
| 11 | 정확 중복/template 대사의 비율 | CONFIRMED | dialogue lines: 802; exact duplicate overflow: 170; template-like lines: 192 |
| 12 | 내부 route/state key의 UI 노출 위험 | CONFIRMED | keys found: reputation, press_freedom, legalism, risk_tolerance, state_loyalty; keys are implementation labels and require presentation mapping |

## V6에서 고정한 범위

- 기존 21개 케이스는 수정하지 않는다.
- E02, E05, E07만 원자적 source/excerpt 데이터로 별도 정규화한다.
- GARF 현대 설명은 직접 인용으로 사용하지 않는다.
- 이 단계에서는 제품 runtime 연결, 로컬 Three.js 전환, 전체 번역 파이프라인을 진행하지 않는다.
