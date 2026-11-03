# CODEX GOAL V36 — A LIVING PETERSBURG, 1847
## Russian Lives: Act III — 36 Citizens, Goal-driven AI, Open-world Possession & Source-backed Urban Life

> **실제 코드 구현 명령.** 이 문서는 `coshaman/historydigital`의 프로젝트 루트에 저장한다. `AGENTS.md`와 V35 Goal의 역사 고증·대화·사료 읽기·Vercel-only API 계약을 함께 적용한다. 작업의 성공 기준은 계획서나 NPC 숫자 보고가 아니라 **1840년대 상트페테르부르크의 한 생활권에서 수십 명이 저마다 일하고 이동하고 얽히며, 플레이어가 다양한 신분으로 빙의해 그 삶을 체험하는 실제 실행 게임**이다.
>
> 필수 조건: 기존 퀘스트·빙의·사료·저장·5엔딩·문학 세계·Vercel `/api/rpg/*` 및 `OPENAI_API_KEY` 서버 전용 구조 보존. Cloudflare 재도입 금지. root AGENTS.md의 WEB GAME QUALITY CONTRACT를 엄격 적용. 외부 도구 또는 키가 없어도 오프라인 플레이 가능. 테스트 결과를 꾸미지 말 것.
>
> **서브에이전트는 기본 1명, 전체 생성 수 최대 2명.** 1명은 역사/게임플레이/시각 품질을 비판적으로 독립 검토하며, 추가 1명은 대규모 아카이브 출처 대조나 성능 검증에 꼭 필요한 경우에만. 다른 서브에이전트 재귀 생성 금지. 수정 가능한 P0/P1을 보고만 하고 멈추지 말 것.

---

## 0. 핵심 비전과 '오픈월드'의 정확한 의미

**플레이어는 1847년 상트페테르부르크의 동일한 거리에서, 수선공의 몸으로 내일의 방세를 걱정하고, 역참/우편 전달자의 몸으로 편지를 옮기고, 서기의 몸으로 출판 신고를 살피고, 인쇄공의 몸으로 검열과 생계 사이에서 갈등한다.** 그사이 조종하지 않는 사람들은 남의 말을 기다리는 정지 오브젝트가 아니라 자신의 목적에 따라 일·거래·이동·휴식·소문 전달을 계속 수행한다. 바뀐 몸의 사회적 지위, 현재 가능한 이동, 인물만이 아는 정보와 실제 사건에 대한 견해가 행동과 대화를 제한하지만 대사를 로봇처럼 만들지는 않는다.

'오픈월드'는 끝없는 맵, 무제한 절차 생성, 최신 러시아 도시 전체를 말하지 않는다. **1847년 전후의 상트페테르부르크 중심부·빈민 생활권을 역사적 근거를 갖춘 *연결된 지구(district)*로 조밀하게 구현**하고, NPC·물자·정보·신문이 그 공간을 실제로 오가며 영향을 미친다는 뜻이다. 이전 1836–1849 Act III 연대와 5엔딩은 별개의 *역사 장(chapter)* 시스템으로 유지하며, 1847년 도시를 중심 플레이 공간으로 만들고 1848/1849 세계 전환 시에는 연표/해당 사건·장소·인물의 상태를 일관되게 업데이트한다. 역사적 사건의 결과는 immutable. 플레이어와 허구 시민들의 미시적 삶만 변화한다.

**실패 사례:** 단지 NPC JSON 36개와 초상 36장을 만든 뒤 전부 1–2개 고정 좌표에 서 있거나, 모두 같은 구어체/퀘스트/이동 알고리즘을 사용하거나, 빙의해도 할 일이 없는 경우. 자유 텍스트를 뽑는 AI가 임의로 사료, 역사적 사건, 돈, 퀘스트 스탯을 변경하는 경우도 실패다.

## 1. 현재 실제 코드 베이스 — 구현 전에 HEAD에서 확인

사전 조사한 공개 `master`에서 확인한 구조(최종 사실은 Codex의 최신 체크아웃으로 재확인):

- `rpg/characters/`: **14개 설정 파일**, 그중 문학 인물 설정과 네크라소프 재구성 인물도 포함. 현재 도시의 실재 활동 NPC와 문학/실존 재구성 캐릭터를 혼동하지 말 것.
- `rpg/maps/`: **7개 JSON**(관청, 안뜰, 문학 세계 두 곳, 네프스키 거리, 경찰서, 인쇄소). 현행 도심 일상 생활권은 좁음.
- `rpg/assets/`: 기존 타일 시트와 초상·스프라이트. 그대로 재사용/개량할 것.
- `rpg/engine/game-state.js`: `scheduleEntry()`, `npcMapRoute()`, `nextNpcStep()`, `advanceWorldTime()` 등 타일 단위 경로 이동, 일부 인물 전달 작업, 충돌/예약 타일이 **이미 구현**돼 있음. 이를 재사용·일반화하여 36명/직업·인맥·물자에 확장. 이전 V35의 '전원 순간이동' 진단을 현 HEAD에 맹목적으로 적용하지 말 것.
- `rpg/engine/renderer.js`: Canvas 2D 16px 기반, 타일/스프라이트 렌더와 맵 캐시 있음. 새 Phaser/Three.js 전면 이식 대신 적합하면 기존 렌더러 최적화.
- `rpg/engine/quest-guidance.mjs`: 목적지 안내/실제 경로/퀘스트 접근 제한. 새 생활 퀘스트에 연결.
- `rpg/main.js`: NPC와 사료 상호작용 및 직접 입력 자유 대화; `rpg/ai/scenes.json`, `rpg/ai/authored-dialogue.mjs` 현재 주제/말투의 한계. V35의 큰 독서기와 가치관 대화가 실제 반영됐는지 확인하여 중복 구현을 피할 것.
- `api/rpg/[...path].js`: **Vercel-only** same-origin Functions. 기존 세션/지식 검증/비용 제한을 보존하고 `OPENAI_API_KEY` 서버 측에서만 사용. 자동 NPC 일상 행동은 LLM을 호출하지 않음.

PHASE 0에서 `CURRENT_HEAD_BASELINE.json`, `NPC_EXISTING_INVENTORY.csv`, `MAP_GRAPH_BASELINE.json`, `ASSET_BASELINE.csv`, `QUEST_BASELINE.csv`, `API_REGRESSION.md`를 실제 체크아웃 기준으로 생성. **기존 정상 기능과 콘텐츠는 삭제하지 말 것.** 테스트/스크린샷을 개선 전 상태로 캡처.

---

## 2. 도시 규모 — '넓게 흩어진 맵'보다 실제 생활권 연결

### 2.1 1847 도시 생활권 / 지도 세트

최소 **6개의 서로 다른 실외·반실외 연결 지구**와 **8개의 들어갈 수 있는 실제 내부 공간**을 구현하되, 기존 맵을 포함하고 가능한 경우 한 지구의 건물에 내부 맵을 소속시켜 유기적 경로를 만들 것. 지정한 지명이 역사 지도에서 같은 블록이 아니라면 허위로 한 블록에 우겨 넣지 말고 실제 거리에 맞춰 이동 거점·거리 길이/전환을 구현한다.

| 지구 | 필수 장면/기존 재사용 | 생활 및 상호작용 |
|---|---|---|
| A. 네프스키 대로·책방·상업 거리 | 기존 `nevsky`, 보행자/점포 입구 | 책·신문 가판, 마차/보행자, 길거리 광고, 가게 개폐, 행인, 서점·방문자 접촉 |
| B. 인쇄·유통 생활권 | 기존 `printshop` 연계 골목 | 인쇄소, 교정대, 조판, 포장, 우편·발송, 재료 공급 및 검열의 경제적 압박 |
| C. 관청·접수 및 감독 | 기존 `chancery`, `police-station` | 접수 대장, 상급자/하급자 권한, 공문과 방문증, 경비·검열의 눈치 |
| D. 공동 안뜰·셋방·세탁/수선 | 기존 `courtyard` 확장 | 방세·품삯, 수선·세탁, 공동 우물·장작·중고품, 세대 간 관계 |
| E. 시장/센나야 생활권 | 신설 | 좌판, 생선·달걀·빵, 하역·가격 흥정, 행상, 값과 소문, 빈곤/통제 |
| F. 운하/네바 강변·운송 | 신설 | 짐꾼, 수로/다리, 물자 공급, 배달과 선착장, 계절/날씨와 경로 선택 |

최소 **8개 내부 공간**: 책방, 인쇄소 작업장, 문서 접수실, 경찰 연락실, 공동 셋방, 재봉 작업실/세탁장, 시장 점포/빵집, 여관·주점/응접실 중 실제 시대·자료와 맞는 8개 이상. 실외 지구의 입구와 실내 공간 연결, 문·출입·신분 제한, `MAP_ACCESS_AUDIT`를 구현. 장소만 14개로 세고 전부 같은 타일의 빈 방이면 FAIL.

**다층 세계 맵:** `districtId`, `mapId`, `subLocationId`, `tileCoord`, `doorId`, `allowedEstates`, `openHours`, `sourceEvidenceIds`, `ambientSoundId`와 접근 가능 시기를 명시. 1847 지도에 없는 후대 도로/전차/가로등/건물 외양을 잘못 투입하지 않도록 `validFrom/validTo`와 시각 자료 연대. 당시 가능한 시설인지 **구체적 원전 증거를 확인**할 것; 확인 전에는 '사료로 직접 복원'이라는 라벨 사용 금지.

### 2.2 환경 콘텐츠 (그냥 장식이 아님)

최소 **70개 의미 있는 상호작용 지점**, **60개 이상 서로 구분되는 환경 에셋 유형**(원본·타일·변형을 매니페스트로 관리), **최소 12개 세계 반응 이벤트**(소문/가격/사람 부재/문 연 시각/발행물 도착/우천으로 우회 등). 숫자는 품질 게이트이면서도 **같은 소품 30회 복사하거나 다섯 글자 토스트만 붙여 카운트하는 행위는 실패**다.

반드시 시대/역할에 맞게 조사할 카테고리:
- **거리/건축:** 석조 건물 입면, 안뜰 아치, 목조 출입문, 적절한 도로 포장, 기둥/계단, 점포 표지, 운하 제방/다리, 굴뚝·하수·쓰레기·눈/진창. 지도·전경 그림이 근거.
- **교통/경제:** 마차, 인력/짐 운송, 우편 배달, 좌판, 바구니, 천/실, 빵, 생선, 장작, 장부, 동전(가격은 검증된 경우에만 수치), 필기구/인쇄소 활자.
- **업무/일상:** 봉투·인장·서류함·대장·교정쇄, 하숙방 가구, 재봉 도구, 자물쇠, 방세 쪽지, 약방 용기, 교복/관등 표식(시대별 구분), 교회/예배 공간은 실제 접근 가능한 위치가 조사된 경우에만.
- **감각/변화:** 시장 소리, 출근/퇴근 혼잡, 아침 배달, 비/눈, 마차 지나갈 때 일시적인 길 막힘, 밤 조명, 계절이 바뀐 경우 옷차림·통행 패턴 변경. 반드시 reduced-motion 및 음량 설정 지원.

**금지할 잘못된 시각 참조:** 1880~1900년 사진을 1847년에 실제로 촬영된 장면처럼 표기하지 말 것. 후대의 전차/간판·전선·건물로 1847 재현을 '고증'했다고 주장하지 말 것. 후대 사진은 해당 시설/옷차림이 그때도 존재했는지 별도 고증 후 *참고 자료*일 뿐이다. 스캔 이미지의 저장·재배포 권리와 창작 도트 에셋 권리를 분리.

---

## 3. **36명의 살아 있는 도시 주민** — 명시적 캐릭터 카탈로그

전체 수 목표는 **최소 36명의 1847년 도시 주민(active city agents)**이며, 이미 있는 도시 인물 중 정합성이 확인된 10명가량은 ID·기존 대사·퀘스트를 최대한 보존, 나머지는 신규 제작한다. 기존 문학 세계의 고골 등장인물과 역사 인물 재구성은 36명과 별도로 계수하라. **36명 전원은 일정+목표+이동+대화 또는 작업 인터랙션을 갖는다. 30명 이상은 실제 빙의할 수 있어야 한다.** 빙의 불가 6명 이하라면 그 이유(실존 역사 결과 보존/서사적 특수 제약)를 명시하고, 주민은 존재하되 퀘스트 강제 불가능한 상태여야 한다.

아래는 **개발용 가상 주민의 롤/목적 설계안**이다. 아래 이름·관계·사회적 배경은 실존 역사 인물의 확인된 전기가 아니다. 기존 정확한 이름·ID는 덮어쓰지 않고 기존 파일을 대조한 후 식별자를 확정한다. 각 역할·상점·계급 접근은 역사적 선행 자료를 통해 검증할 것.

| # | 주민 / ID(기존은 현행 유지) | 신분·생활·성격 | **구체적인 일일 목적 / 실제 이동 동선** | 체험·갈등 콘텐츠 씨앗 |
|---:|---|---|---|---|
| 01 | 알렉세이 / `clerk_alexei` | 신중한 하급 서기, 오류를 두려워함 | 셋방 → 관청 접수실 → 상관 책상 → 우편 창구 | 장부의 누락을 고칠지, 남의 이름을 보호할지 |
| 02 | 예카테리나 / `printer_ekaterina` | 실무적 인쇄 관계자, 검열에 회의적 | 집/작업장 → 조판대 → 책방 → 편집 연락 | 교정과 생계·출판 책임 사이의 갈등 |
| 03 | 파벨 / `courier_pavel` | 우편 연락원, 경로와 약속을 중시 | 우편집하 → 거리/다리 → 상점·인쇄소 → 반송 | 누가 어떤 내용의 문서를 받는가 |
| 04 | 안나 / `seamstress_anna` | 생계 우선 수선공, 일에는 자부심 | 셋방 → 주문집 → 수선대 → 대금 수금 | 품삯·방세, 신문을 읽을 시간의 비용 |
| 05 | 미하일 / `tenant_mikhail` | 일거리가 일정치 않은 세입자 | 셋방 → 시장 고용 문의 → 부두 → 귀가 | 하루 품삯과 밀린 방세, 소문에 휘둘림 |
| 06 | 레프 / `bookseller_lev` | 장부 정확한 서점상, 신중한 거래 | 집 → 서점 진열 → 책 배달 → 장부 정리 | 금지·반품·외상·독서 선택 |
| 07 | 소피야 / `editor_sofia` | 문학/편집 네트워크 인물, 계산적 | 응접실 → 인쇄소 → 책방 → 사적 서신 | 글의 가치를 인정하면서 위험을 돌림 |
| 08 | 이반 / `police_sergeant_ivan` | 현장 경관, 규율·평판 중시 | 경찰서 → 시장 순찰 → 사건 보고 → 귀소 | 법 집행과 개인적 사정의 충돌 |
| 09 | 다리야 / `reader_darya` | 서적을 읽는 도시 주민, 사회적 관심 | 집 → 책방 → 독서 모임/거리 → 귀가 | 문학 해석과 자신이 처한 위치의 차이 |
| 10 | 콘스탄틴 / `senior_clerk_konstantin` | 승진 지향 상급 서기, 권한에 민감 | 관청 → 접수 감사 → 동료 면담 → 퇴근 | 기록의 올바름과 조직의 편의 |
| 11 | 세묜 / `yardkeeper_semyon` | 안뜰 관리인, 관찰력·입단속 | 안뜰 문 → 계단 → 우물/장작 → 세입자 확인 | 세입자의 비밀을 드러낼지 말지 |
| 12 | 마리야 / `laundress_mariya` | 세탁 노동자, 집안 돈을 책임짐 | 공동 방 → 세탁장 → 손님 집 → 장터 | 세탁 품삯과 신분별 대우 |
| 13 | 표도르 / `baker_fyodor` | 새벽 일찍 일하는 제빵공 | 새벽 작업장 → 빵집 → 시장 납품 → 휴식 | 가격, 재료 부족, 상인과 거래 |
| 14 | 나데즈다 / `market_nadezhda` | 시장 좌판상, 흥정에 능숙 | 물품 수령 → 시장 좌판 → 납품처 → 귀가 | 물가·세금·생계, 고객들의 다른 정보 |
| 15 | 가브릴라 / `porter_gavrila` | 강변 짐꾼, 육체 노동자 | 부두 → 창고 → 시장 → 주점 | 고용과 허리 부상, 상인의 권력 |
| 16 | 티모페이 / `coachman_timofey` | 마부/운송인, 길·날씨에 밝음 | 마차 대기 → 도심 운송 → 정차/말 관리 | 돈을 받으면 누구를 먼저 태우나 |
| 17 | 올가 / `housemaid_olga` | 가사 노동자, 집안 내부를 봄 | 하숙/안뜰 → 고용주 집 → 시장 → 귀가 | 주인의 비밀과 일자리 안전 |
| 18 | 아브도티야 / `midwife_avdotya` | 산파, 동네의 신뢰를 얻음 | 집 → 호출받은 셋방 → 약방 → 집 | 의료 비용과 계층별 돌봄 접근 |
| 19 | 야코프 / `apothecary_yakov` | 약방 보조/조제 담당, 원칙적 | 약방 → 공급 창고 → 고객 방문 → 계산 | 의약 정보의 한계·값의 부담 |
| 20 | 스테판 / `print_apprentice_stepan` | 인쇄 견습공, 호기심 많음 | 숙소 → 활자함 → 종이 적재 → 인쇄기 | 어떤 글을 찍고 누구 이름으로 남기나 |
| 21 | 엘리자베타 / `bookbinder_elizaveta` | 제본 노동자, 손재주와 자부심 | 집 → 제본소 → 책방 수령 → 귀가 | 장정·훼손·물품 책임·재고 |
| 22 | 유리 / `scribal_yuri` | 필경사, 글을 아는 것에 자존심 | 거리 광고 → 필사실 → 관청 납품 → 숙소 | 검열된 문서의 사본을 남기는 문제 |
| 23 | 이리나 / `innkeeper_irina` | 여관주인, 정보와 돈에 민감 | 여관 접수 → 시장 구매 → 식당 → 손님 관리 | 신분증/외상·여관의 소문 |
| 24 | 바실리 / `student_vasily` | 학업·사상에 흔들리는 학생 | 숙소 → 서점 → 독서 모임 → 귀가 | 서구주의/슬라브주의 논쟁의 실제 위험 |
| 25 | 류보프 / `teacher_lyubov` | 글을 가르치는 교사, 분별력 | 학교/가정 수업 → 책방 → 학생집 | 누가 배울 수 있는가, 교육의 비용 |
| 26 | 안드레이 / `minor_noble_andrei` | 자금 부족 귀족 청년, 체면 중시 | 자택 → 관청 면담 → 모임/여관 | 신분은 높지만 돈이 없을 때의 선택 |
| 27 | 폴리나 / `landlady_polina` | 셋방 임대인, 이해득실 명료 | 임대집 → 상점 → 밀린 방세 방문 | 방세 독촉과 공동체의 부채 |
| 28 | 루카 / `watercarrier_luka` | 물 공급 노동자, 소문을 많이 들음 | 급수/운하 → 안뜰 → 가정집 → 급수지 | 누가 물을 살 수 있고 누가 직접 길어야 하나 |
| 29 | 클라브디야 / `fishseller_klavdiya` | 생선 판매상, 빠른 판단 | 강변 물량 수령 → 시장 → 정산 → 귀가 | 가격 변동과 보관 시간 |
| 30 | 표트르 / `warehouse_pyotr` | 창고 사무 보조, 일감에 민감 | 강변 창고 → 장부실 → 관청 전달 → 창고 | 물품 기록, 분실 책임, 차용 |
| 31 | 바르바라 / `servant_varvara` | 도심 가정의 하인, 눈치 빠름 | 주인집 → 세탁/시장 → 지시 전달 → 귀가 | 아래 사람만 알고 있는 집안 사정 |
| 32 | 세르게이 / `junior_guard_sergey` | 젊은 경비병, 불안·성실 | 관청 출입문 → 외곽 순찰 → 교대 | 출입 허가와 뇌물·책임 |
| 33 | 로만 / `carter_roman` | 짐마차 운송업자, 실용적 | 시장 창고 → 인쇄소 → 부두 → 마구간 | 인쇄물 이동 및 물자 지연 |
| 34 | 마트료나 / `street_vendor_matryona` | 행상, 날씨·통행에 민감 | 아침 도로 → 상점 앞 → 시장 → 귀가 | 비/눈에 따라 매상과 이동을 바꿈 |
| 35 | 니키타 / `typesetter_nikita` | 활자공, 피로와 속도 압박 | 활자함 → 교정대 → 인쇄기 → 주점/숙소 | 오탈자·검열 재인쇄·노동시간 |
| 36 | 타티야나 / `lodging_tatyana` | 셋방의 독서·재봉을 병행하는 여성 | 셋방 → 책 대여 → 수선 도구 대여 → 모임 | 문해력과 수입을 동시에 얻는 길 |

**중요:** 남녀·연령·계급·직업을 고정 관념으로 성격 결정하지 말 것. 각 캐릭터마다 자신만의 습관, 말투, 논쟁에서 바뀔 수 있는 입장, 실제 친구/거래 상대, 알고 있는 정보와 모르는 정보를 작성. NPC의 특정 직업이 당시 존재했다는 근거와 **그 가상 개인의 사건이 창작이라는 사실**을 분리하라. 시대의 실제 인물/작가를 추가하고 싶으면 `historical_reconstruction`으로 표시하고, 법적 생애/연대/접근권에 맞는 서사 규칙을 적용한다. 실존 인물의 허구 사생활을 사료처럼 단정하지 말 것.

### 3.1 개별 주민의 필수 데이터 — JSON 스키마와 품질 테스트

각 주민은 다음을 개별적으로 작성해야 한다(같은 속성 이름을 채운 것만으로 완료가 아님).

```jsonc
{
  "id":"stable_character_id",
  "fictionality":"FICTIONAL_CITIZEN",
  "displayNameKo":"이름",
  "estateAndRights":{"status":"...","mobility":"...","accessTags":[]},
  "occupation":"...","homeMapId":"real_map_id","workMapId":"real_map_id",
  "needs":{"income":0,"fatigue":0,"safety":0,"socialBelonging":0},
  "persistentPersonalGoals":[{"id":"goal_id","descriptionKo":"구체적 욕구","successCondition":"engine-only","fallback":"..."}],
  "todayGoals":[{"goalId":"...","priority":1,"earliestMinute":420,"latestMinute":1100,"targetId":"existent_object_or_npc","estimatedDuration":30}],
  "schedule":[{"atMinute":480,"mapId":"...","position":{"x":0,"y":0},"activityKo":"일"}],
  "plannerPolicy":{"riskTolerance":0.2,"workPriority":0.7,"socialPriority":0.2,"deterministicSeed":1234},
  "personalKnowledgeIds":[],"witnessedEventIds":[],"privateSecrets":[],"rumorConfidence":{},
  "relations":{},"ideologicalPositions":{},"speechRegister":{},
  "inventory":[],"money":{"unit":"kopeck","amount":0,"sourceBasisId":null},
  "questIds":[],"dayWorkAnimations":[],"portraitAssetId":"...","spriteAssetId":"...",
  "portraitRightsRecord":"...","historicalContextSourceIds":[],"saveSchemaVersion":36
}
```

**위 JSON은 schema illustration, production의 허위 데이터가 아니다.** 돈 액수, 직업명, 접근권, 현실성과 소품은 실제 source verified/author-authorized 창작 구분. 각 인물당 `개인적 목적 2개 이상`, `서로 다른 시간표 목표 4개 이상`, `실제 이동 가능한 장소 3곳 이상`, `다른 시민 2명 이상과 상호 관계`, `일상 세계 인터랙션 2개 이상`, `고유 대화 논점 3개 이상`, `빙의 플레이 시 고유한 선택/활동 1개 이상`, `짧은 개인 생활 퀘스트 1개 이상` 필수. 36명 × 3개 = 108개의 반복된 시스템 대사를 세는 꼼수 금지. 30명 이상 빙의 가능한 경우 해당 인물의 실제 목적과 퀘스트를 실행·완료할 수 있어야 한다.

---

## 4. NPC AI: 목표를 바탕으로 스스로 움직이는 도시

### 4.1 세 계층 simulation, **LLM 비용 0인 NPC 행동**

1. **시간표/작업 기반:** 출근/퇴근/고객 방문/휴식, 가능한 맵과 이동 권한. 평범한 주민 다수는 낮은 비용의 deterministic schedule + idle routine.
2. **상태 기반 목표 선택:** 배달 지연, 비, 작업 완료, 친구 부재, 고객 부탁, 수입/피로 상태에 따라 우선순위 갱신. 작은 utility scorer 또는 GOAP-lite(복잡한 범용 LLM agent 금지). 시뮬레이션의 결과가 실제 위치·소지품·작업 이력에 반영되어야 함.
3. **사회/경제 이벤트:** 사람이 실제 만나면 허용된 소문/상품/대화/편지를 전달. NPC가 독립적으로 역사적 사건을 변경하거나 플레이어 퀘스트를 완료하는 것 금지. 월드 이벤트 로그를 기반으로 재현·정보전파 제한.

필수 FSM states: `AT_HOME, TRAVELING, WORKING, DELIVERING, SHOPPING, SOCIALIZING, WAITING_FOR_STOCK, RESTING, BLOCKED, TALKING, POSSESSED`. 행동은 `Action` 인터페이스로 `preconditions, duration, target, cost, effects, interruptionPolicy`를 가지며 **검증된 reducer가 실제로 적용**한다. NPC의 목적 변화는 `WorldEvent`와 해당 NPC의 관측·지식에 기반. 이웃의 비밀은 마법처럼 공유되지 않는다.

### 4.2 길찾기/충돌/시간 진행

- 현행 `nextNpcStep`, `npcMapRoute`, `advanceWorldTime`를 확장한다. 맵 그래프 6개 이상 지구/실내 8곳을 넘나드는 **타일 단위로 이동하는 실제 경로**와 출입/영업시간/역할 제한. 길/통로는 A*/BFS나 캐시된 경로 그래프, 고정 루틴은 캐시, 막혔을 때만 재계획. 36 NPC가 매 frame 전역 A* 하는 것은 금지.
- **시뮬레이션 시간과 렌더링 분리:** 1 or 5분 가상시간 고정 step 및 부드러운 sprite interpolation. FPS/탭 활성/시스템 속도에 상관없이 같은 seed/행동으로 같은 상태. PC/mobile 적응형 가시거리 렌더링.
- 동적 reserved tiles, 출입문/마차/고객/플레이어 충돌, 두 주민이 좁은 길에서 마주쳤을 때 양보/우회/잠시 기다림, 교착상태 해소 우선순위. 밀집 시장 crowd는 **비충돌 장식군**으로 논리 NPC와 분리할 수 있으나, 빙의 가능한 명명된 36명은 실제 충돌·이동 상태 보유.
- 오프스크린 시뮬레이션은 full path step 대신 요약 ETA/이벤트로 진행하되, 관찰자의 시야로 돌아오면 순간이동처럼 보이지 않도록 일관된 입장/도착 동선. 중요한 주민이 실제로 지구 경계를 통과하는 것을 최소 한 번 플레이 화면에서 관찰할 수 있도록 만들 것.
- `POSSESSED`: 빙의 중 NPC AI 중지, 인물의 목적/상태 인계. 빙의 해제 시 현재 위치·인벤토리/미완료 작업·관계·기억을 보존하여 실제 목표로 복귀. 대화 중/열람 중/일시정지 시 불쾌한 NPC 도주 없음. 배경 복귀 시 catch-up은 사전에 예측 가능한 상태로 재현.
- **필수 NPC 실종 방지:** 퀘스트에 필요한 인물이 다른 생활권으로 이동했을 때 퀘스트 마커가 실제 위치를 추적하거나 시간표/대체 연락을 제공. NPC가 쉬러 갔다고 게임이 영구 정지하지 말 것.

### 4.3 하루를 관찰하면 다른 날이 되고, 1시간에도 변화가 있어야 함

도시의 하루 시간대별 사건: 새벽 납품/빵 굽기 → 출근/시장 준비 → 관청 접수와 인쇄 작업 → 점심 방문·책과 소문 거래 → 오후 배달·반품 → 장터 정리와 귀가 → 저녁 사적 모임/책 읽기. 실제 영업시간/야간 통행은 고증 전에는 단정하지 말고 데이터 필드 `basis` 및 가상화 명시.

시간과 계절·날씨는 게임 진행에 영향을 줄 수 있으나(비에 젖는 종이, 야외 좌판, 걷는 속도), 서사 진행에 필수인 사료와 만남이 영구적으로 차단돼서는 안 된다. 역사 기록·발행일이 아직 도래하지 않았으면 실제로 사용 가능한 날짜까지는 불가.

**검증:** 36명 각각의 `(시작, +30분, +3시간, +12시간)` 상태/현재 목적/타일/작업 결과. 고정 3 seed × 하루 1440분 빠른 simulation, 인물끼리 겹침 0(예외: 비충돌 배경 crowd), 막힌 목적지 자동 복구, 화면 안 순간이동 0, 빙의 중 이중 동작 0, 12회 이상의 NPC 간 교류가 서로 다른 이벤트로 관찰 가능. 자율활동 event가 역사적 immutable outcome을 건드리지 않는지 검사.

---

## 5. 오픈월드의 **콘텐츠 밀도**: 생활, 인간관계, 사건이 실제 연결되어야 함

### 5.1 주민 개인 경험

30명 이상 빙의 가능한 조건에서 **모든 빙의 가능 인물마다 1개 이상의 독자적 3단계 생활 퀘스트**를 완주 가능하게 한다. 최소 구성: `당면한 문제(자기 신분의 이해관계) → 관찰/대화/문서·행동 2가지 이상 → 자기 선택의 결과와 후속 단서`.

추가로 **10개 이상의 인물 간 연쇄 퀘스트**: 물품·편지·소문·생계·책이 주민 사이로 이동하면서 서로 다른 직업의 관점을 드러내도록 한다. 예시:

- **인쇄·유통 연쇄:** 교정공 → 인쇄 견습 → 제본공 → 서점상 → 독자 → 관청/검열의 다른 해석. 자료 공개일 준수.
- **생계 연쇄:** 안나의 품삯 → 세입자/집주인과 장부 → 시장 가격 → 실제 입수 가능한 물품 → 후속 대화. 가상의 코페이카 액수로 시대 경제 통계 주장 금지.
- **우편 연쇄:** 파벨 → 창고/마차 → 수신인 → 분실/지연 → 공식 기록. 실제 전달자만 문서 내용에 접근.
- **사상 연쇄:** 서점/학생/독자/문학 모임에서 농노제·검열·슬라브주의와 서구주의를 논의하되, 인물별 지식과 가치관·생활의 비용에 의해 견해가 다름. 단순 양자택일 표지판 X.
- **도시 풍속 연쇄:** 하숙/수위/세탁공 → 그날의 사정 → 소문이 잘못 전달되어 생기는 갈등 → 확인/해결. 신문이나 저자에게 언급된 실제 사건과 허구 동네 생활은 명확히 구분.

**대형 역사적 장면 5개 이상**: 역사적 사건이 본래 발생한 시점·장소·전달 경로에 맞는 사건 도입/실제 사료/2+ 관점/선택/결말을 갖춘다. 기존 프로젝트에 있는 출판·검열·개혁 논쟁·1849 수사 등의 검증된 사건을 재사용하고 source IDs를 다시 감사. 1847 도심에서 1849 사건을 이미 알고 말하거나 1861년 농노해방 결과를 아는 대사 금지.

개인 생활 퀘스트가 모두 메인 엔딩을 바꾸지는 않는다. **생활/관계/이념/역사적 행동**을 구분하고, 중요한 관계 이벤트/사료를 얻은 경우에만 기존 5엔딩 규칙과 연결. 신규 퀘스트 완료가 기계적으로 사상 점수를 증가시키면 FAIL.

### 5.2 자유 탐험 보상

- 문·가판·수선/인쇄 소도구·자료·책·장부 등을 조사하면 작은 발견/다른 인물의 의견/배경 사건이 나오도록. 유효한 source anchor가 있는 역사적 사실과 설정 텍스트를 `FACT | SOURCE_PARAPHRASE | FICTIONAL_LIFE`로 분리.
- **지도/수첩/단서 연결:** 빙의자 현재 개인 목표, 자유 탐색 중 발견된 단서, 공적 역사 사건, 5엔딩 진행과의 관계를 구분. GPS식 화살표만 제공하지 않고 인물과 물건을 이용한 실제 경로 찾기.
- 같은 사건을 최소 **세 계층**(노동자, 문서/관청, 출판/독자)에서 다르게 볼 수 있어야 한다. 한 관점에서 본 원문/비밀이 다른 캐릭터로 자동 이전되면 FAIL.
- 대화량은 남긴 로그의 글자 수만으로 확보하지 않는다. 인물별 3개 고유 논쟁 주제, 생활 사건 관련 실제 2~3턴 교환, 선택 후 다른 반응, 시각적 행위를 포함해야 콘텐츠 PASS.

---

## 6. 1840년대 상트페테르부르크 역사 복원 — 실재 자료와 그림의 구분

**반드시 다음 실제 참고 자료를 우선 조사하고 케이스/시각/지리 근거로 manifest에 삽입:**

1. 러시아 국립도서관 **19세기 페테르부르크 지도 컬렉션**: https://expositions.nlr.ru/eng/ex_map/mozaika_Saint-Petersburg/plans_19_century.php ; 1846년 군사측량국 역사 지도(1700~1840) 등. 1847 도로는 가장 가까운 **1840 지도/기존 시기 기록**과 교차 확인.
2. НЭБ **Н. И. Цылов, *Атлас тринадцати частей С.-Петербурга* (1849)**: https://rusneb.ru/catalog/000200_000018_RU_NLR_BIBL_A_011958332/ . 이후 시점 자료이므로 1847에 있었다는 직접 증거가 아닌 회고적 비교 자료.
3. 대통령 도서관 **이반 푸시카료프, *Путеводитель по Санктпетербургу и окрестностям его* (1843)**: https://www.prlib.ru/item/441202 . 도로·시설·생활권·명칭 후보 조사.
4. 대통령 도서관 **1845 *Физиология Петербурга* (네크라소프 편집)**: https://www.prlib.ru/item/1327533 . 수위/거리 음악가/인쇄·빈민 생활 등의 **문학적 도시 풍속 묘사**; 대표성 있는 전체 도시 통계가 아니라 문학·논평임을 반드시 표시.
5. 러시아 박물관 **1840년대 풍속 수채화/그림**: https://rusmuseumvrm.ru/online_resources/art_gallery/spb._gorod_i_gorozhane/index.php?lang=en&p=803&page=2&ps=60&show=alpha&t=0 . 카를 콜만 1842년 마부 고용, 얼음 운반, 1840년 비 오는 거리 등 도시 행동/옷/물건의 시각적 참고. 이미지 이용권 재검증.

**각 환경/에셋/직업 데이터 항목의 증거 표기:** `eraRange, locale, primarySourceId, sourceType(PERIOD_MAP | PERIOD_PAINTING | PERIOD_TEXT | MODERN_SCHOLARSHIP | LATER_REFERENCE | CREATIVE_RECONSTRUCTION), sourceUrl, page/Folio, visualFeature, confidence, rights, creditedArtist, gameTransformation`.

사료가 진짜 있는 경우: 실제 문구를 원문·한국어로 나란히 Reader에. 도시 소품 고증에 **창작 도트 에셋**을 만든 경우: `CUSTOM_ASSET_INSPIRED_BY_PERIOD_SOURCE`로 명시. 실제 1847 사진처럼 속이는 이미지는 금지. 단, 그림·삽화는 권한/해상도를 확인해 배경 참고 또는 직접 사용 가능. 1850년 이후 발명/건물/의복/교통을 1847에 소급하지 않는다.

실제 역사성과 문학적 재구성을 혼동하지 않는다. `Цылов 1849`, `Пушкарёв 1843`, `Физиология Петербурга 1845`는 목적에 따라 다른 증거 등급을 가진다. 특정 인물의 '생활비 10코페이카' 같은 숫자는 출처가 없으면 역사적인 임금으로 단정하지 않는다. 스스로 찾을 수 없는 사항은 `UNVERIFIED_RECONSTRUCTION`으로 표시하고 핵심 사료의 직접 인용처럼 보여주지 않는다.

---

## 7. 실제 에셋 제작 계획 — 도트 RPG에서 볼 가치가 있어야 함

**실제로 파일을 생성하고 게임에 연결한다.** CSS 사각형이나 의미 없는 문양으로 실제 물건을 대체하거나 36명 모두 동일 스프라이트 색상 변경만 하는 것은 실패. 사용 가능한 기존 에셋·그림 생성 도구·직접 픽셀 드로잉 라이브러리/스프라이트 편집기를 조사한 뒤 역할별 outline/의복/색채/머리·소품을 다르게 제작한다. *출처 불명 이미지를 무단 재배포하지 않는다.*

### 최소 자산 세트

- **주민 36명 식별 가능한 도트 스프라이트:** 최소 4방향 × 걸음 3프레임(가능한 품질 목표), 기본 16×24 또는 24×32 타일을 현재 렌더러 기준으로 검증. 희귀 복장/직업 도구, 체형·색·모자·유니폼 차별화. 36명 모두 독립 character identity + sprite mapping. 품질·해상도가 안 맞으면 맵 scale/atlas 규격부터 안정화.
- **빙의 가능 30명 이상의 식별 가능한 상반신 초상/리액션:** 정적 1장도 가능하되 누가 말하는지 즉시 구별. 품질 낮은 36개 포스터보다 실제 게임용 표정·프레임의 일관성 우선. 기존 검증된 초상 보존.
- **건물/환경 타일 최소 60종:** 돌/진창/기초 벽·문/창·지붕/점포 전면/가판/운하/돌다리/선착장/안뜰/오래된 실내 바닥/조판·제본·우편·세탁·시장 가구. `terrain`, `solid`, `occlusion`, `interaction` 레이어 분리.
- **생활 소품/상호작용 시각 자산:** 책/신문/편지/돈 주머니/빵/바구니/말/마차/동전/잉크/문서함/장부/활자/실/의복, 실제 픽셀 아트와 상호작용 상태를 매칭.
- **분위기 변화:** 아침/저녁/비/겨울 등 핵심 장면에 저비용 색상·환경 차이를 주되, GPU/저사양 모바일에 적합. 원근감/일조/날씨가 실제 시대와 맞지 않으면 창작 계절 배경이라고 구분.
- **큰 원문 Reader:** 3종 이상(신문·책·공문/편지) 현재 V35 구현을 유지하고 에셋 확대에 가독성 상실 없는지 검증.

모든 에셋은 `rpg/assets/ASSET_PROVENANCE.json` 확장과 `ASSET_USAGE_V36.csv`, 파일 크기/압축/저작권/생성 방법/최종 렌더링 캡처 증거. `texture atlas`와 캐싱을 우선해 모바일 로딩 부담 억제. 얼굴/의복이 화면에서 도트로 구분되는지 독립 리뷰어가 실제 1440×900/390×844 화면에서 눈으로 판단.

---

## 8. 성능 / 경제 / 보안 / 저장

- 36 active city agents + 6지구에서 별도 프레임의 A* 전수 호출 금지. **scheduled/utility decisions coarse tick(예: 1–5 가상분), animation interpolated render**. 실제 36명 중 같은 맵의 관찰 대상 8–16명 정도 렌더해도 무리 없도록 viewport culling. 나머지 동네 주민은 추적 가능한 background simulation.
- 워커 계산/시뮬레이터는 브라우저 메인 스레드를 오래 막지 않게 하되 무조건 Web Worker를 추가하지 않아도 된다. 실제 profiler에서 복잡한 경로 계산이 병목이면 별도 워커로 이동. 고유 맵 리소스 에셋 크기 및 각 지구 전환 로딩 시간 측정.
- 로컬 `GameState`가 authoritative for NPC schedules/quest actions. AI LLM 호출은 플레이어가 **직접 말을 건 1명의 NPC 대화 턴**에서만, 보안을 통과한 서버 context로 제한. 36명 자율행동에 호출하면 비용 폭증하므로 금지. AI가 응답해도 실제 스탯/역사/퀘스트는 reducer로만 변경.
- 새 기능은 **Vercel-only** same-origin API contract. `OPENAI_API_KEY` / session keys never emitted client-side. rate limit이 단일 ephemeral process Memory Map인지 검사. 공개 배포에서 전역 비용/세션 제어가 유효하지 않으면 반드시 hardening 및 off-line fallback. 유료 실제 API 테스트 전체 1–3턴 한정.
- save schema bump `V36`, 기존 `v33-rpg-save` 마이그레이션 테스트(이전 12개 이상 대표 save fixture, invalid save 안전 처리, 사용자 데이터 강제 덮어쓰기 금지). 캐릭터 ID/기존 quest result/source IDs 보존. 36 NPC의 현재 위치, 현재 task, planned route, timer, inventory, relationship, knowledge, seed, schedule progress 모두 저장/복구; 오래 떠난 뒤 재접속 시 과도한 소급 시뮬레이션 cap.
- 브라우저 실제 퍼포먼스 목표(환경과 함께 기록): 36명 10분 현실 조작 중 **눈에 띄는 조작 불능/장시간 스톨 0**, 390×844에서도 대화/이동/독서 전환 가능. 시스템 사양을 기록한 데스크톱 p95 frame interval 33ms 이내를 목표로 삼되 실제 사용자 GPU 검증 없으면 'GPU_UNVERIFIED'. 임의의 가짜 측정치로 통과 금지.

---

## 9. 수행 Phase — **늘어난 범위를 끝까지 구현하되 골드 vertical slice로 품질 고정**

### PHASE 0. Baseline and source investigation
HEAD/브랜치/기존 코드/맵/퀘스트/NPC/배포/에셋 inventory. 상기 역사 자료 실제 검토 및 시간/거리의 한계 확인, 새 산출물 맨 위에 baseline SHA. 기존 V35 미적용인 경우 우선 현재 콘텐츠를 동기화하고 무분별하게 이전 메인 기능을 덮어쓰지 않음.

### PHASE 1. Historical map kit
1840/1843/1849 지도 및 1840년대 그림에서 건물·도로·표지·골목/안뜰 특징을 구체적 source → game asset ledger로 연결. 6지구/8실내 맵 graph 완성; 최소 2지구(네프스키·시장 또는 안뜰·인쇄소)를 처음에 실물로 만들고 서로 왕복 가능한지 확인. 이후 나머지 동네 확장. **단순 이미지로만 존재하는 맵은 완료 아님.**

### PHASE 2. NPC goal simulation proof (6→12)
기존 6명 움직임 테스트 검증 후 12명으로 확장. 실제 목적 변화, 상호작용, 좁은 골목 교차, map transfer, 위치 추적, 빙의/해제, 작업 수행 증거를 얻음. 시뮬레이션이 기존 퀘스트를 자동 완료하지 않음을 확인. 두 동네에 주민들이 실제로 생활하는 브라우저 화면/로그.

### PHASE 3. Visual and interaction kit
도트 에셋 제작 파이프라인과 12명 스프라이트·초상·두 지구 타일·생활 오브젝트. 역사 이미지/창작물의 rights & provenance. 원문/한글 reader·quest guidance와 조립해 첫 usable play. 렌더 결과가 저질 placeholder라면 리소스 수정/2차 refinement.

### PHASE 4. 36 resident rollout (6×6 batches)
36명 전원 데이터·구체적 목적·시간표·상호 관계·행동·빙의 접근성·초상/스프라이트·생활 퀘스트를 **6명씩 배치 확장**. 배치마다 static schema, path feasibility, 1게임 시간 교류, 실제 빙의와 퀘스트 완주, headless screenshot, 최종 current state와 이동 로그 검사. 일정이 확실히 다른 NPC들을 다른 장소에 분산. 36명 중 30명 이상 실제 플레이 가능한 빙의 대상. 각 batch의 문제가 해결되지 않았는데 숫자만 다음으로 늘리지 말 것.

### PHASE 5. Living economy & social network + actual quests
30+ 개인 생활 퀘스트, 10+ 인물 연쇄 퀘스트, 5+ 핵심 역사 사건, 70+ interaction, 12+ observable world change. 사건/관계/물자/소문의 정보 전달과 추적, 직접 원문과 큰 독서기, 사상적 토론. existing 5 endings에 유의미한 선택만 연결. 같은 일 반복/정보가 없음/맵 이동만으로 퀘스트 완료 처리되는 임시 데이터 제거.

### PHASE 6. Open-world UX and performance
첫 빙의 전후 상호작용형 튜토리얼, '지금 인물이 바라는 것' vs '역사 사건' vs '자유 활동' 표, J 수첩, 탐험 지도, 구역별 NPC last-seen/schedule hints, 목적지의 이동/영업상황 표시. **미니맵에 좌표 숫자만** 나열하거나 대화창에 모든 콘텐츠를 모으지 않는다. 1440×900/1366×768/390×844/360×800, 이동/자료/빙의/대화/맵전환/밤시간/5개 엔딩 화면을 실제 캡처하여 사람이 눈으로 검토. 병목/불친절한 UI 수정.

### PHASE 7. Adversarial QA + release evidence
서브에이전트 기본 1명: 구현자가 만든 FAIL/PASS표를 보지 않고 실제 게임을 실행해 **(a) 도시가 살아 있는지, (b) 같은 장소/인물의 반복 편법이 있는지, (c) 러시아 역사성과 시대 시각 요소, (d) 빙의한 인물 목적·대화의 진정성, (e) 5엔딩, (f) 소스와 판권, (g) 모바일 성능**을 비판적으로 검사. 추가 인력 필요한 경우 최대 2명까지. P0/P1 문제 수정→새 빌드/새 스크린샷으로 재검증 후 final release. 인간 참가자가 없으면 `HUMAN_PLAYTEST=PENDING`.

---

## 10. 자동 검증 계약과 바꾸면 안 되는 불변식

**필수 `npm run acceptance:v36`** (스크립트가 없다면 새로 작성, 기존 테스트 병합):

1. `npc-roster`: 신규 구분되는 **36 active city agents / 30 possessable / literary separate**, stable IDs, real sprite/portrait files, licensed asset records, quest/context 100% 유효. 모든 인물 active goal, 최소 4 schedule transitions, 3 reachable locations, 2 관계, 2 interactable work actions, 1 personal quest.
2. `map-and-path`: 6 district connected, 8 usable interiors, 70 interactable scene objects with meaningful effect, all 36 NPC home/work targets reachable without blocked-movement, allowedMaps consistent, historically implausible future props in 1847 0 confirmed.
3. `npc-sim`: fixed seed 3 × 24h simulated, crossings without double occupancy, missing essential NPC 0, in-view teleport 0, 36 actual independent activities, dialogue pause, possession handoff, map transit, load/replay determinism, bounded runtime.
4. `openworld-content`: 30+ unique **complete** personal 3-stage quest, 10+ nontrivial social chains, 5+ historical event interactions, 12+ visible world changes, 60+ distinct asset types. Scene/quest/reader actual interaction tests. Only valid source texts are historical source counts.
5. `social-knowledge`: no NPC has supernatural knowledge, rumor transfer requires actual interaction, letter source visible only to actual recipient/reader, possessed host keeps personal knowledge, real historical outcomes immutable.
6. `free-ai-dialogue`: at least 6 main characters and 8 historically meaningful conversation scenarios across class boundaries; Vercel-only mock schema/state safety, 429/timeout/offline fallback; no scripted false historical quotation; no API calls in autonomous NPC simulation.
7. `ending-and-regression`: all 5 endings reached from legitimate play states and 5 mixed-choice paths, existing V35 reader/quests/journal/literary world/exam/save tests and historical provenance checks passed. Changing environment schedule cannot silently change immutable endings.
8. `browser-qc`: **fresh dist-v33** at 4 viewport sizes, 2 populated districts, one full individual quest per class group, one real history source reading, 30+ possession availability, 36 NPC activity simulation, five endings, wait/reload/return, screenshot manifest and review.
9. `asset-and-build`: actual image existence/hash/size, sprite atlas coordinates valid, no unreachable assets, no copyright unknown republishing, clean `npm ci` → `npm run build:v33` → Vercel-style deployed static + same-origin API mock smoke.

**새로운 수치가 작업에 불합리한 경우 자체적으로 기준을 내려서 PASS 처리하지 말고 실제 미달 개수를 보고한다.** '36명이 다 각자의 목적대로 걷는다'를 만족한 것과 '35개 캐릭터가 고정 idle, 1명만 움직인다'는 결코 같은 상태가 아님.

---

## 11. 필수 최종 산출물과 완료 플래그

다음 증거가 실제로 존재해야 한다:

```text
RUSSIAN_LIVES_V36_OPEN_WORLD_EVIDENCE.zip
  README_RUN_AND_VERIFY.md
  BASELINE_HEAD_AND_DIFF.md
  src/                      # 변경 코드/실행에 필요한 관련 전체 소스
  config/                   # vercel.json, package/lock, environment example w/o secrets
  maps/                     # map graph + all actual playable maps
  npc/                      # 36 role/persona/schedule/goal/data, test traces
  assets/                   # original pixel sprites/portraits/props with source/rights manifest
  quests/                   # 30+ personal, 10+ social chains, historical quests
  historical/               # map, art, document source ledgers and dated evidence
  qa/                       # test commands, stdout/stderr, performance traces
  qa/36_NPC_DAILY_SCHEDULES.csv
  qa/36_NPC_24H_REPLAY.json
  qa/QUEST_COMPLETION_MATRIX.csv
  qa/MAP_NAVIGATION_AND_ACCESS.json
  qa/ASSET_REVIEW_MANIFEST.csv
  qa/INDEPENDENT_REVIEW.md    # review unavailable => accurate UNAVAILABLE
  screenshots/              # actual game all 4 viewports, individual/social cases
  V36_FINAL_STATUS.md
  manifest.sha256
```

**클린 ZIP 추출 → source 파일 검증 → build → 검증 실행**. README에 Vercel 프로젝트 root/output/public API route와 안전한 환경변수(`OPENAI_API_KEY`, 비공개 session secret 등)를 정확하게 기입하되 값은 비밀이다.

최종 진실한 상태 보고:

```
V36_36_ACTIVE_CITIZENS: YES|NO
V36_30_POSSESSABLE: YES|NO
V36_NPC_INDEPENDENT_DAILY_GOALS: YES|NO
V36_6_DISTRICTS_8_INTERIORS: YES|NO
V36_ASSETS_AND_PERIOD_EVIDENCE: YES|NO
V36_OPENWORLD_CONTENT: YES|NO
V36_5_ENDINGS: YES|NO
V36_VERIFIABLE_BUILD: YES|NO
V36_BROWSER_QA: YES|NO
V36_GPU_PERFORMANCE: VERIFIED|UNVERIFIED
INDEPENDENT_REVIEW: PASS|FAIL|UNAVAILABLE
HUMAN_PLAYTEST: DONE|PENDING
V36_COMPLETE: YES|NO
BLOCKERS: exact evidence and incomplete scope
```

`V36_COMPLETE=YES`는 실기동 36명, 빙의 30명 이상, 모두 차별화된 목표/일과/경로, playable social/individual quests, 사실 근거와 에셋, 모든 핵심 회귀가 입증될 때만. 추가 인물 자체가 증명/성능 실패를 유발하면 더 많은 가짜 등장인물을 추가하지 말고 해결될 때까지 loop. 권한·사료·실제 키/외부 네트워크 없음을 근거로 우회 성공 주장 금지. **배경 인구 crowd와 36명 active NPC는 명확하게 구분한다.**
