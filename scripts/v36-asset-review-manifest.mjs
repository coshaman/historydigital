import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const residentData = JSON.parse(await readFile(path.join(root, 'rpg/data/city-districts-v36.json'), 'utf8'));
const sourceRegister = JSON.parse(await readFile(path.join(root, 'docs/v36/historical-map-source-register.json'), 'utf8'));
const provenance = JSON.parse(await readFile(path.join(root, 'rpg/assets/ASSET_PROVENANCE.json'), 'utf8'));
const sourceMap = new Map(sourceRegister.sources.map(source => [source.sourceId, source]));
const reviewedResidents = {
  market_nadezhda: {
    sourceId: 'V36-ART-LABASTIDE-EGG-SELLERS-1845',
    features: '두건; 긴 겉옷/앞치마; 긴 치마; 손·등 바구니',
    transformation: '16x24 원작 픽셀로 두건·치마/앞치마 실루엣과 바구니 소품만 반영; 색상은 창작',
    limits: '가상 인물의 실재나 1847년 모든 여성 상인의 복식·정확한 색상/재단을 입증하지 않음; 박물관 이미지 배포 권리 미취득',
    screenshot: 'docs/v36/current-audit/screenshots/market-nadezhda-costume-1440.png',
  },
  junior_guard_sergey: {
    sourceId: 'V36-ART-LABASTIDE-GATEKEEPER-1845',
    features: '짧은 단추식 겉재킷; 헐렁한 바지; 각반과 튼튼한 신발; 옆에 든 챙 넓은 모자',
    transformation: '16x24 원작 픽셀에 재킷·헐렁한 바지·장화와 손에 든 모자 실루엣 반영; 팔레트는 창작',
    limits: '도판은 문지기를 그렸으며 경찰·군복, 계급장, 실제 경비병의 복식이나 정확한 색을 입증하지 않음; 박물관 이미지 배포 권리 미취득',
    screenshot: 'docs/v36/current-audit/screenshots/junior-guard-sergey-costume-1440.png',
  },
  fishseller_klavdiya: {
    sourceId: 'V36-ART-KOLLMAN-FISH-SELLERS-1830S',
    features: '머리를 감싼 두건; 긴 갈색 겉옷; 몸을 낮춘 강변 생선 장수; 옆의 큰 통과 바구니',
    transformation: '16x24 원작 픽셀에 두건과 긴 겉옷 실루엣 반영; 이동을 위해 서 있는 자세로 재구성; 색은 수채화에서 제한적으로 참고',
    limits: '1830년대 장면의 인물이 클라브디야라는 뜻이 아니며 1847년 복식의 정확한 형태·색·좌판 배치를 증명하지 않음; 박물관 이미지 배포 권리 미취득',
    screenshot: 'docs/v36/current-audit/screenshots/fishseller-klavdiya-costume-1440.png',
  },
  carter_roman: {
    sourceId: 'V36-ART-COLLMANN-ICE-DELIVERY-1842',
    features: '말이 끄는 얼음 수레; 수레 곁의 남성 노동자; 헐렁한 겉옷과 바지의 큰 윤곽',
    transformation: '16x24 원작 픽셀에 모자와 긴 겉옷 실루엣만 반영; 수레 장면의 색과 세부 복식은 복제하지 않음',
    limits: '1842년 도판은 로만이라는 인물이나 1847년의 정확한 복식·마구·수레 구조를 증명하지 않음; 박물관 이미지 배포 권리 미취득',
    screenshot: 'docs/v36/current-audit/screenshots/carter-roman-costume-1440.png',
  },
  coachman_timofey: {
    sourceId: 'V36-ART-COLLMANN-HIRE-CAB-1842',
    features: '말이 끄는 마차와 마구; 모자와 긴 겉옷을 입은 남성들; 고삐를 다루는 인물',
    transformation: '16x24 원작 픽셀에 모자·긴 겉옷 실루엣과 고삐 소품만 반영; 겨울 풍경·마차는 복제하지 않음',
    limits: '1842년 그림은 티모페이라는 인물이나 1847년의 정확한 복식·마구·마차·날씨를 증명하지 않음; 박물관 이미지 배포 권리 미취득',
    screenshot: 'docs/v36/current-audit/screenshots/coachman-timofey-costume-1440.png',
  },
  street_vendor_matryona: {
    sourceId: 'V36-ART-LABASTIDE-HAWKER-TRAY-1845',
    features: '남성 행상의 허리띠에 고정된 넓은 진열대; 여러 층의 쟁반과 매달린 소품',
    transformation: '16x24 원작 픽셀에서 휴대용 진열 구조만 참고해 허리 높이의 쟁반·상품 묶음으로 재구성',
    limits: '도판 인물은 남성이며 마트료나의 복식·정체성을 입증하지 않음; 쟁반 치수·재료·상인들의 보편적 복식이나 위치도 증명하지 않음; 박물관 이미지 배포 권리 미취득',
    screenshot: 'docs/v36/current-audit/screenshots/street-vendor-matryona-costume-1440.png',
  },
  baker_fyodor: {
    sourceId: 'V36-ART-LABASTIDE-KALACH-SELLER-1845',
    features: '엑스자 다리의 길거리 탁자; 둥근 빵 여러 개; 탁자보와 아래 바구니',
    transformation: '16x24 원작 픽셀의 둥근 빵·쟁반 단서만 작은 휴대용 빵 묶음으로 반영',
    limits: '도판 인물은 길거리 판매자이지 제빵공 표준 복식이나 푀이도르의 정체가 아님; 조리법·오븐·정확한 빵 단면을 입증하지 않음; 박물관 이미지 배포 권리 미취득',
    screenshot: 'docs/v36/current-audit/screenshots/baker-fyodor-costume-1440.png',
  },
};
const ids = [...new Set(residentData.districts.flatMap(district => district.residentIds ?? []))].sort();
assert.equal(ids.length, 36);
const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const rows = [];
for (const id of ids) {
  const character = JSON.parse(await readFile(path.join(root, 'rpg/characters', `${id}.json`), 'utf8'));
  const sourceId = character.sprite.visualReferenceIds?.[0] ?? '';
  const source = sourceId ? sourceMap.get(sourceId) : null;
  const asset = provenance.assets.find(item => item.path === `rpg/${character.sprite.file}`);
  assert.ok(asset, `${id} sprite has an asset provenance record`);
  if (sourceId) {
    assert.ok(source, `${id} sprite source ID resolves`);
    assert.ok(asset.sourceIds?.includes(sourceId), `${id} asset provenance includes its source`);
  }
  const review = reviewedResidents[id]?.sourceId === sourceId ? reviewedResidents[id] : null;
  rows.push([
    id,
    character.displayNameKo,
    `rpg/${character.sprite.file}`,
    `rpg/${character.portrait.file}`,
    review ? 'LIMITED_SOURCE_INSPIRED_REVIEW' : 'NOT_VISUALLY_REVIEWED',
    sourceId,
    source?.sourceUrl ?? '',
    review?.features ?? '',
    review?.transformation ?? '',
    review?.limits ?? '이 인물의 복식에 대한 시각 출처 검토가 남아 있음; 역사적 복식 근거를 주장하지 않음',
    review?.screenshot ?? '',
  ]);
}
const headers = ['character_id','display_name_ko','sprite_path','portrait_path','review_status','source_id','source_url','observed_source_features','game_translation','limitations','screenshot'];
const target = path.join(root, 'qa/ASSET_REVIEW_MANIFEST.csv');
await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, `${headers.map(quote).join(',')}\n${rows.map(row => row.map(quote).join(',')).join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ status: 'PASS_WITH_UNREVIEWED_ASSETS', rows: rows.length, limitedSourceInspiredReviews: rows.filter(row => row[4] === 'LIMITED_SOURCE_INSPIRED_REVIEW').length, notVisuallyReviewed: rows.filter(row => row[4] === 'NOT_VISUALLY_REVIEWED').length, path: 'qa/ASSET_REVIEW_MANIFEST.csv' }, null, 2));
