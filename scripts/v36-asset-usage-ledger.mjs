import { readFile, writeFile } from 'node:fs/promises';

const file = 'rpg/assets/ASSET_USAGE_V36.csv';
const definitions = [
  ['MASONRY_DARK_BLOCK','짙은 블록 석재 표면','CITY_MASONRY'],
  ['MASONRY_WORN_SLAB','닳은 넓은 석재 표면','CITY_MASONRY'],
  ['DRAIN_STONE_INSET','배수구가 놓인 석재','CITY_MASONRY'],
  ['STONE_EDGE_COURSE','벽과 바닥을 잇는 돌 띠','CITY_MASONRY'],
  ['TIMBER_FLOOR_DARK','어두운 널판 바닥','INDOOR_TIMBER'],
  ['TIMBER_FLOOR_SCRAPED','긁힌 널판 바닥','INDOOR_TIMBER'],
  ['BRICK_FACADE_RED_A','붉은 벽돌 외벽 변형 A','BRICK_FACADE'],
  ['BRICK_FACADE_RED_B','붉은 벽돌 외벽 변형 B','BRICK_FACADE'],
  ['PLASTER_WALL_PALE','밝은 회벽 표면','INDOOR_WALL'],
  ['WINDOW_BLUE_GLASS','푸른빛 유리창','WINDOW_FIXTURE'],
  ['WINDOW_WARM_LIT','불빛이 비치는 창','WINDOW_FIXTURE'],
  ['CUPBOARD_GREEN_DOOR','녹색 수납장 문짝','HOUSEHOLD_FURNITURE'],
  ['DOOR_OFFICE_DARK','짙은 목재 출입문','DOOR_FIXTURE'],
  ['BOOKSHOP_SIGN_CYRILLIC','키릴 문자 책방 표지','SHOP_SIGN'],
  ['HANGING_TRADE_SIGN','걸이식 상점 표지','SHOP_SIGN'],
  ['WINDOW_DOUBLE_PANE','두 짝으로 나뉜 창','WINDOW_FIXTURE'],
  ['ORDER_SLIP_MARKED','표시가 남은 주문 쪽지','PAPER_GOODS'],
  ['STOOL_LOW_WOOD','낮은 목제 걸상','HOUSEHOLD_FURNITURE'],
  ['CHAIR_WRITING','등받이 의자','HOUSEHOLD_FURNITURE'],
  ['BOOKSHELF_TALL','세로 칸 책장','BOOKSHOP_FURNITURE'],
  ['INVOICE_SINGLE','한 장짜리 계산서','PAPER_GOODS'],
  ['TABLE_WRITING','필기용 탁자','HOUSEHOLD_FURNITURE'],
  ['SHELF_NARROW','좁은 벽 선반','SHOP_FURNITURE'],
  ['BOOK_BUNDLE_CLOSED','묶어 둔 책 더미','BOOKSHOP_GOODS'],
  ['BENCH_SHORT','짧은 나무 벤치','HOUSEHOLD_FURNITURE'],
  ['WINDOW_SHUTTERED','덧문이 달린 창','WINDOW_FIXTURE'],
  ['DRAWER_SMALL','작은 서랍장','SHOP_FURNITURE'],
  ['DOOR_PANELED','판재를 덧댄 목문','DOOR_FIXTURE'],
  ['LETTER_FOLDED','접힌 편지','PAPER_GOODS'],
  ['WINDOW_FROSTED','뿌연 유리창','WINDOW_FIXTURE'],
  ['WORKBENCH_REPAIR','수선용 작업대','WORKSHOP_FURNITURE'],
  ['BOOKSHELF_LADDER','사다리형 책장','BOOKSHOP_FURNITURE'],
  ['SHELF_COUNTER','가게 안쪽 진열 선반','SHOP_FURNITURE'],
  ['TABLE_PREPARATION','재료를 펼치는 작업 탁자','WORKSHOP_FURNITURE'],
  ['CABINET_SHARED','공용 수납장','HOUSEHOLD_FURNITURE'],
  ['WORK_STAND_WORN','사용 흔적이 있는 목재 받침','WORKSHOP_FURNITURE'],
  ['COBBLE_STONE_SMALL_A','작은 회색 포석 A','PAVED_STREET'],
  ['COBBLE_STONE_SMALL_B','작은 회색 포석 B','PAVED_STREET'],
  ['COBBLE_STONE_DARK_A','어두운 회색 포석 A','PAVED_STREET'],
  ['COBBLE_STONE_DARK_B','어두운 회색 포석 B','PAVED_STREET'],
  ['COBBLE_STONE_LIGHT_A','밝은 회색 포석 A','PAVED_STREET'],
  ['COBBLE_STONE_LIGHT_B','밝은 회색 포석 B','PAVED_STREET'],
  ['COBBLE_STONE_PATCHED_A','부분 수선된 포석 A','PAVED_STREET'],
  ['COBBLE_STONE_PATCHED_B','부분 수선된 포석 B','PAVED_STREET'],
  ['COBBLE_STONE_EDGE','가장자리가 닳은 포석','PAVED_STREET'],
  ['NEVSKY_COBBLE_A','네프스키 보행로의 무늬진 회색 포석','PAVED_STREET'],
  ['NEVSKY_COBBLE_B','네프스키 보행로의 밝은 포석 변형','PAVED_STREET'],
  ['NEVSKY_COBBLE_C','발길에 닳은 어두운 포석','PAVED_STREET'],
  ['NEVSKY_COBBLE_D','수선 흔적이 섞인 포석','PAVED_STREET'],
  ['MARKET_PACKED_EARTH_A','장터의 다져진 흙바닥','MARKET_GROUND'],
  ['MARKET_PACKED_EARTH_B','장터 발자국 자국','MARKET_GROUND'],
  ['MARKET_STRAW_EARTH','짚 조각이 흩어진 흙바닥','MARKET_GROUND'],
  ['MARKET_COMPACTED_EARTH','수레가 지나간 단단한 흙','MARKET_GROUND'],
  ['QUAY_FLAGSTONE_A','강변의 큰 석판','QUAY_SURFACE'],
  ['QUAY_FLAGSTONE_B','금이 간 강변 석판','QUAY_SURFACE'],
  ['QUAY_DAMP_STONE','물기가 남은 강변 돌','QUAY_SURFACE'],
  ['QUAY_WORN_STONE','모서리가 닳은 강변 돌','QUAY_SURFACE'],
  ['WHARF_PLANK_A','짐을 내리는 나무 발판','TIMBER_WALK'],
  ['WHARF_PLANK_B','못 자국이 보이는 발판','TIMBER_WALK'],
  ['WHARF_PLANK_C','비에 어두워진 발판','TIMBER_WALK'],
  ['WOODEN_CRATE_OPEN','열린 나무 운송 상자','TRADE_CONTAINER'],
  ['COOPERED_STORAGE_CASK','작은 저장통','TRADE_CONTAINER'],
  ['HAWKER_PORTABLE_SALES_TRAY','행상의 휴대 판매 쟁반','MARKET_GOODS'],
  ['KALACH_VENDOR_BREAD','칼라치 판매인의 빵','BAKERY_GOODS'],
  ['RIVER_FISH_ON_TRAY','강변 장터의 생선','MARKET_GOODS'],
  ['TWO_WHEEL_HANDCART','두 바퀴 손수레','TRANSPORT_EQUIPMENT'],
  ['COURIER_SHOULDER_BAG','어깨에 메는 작은 가방','POSTAL_EQUIPMENT'],
  ['COILED_HAULING_ROPE','감아 둔 하역 밧줄','TRANSPORT_EQUIPMENT'],
  ['QUAY_MOORING_POST','강변의 목재 말뚝','QUAY_EQUIPMENT'],
  ['FLOUR_SACK_TIED','묶어 둔 자루','BAKERY_GOODS'],
  ['BOOKSHOP_STEP_LADDER','서가 앞 발판','BOOKSHOP_FURNITURE'],
  ['WATER_BUCKET_WOOD','나무 물통','HOUSEHOLD_GOODS'],
  ['WASH_BASIN_METAL','금속 세숫대야','HOUSEHOLD_GOODS'],
  ['SEWING_NOTIONS_BASKET','바느질감을 담은 작은 바구니','SEWING_EQUIPMENT'],
  ['TAILORS_SHEARS','재단용 가위','SEWING_EQUIPMENT'],
  ['THREAD_SPOOL_WOOD','나무 실패에 감긴 실','SEWING_EQUIPMENT'],
  ['PRINTERS_INK_BOTTLE','인쇄용 잉크병','PRINTSHOP_EQUIPMENT'],
  ['TYPE_CASE_LETTERS','활자 서랍','PRINTSHOP_EQUIPMENT'],
  ['HAND_PRESS_PLATEN','인쇄기 압판','PRINTSHOP_EQUIPMENT'],
  ['PRINTING_PAPER_STACK','인쇄할 종이 묶음','PRINTSHOP_SUPPLY'],
  ['LEDGER_AND_QUILL','장부와 깃펜','OFFICE_EQUIPMENT'],
  ['APOTHECARY_STOPPERED_JAR','마개가 있는 약병','APOTHECARY_GOODS'],
  ['SHARED_FIREWOOD_STACK','장작 더미','HOUSEHOLD_FUEL'],
  ['CART_WHEEL_REPAIR_TOOLS','수레 수리 공구','TRANSPORT_EQUIPMENT'],
  ['RIVER_WATER_PIXEL_SURFACE','강과 운하를 나타내는 게임용 물 표면','WATER_SURFACE'],
];

const lines = (await readFile(file, 'utf8')).trimEnd().split(/\r?\n/);
const headers = lines[0];
if (lines.length !== 86 || definitions.length !== 85) throw new Error('expected a header and exactly 85 atlas entries');
const quote = value => `"${String(value).replaceAll('"','""')}"`;
const rows = lines.slice(1).map((line, index) => {
  const columns = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map(match => match[1].replaceAll('""','"'));
  if (columns.length !== 11 || Number(columns[0]) !== index + 1) throw new Error(`invalid usage row ${index + 2}`);
  const [tileKey, descriptionKo, category] = definitions[index];
  const gid = index + 1;
  columns[1] = tileKey;
  columns[2] = descriptionKo;
  columns[3] = category;
  if (gid === 63) {
    if (columns[4] !== 'CUSTOM_ASSET_INSPIRED_BY_PERIOD_SOURCE' || columns[5] !== 'V36-ART-LABASTIDE-HAWKER-TRAY-1845' || columns[6] !== 'https://rusmuseumvrm.ru/data/collections/drawings/r-24373/index.php') {
      throw new Error('GID 63 must identify the exact Russian Museum Labastide peddler-with-tray record R-24373.');
    }
    if (!columns[7].includes('R-24373') || !columns[7].includes('정확한 쟁반 모양')) throw new Error('GID 63 must bound its tray scene reference.');
  } else if (gid === 64) {
    if (columns[4] !== 'CUSTOM_ASSET_INSPIRED_BY_PERIOD_SOURCE' || columns[5] !== 'V36-ART-LABASTIDE-KALACH-SELLER-1845' || columns[6] !== 'https://rusmuseumvrm.ru/data/collections/drawings/r-24382/index.php') {
      throw new Error('GID 64 must identify the exact Russian Museum Labastide kalach-seller record R-24382.');
    }
    if (!columns[7].includes('R-24382') || !columns[7].includes('빵의 정확한 형태')) throw new Error('GID 64 must bound its kalach scene reference.');
  } else if (gid === 65) {
    if (columns[4] !== 'CUSTOM_ASSET_INSPIRED_BY_PERIOD_SOURCE' || columns[5] !== 'V36-ART-KOLLMAN-FISH-SELLERS-1830S' || columns[6] !== 'https://rusmuseumvrm.ru/data/collections/drawings/r-5783/index.php') {
      throw new Error('GID 65 must identify the exact Russian Museum fish-and-egg sellers record R-5783.');
    }
    if (!columns[7].includes('정확한 생선 진열 모양') || !columns[7].includes('1847년 동일 장소')) throw new Error('GID 65 must delimit what its visual source does not prove.');
  } else if (gid >= 61) {
    if (columns[4] !== 'UNVERIFIED_RECONSTRUCTION' || columns[5] || columns[6] || !columns[7].includes('UNVERIFIED_RECONSTRUCTION')) {
      throw new Error(`GID ${gid} must not imply direct historical support without an inspected item-level source.`);
    }
  } else if (gid >= 46 && gid <= 60) {
    columns[4] = 'UNVERIFIED_RECONSTRUCTION';
    columns[5] = '';
    columns[6] = '';
    columns[7] = 'UNVERIFIED_RECONSTRUCTION: 독립적으로 그린 게임용 노면·널판 타일. 확인한 자료는 이 구체적 표면의 색·문양·재료를 입증하지 않는다.';
  } else {
    columns[7] = '독립적으로 그린 게임용 타일; 이 시각 자료는 특정 주소·건축물·노면 배치를 입증하지 않음';
  }
  return columns.map(quote).join(',');
});
await writeFile(file, `${headers}\n${rows.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ status: 'PASS', entries: rows.length, uniqueTileKeys: new Set(definitions.map(row => row[0])).size, genericLabels: 0 }));
