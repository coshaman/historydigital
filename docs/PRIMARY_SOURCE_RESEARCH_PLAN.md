# 실제 러시아 고증 조사 — V37 근거 구분

여기 제공하는 주민과 사건 데이터는 **게임 설계 초안**이다. 개별 인물은 실존했다고 주장하지 않으며, 사건 45개도 대부분 '당대 있을 법한' 재구성이지 개별 실증 기록이 아니다. 아래 자료를 실제 페이지/호수까지 대조해 확정할 것.

1. **1845 《Физиология Петербурга》**: 러시아 대통령도서관 https://www.prlib.ru/section/1327906 (도시 빈민·수위·거리 악사와 노동 묘사). 러시아 풍속 문학으로서 생생하지만 문학적 과장/작가 관점은 역사 통계와 구분.
2. **1845 저작 안내**: 상트페테르부르크 백과사전 https://encspb.ru/object/2804027585?dv=2853931022&lc=en (저자, 출판·구성 확인).
3. **신문 《Северная пчела》**: 실제 호 목록 https://www.nplg.gov.ge/papereu/en/browse/000482/ (선정 호의 원문과 날짜·권리·접근성 확인. 페이지 자체에 1838–1839 스캔만 있어 이를 1847 원문이라 주장하지 말 것.)
4. **1849 페트라솁스키 사건**: 상트페테르부르크 백과사전 https://www.encspb.ru/object/2855725778?dv=2853951676&lc=en; 관련 연구 https://journals.rcsi.science/2409-5788/article/view/279947. 1849-04 체포와 1849-12-22 사형식·감형 발표 구분.
5. **《죄와 벌》 문학 세계**: 케임브리지 대학 도서관 전시 https://exhibitions.lib.cam.ac.uk/crimeandpunishment/artifacts/02/ — 1866 연재, 1867 단행본. 라스콜리니코프를 1847년 거리에서 실제 시민으로 표현하면 안 됨.
6. **《카라마조프가의 형제들》**: 도스토옙스키의 후기 장편과 설정 연대에 맞춘 별도 문학층. 알료샤의 실제 작품 내 신분/나이/행동 및 판본 확인 없이 1840년대 거리로 이동시키지 말 것.
7. **표트르 대제**: 17세기 말~18세기 초 제위; 1840년대 니콜라이 1세 치세와 동시 등장 불가. 황제와 궁정/사회제도는 당시 기록을 따르는 18세기 별도 체험.

## 각 조사 결과 필수 열
`claimId; claim; era; sourceTitleRu; creator; publicationDate; eventDate; datePrecision; archiveOrEdition; volumeIssuePageFolio; stableUrl; sourceKind; inWorldAvailabilityDate; ruExact; koReviewed; evidenceClass; rights; scanVerified; notes`

증거 등급:
- `DOCUMENTED_HISTORICAL`: 원문·날짜·판본 직접 교차 확인
- `CONTEMPORARY_DESCRIPTION`: 당대 기록이 묘사한 일반적 관행
- `LITERARY_RECONSTRUCTION`: 문학 속 상황의 체험(실제 역사로 표기 금지)
- `PLAUSIBLE_FICTION`: 사료에 근거한 허구 개인·일상 사건
- `MODERN_COMMENTARY`: 현대 연구·기록관 설명
- `UNVERIFIED`: 근거가 없는 개발 초안, 본편 내 실제 1차 사료로 사용 금지

시뮬레이션 내부의 임금·음식값·방세는 반드시 연도/장소/출처를 확인하거나 `BALANCE_ESTIMATE`라고 분명히 기록한다. 표면상 실제 역사 경제수치로 둔갑시키지 않는다.
