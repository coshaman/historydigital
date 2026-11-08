# 대화·현장·역사 사건 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to execute tasks and verify them.

**Goal:** 응답성 있는 인물 대화, 명확한 상호작용 표시, 생동감 있는 주민, 새 역사 현장 세 곳을 Vercel RPG에 통합한다.

**Architecture:** 기존 AI 1:1 대화는 마지막 발화 우선 규칙으로 다듬는다. 상단 역사 현장 흐름은 검증한 출처가 있는 고정 대화 자료로 제공하며, 3명 대화 뒤 네 번째 인물이 합류하고 선택 결과와 실제 역사 결과를 함께 보여준다. 캔버스 오브젝트 강조와 장식용 말풍선은 화면 전용이다.

**Tech Stack:** Vanilla JavaScript, Node.js serverless functions, JSON source/maps/quests, Canvas renderer, Playwright.

**Spec:** `docs/v38/immersive-dialogue-and-history-events-design.md`

## Global Constraints

- Vercel 단독 API 구조 유지. Cloudflare 추가 금지.
- 실제 역사 인물은 이벤트 중 빙의 불가. 실제 역사 결과는 플레이 선택으로 변경하지 않는다.
- 새 역사 사건은 기존 1848·1849 및 기존 문학 독서 사건을 재사용하지 않는다.
- AI는 대화만 생성한다. 돈·퀘스트·인물 지식·사망·결말은 서버/엔진이 결정한다.
- 세 사건은 각각 검증된 출처와 끝난 뒤 역사 결과/자료 검토를 가진다.

## Review Focus

- 명시적 질문을 AI가 빗겨갈 때 직접 답하고 최근 맥락을 유지하는가.
- 화면 강조와 실제 `E` 상호작용 조건이 일치하는가.
- ambient 대화/효과가 입력·대화창·저장 상태를 방해하지 않는가.
- 시대 외 인물 possession, 날짜·장소 이동, save/load에서 역사 인물이 playable해지지 않는가.
- 세 사건의 러시아어/한국어 인용 범위와 사건 뒤 고정 결과가 맞는가.

### Task 1: Dialogue response harness

**Files:** `ai/v33/session-runtime.cjs`, `rpg/ai/scenes.json`, `rpg/characters/*.json`, `scripts/v33-ai-runtime.test.mjs`.

- [x] 최근 사용자 발화에 먼저 답하고, 맥락 부족 시 장면에 붙은 짧은 되물음을 하며, 한국어 말맛을 다시 확인하도록 지침 추가.
- [x] 최근 대화·인물 카드·장면 정보를 기존 요청 구조 그대로 사용한다.
- [x] AI 요청 검사와 인물 말씨 회귀 테스트 통과.
- [x] 실패 응답을 고정 대사로 대체하지 않는 기존 동작을 회귀 검사.

### Task 2: Interactable and ambient world feedback

**Files:** `rpg/engine/renderer.js`, `rpg/engine/*presentation*.mjs`, `rpg/main.js`, `rpg/rpg.css`, `index.html`.

- [x] 인물·퀘스트·출입 조건을 통과한 인터랙션에 brass outline/pulse 적용.
- [x] 이동 중인 캠페인 주민에게 낮은 빈도의 로컬 말풍선 추가; 플레이어 대화 중 숨김.
- [x] historical scene choices show authored reactions and dynamically update top alert; reduced-motion에는 정적 강조를 쓴다.
- [x] 역할·퀘스트·출구 및 말풍선 표시 테스트 통과.

### Task 3: Historical scene data and source entry

**Files:** `rpg/data/v38-historical-events.json`, `rpg/main.js`, `index.html`, `scripts/v38-history-events-test.mjs`.

- [x] Three distinct scenes with verified record locators and official/primary source links: 1825 Senate Square, 1836 Gogol premiere and reception, 1861 emancipation proclamation distribution.
- [x] Top-bar button opens the three scenes; no historical real person is introduced to the possessable roster.
- [x] Each scene has three opening speakers, a fourth joins in round two, two practical choices, a saved personal record, immutable historical outcome, and post-scene sources.
- [x] Event catalogue audit validates speaker membership, new joining participant, choice direction, source locators and non-possessable cast.

### Task 4: Runtime, acceptance, and push

**Files:** `rpg/engine/game-state.js`, `rpg/main.js`, `ai/v33/session-runtime.cjs`, tests and browser evidence.

- [x] Historical actions persist in local storage; active alert, joining rounds and non-roster cast stay separate from campaign save state.
- [x] `npm run check`, static build, historical-event browser test at desktop/mobile, and campaign route smoke pass.
- [ ] Commit scoped files and push `HEAD:master`.
