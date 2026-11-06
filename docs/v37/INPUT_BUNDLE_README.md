# V37 — 러시아 생활 세계 시뮬레이션 기획 번들

**포함 내용**
- `CODEX_V37_HISTORICAL_LIVING_WORLD_GOAL.md`: Codex용 전체 구현 목표.
- `data/residents_1840s_36.json/.csv`: 36명 가상 주민의 집/가족/친구/직업/돈/능력치/퀘스트/시간표 초안.
- `data/event_catalog_45.json/.csv`: 45개의 체험 가능한 현장 사건 초안과 행동·결과·참고 자료 유형.
- `data/world_rules.json`: 인과관계와 자율 NPC·빙의·경제·사건 엔진 제약.
- `data/era_character_registry.json`: 실제/문학 인물의 시대·권한·사건 제약.
- `docs/PRIMARY_SOURCE_RESEARCH_PLAN.md`: 자료 조사 및 사료 등급·역사적 원본 검증 계획.
- `docs/SIMULATION_DESIGN.md`: 시스템 구조/예시 연쇄.
- `docs/MAP_ASSET_BRIEF.md`: 도트 지도·자산 제작용 시안.
- `tests/check_bundle.py`: 사전 데이터 무결성 점검.

**주의:** 이 번들은 *게임 제작을 위한 설계 seed*다. 36명은 기본적으로 허구 주민이며, 45개의 사건 중 상당수는 역사적으로 그럴듯한 상황을 재구성한 것이다. 실증 자료를 전수 읽었다고 주장하지 않는다. 역사 기사/초상/사본은 반드시 원전 확인 후 실제 게임에 넣는다.

**사용 순서:** 프로젝트 root에 압축 해제 → Goal을 Codex에 붙여넣기 → 기존 코드에 안전하게 통합 → 사료 대조·시뮬레이션·브라우저 QA → 최종 게임/증거 ZIP.
