import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dir = join(root, 'rpg/assets/v47/interiors');
const shadow = '<ellipse cx="25" cy="42" rx="17" ry="3" fill="#170f0b" opacity=".42"/>';
const border = '<path d="M7 8h32v30H7z" fill="#211813"/><path d="M9 6h30v30H9z" fill="#60452e"/><path d="M11 8h26v25H11z" fill="#c6ad7c"/>';
const paper = '<path d="M11 8h25l2 3v20l-3 3H11z" fill="#e8d7ad"/><path d="M14 11h18M14 15h20M14 19h17M14 23h19M14 27h13" stroke="#927b59" stroke-width="1"/><path d="M31 8v4h6" fill="#c7b386"/>';
const book = '<path d="M8 13l15-5 2 26-15 4z" fill="#23362f" stroke="#18130f" stroke-width="2"/><path d="M25 8l15 5-2 25-14-4z" fill="#8b3829" stroke="#18130f" stroke-width="2"/><path d="M11 16l11-3v16l-10 3z" fill="#e1d0a8"/><path d="M28 14l9 3-1 14-9-3z" fill="#ddc99a"/><path d="M13 18h7m-7 3h7m11-4 5 2m-5 2 5 1" stroke="#887452"/>';
const pieces = {
  'proof-folded': `<g>${shadow}${border}${paper}<path d="M29 8v8h8" fill="#d0bb8d" stroke="#806c4d"/><path d="M28 28l4-4 3 2-4 4z" fill="#a34232"/></g>`,
  'proof-red-pencil': `<g>${shadow}${paper}<path d="M7 32l25-25 5 5-25 25z" fill="#b84632" stroke="#52251e"/><path d="M31 8l4-4 5 5-4 4z" fill="#d5b77e"/><path d="M12 30l4-2m8-8 4-2" stroke="#f2d7a5" stroke-width="2"/></g>`,
  'proof-stack': `<g>${shadow}<path d="M8 19l24 1 7 5-25-1z" fill="#a98e62"/><path d="M10 14l26 1 4 5-26-1z" fill="#d8c49a"/><path d="M8 9l25 1 5 5-26-1z" fill="#eee0bd"/><path d="M13 12h17m-15 5h19m-16 5h16" stroke="#967f59"/></g>`,
  'ledger-brass-clasp': `<g>${shadow}<path d="M9 8h30v29H9z" fill="#34251c" stroke="#17110d" stroke-width="2"/><path d="M12 10h24v25H12z" fill="#49604a"/><path d="M15 14h18M15 18h15M15 22h18M15 26h14M15 30h17" stroke="#d2c092"/><path d="M33 9h5v7h-5z" fill="#bd9450"/><circle cx="35.5" cy="13" r="1" fill="#f3d28c"/></g>`,
  'loose-type': `<g>${shadow}<path d="M7 28h12v10H7zm14-6h12v10H21zm3-14h12v10H24z" fill="#38322b" stroke="#17120e"/><path d="M10 31h6m8-6h6m-4-11h6" stroke="#c7a568" stroke-width="2"/><path d="M12 28v-3h3v3m8-3v-3h3v3m4-10v-3h3v3" fill="#d9c18c"/></g>`,
  'composing-stick': `<g>${shadow}<path d="M7 15h34v18H7z" fill="#64442b" stroke="#20150f" stroke-width="2"/><path d="M10 18h27v11H10z" fill="#c1a36b"/><path d="M12 20h5v7h-5zm7 0h5v7h-5zm7 0h5v7h-5z" fill="#36312b"/><path d="M9 32h30" stroke="#d0ad6d" stroke-width="2"/></g>`,
  'ink-pot-feather': `<g>${shadow}<path d="M10 24h17l-2 14H12z" fill="#242625" stroke="#141413" stroke-width="2"/><path d="M9 21h19v4H9z" fill="#b28b50"/><path d="M34 7q-3 13-9 24m7-17 7-4m-10 9 7-3m-10 9 7-2" fill="none" stroke="#e2d0a5" stroke-width="2"/><path d="M31 8l7-4" stroke="#9a4935" stroke-width="2"/></g>`,
  'paper-ream': `<g>${shadow}<path d="M8 17l24-7 9 4-25 8z" fill="#bda578"/><path d="M8 12l24-7 9 4-25 8z" fill="#ead9ae"/><path d="M12 22l25-7v16l-25 7z" fill="#d8c497"/><path d="M16 25l17-5m-17 9 17-5m-17 9 11-3" stroke="#9b835d"/><path d="M8 12v5l4 5v15l-4-5z" fill="#b99c6d"/></g>`,
  'wax-seal': `<g>${shadow}<path d="M8 11h31v24H8z" fill="#e7d7b2"/><path d="M11 15h20m-20 4h23m-23 4h14" stroke="#9c835c"/><path d="M26 27c4-5 12-2 10 3-1 4-8 5-11 2z" fill="#963b2e"/><path d="M30 28h4m-3-2v5" stroke="#e0b77a"/></g>`,
  'thread-spool': `<g>${shadow}<path d="M14 10h22v5H14zm2 21h18v6H16z" fill="#a57e4a"/><path d="M17 15h16v16H17z" fill="#8f3831"/><path d="M17 18h16m-16 4h16m-16 4h16m-16 4h16" stroke="#e2c38b" stroke-width="2"/><path d="M33 18q8 2 5 9" fill="none" stroke="#dfc38c"/></g>`,
  'binding-awl': `<g>${shadow}<path d="M11 31l7-7 6 6-7 7z" fill="#805638"/><path d="M19 27L37 8l3 3-18 19z" fill="#b5b1a5"/><path d="M36 9l4-4 3 3-4 4z" fill="#ddd6c6"/><path d="M12 32l3 3" stroke="#d6ac68" stroke-width="2"/></g>`,
  'courier-satchel': `<g>${shadow}<path d="M10 18l6-7h17l7 8-3 18H12z" fill="#70462d" stroke="#24170f" stroke-width="2"/><path d="M17 11q1-8 8-8t8 8" fill="none" stroke="#a87845" stroke-width="3"/><path d="M11 20h27v5H11z" fill="#a66f3e"/><path d="M21 20v8h7v-8" fill="#c6a66c"/><circle cx="24" cy="25" r="1" fill="#38261a"/></g>`,
  'open-novel': `<g>${shadow}${book}<path d="M13 20h6m-6 3h6m12-4 4 1m-4 3 4 1" stroke="#94805d"/></g>`,
  'stitched-almanac': `<g>${shadow}<path d="M10 7h27v31H10z" fill="#234337" stroke="#17140f" stroke-width="2"/><path d="M14 11h19v22H14z" fill="#dfcca0"/><path d="M16 14h15m-15 3h15m-15 3h15m-15 3h13" stroke="#88724f"/><path d="M23 8v29" stroke="#b88a4e" stroke-width="2"/><path d="M17 28h11" stroke="#9a4231" stroke-width="2"/></g>`,
  'returned-parcel': `<g>${shadow}<path d="M7 14l18-9 18 9-18 10z" fill="#b3925f" stroke="#49331e"/><path d="M7 14v18l18 10V24z" fill="#d1b37b"/><path d="M43 14v18L25 42V24z" fill="#987245"/><path d="M22 10l18 9m-15 5v16" stroke="#eed7a5" stroke-width="2"/><path d="M31 25h7v6h-7z" fill="#8e3d30"/></g>`,
  'price-tokens': `<g>${shadow}<circle cx="15" cy="27" r="8" fill="#b88945" stroke="#624221" stroke-width="2"/><circle cx="29" cy="20" r="8" fill="#d1aa61" stroke="#694923" stroke-width="2"/><circle cx="34" cy="32" r="7" fill="#97703e" stroke="#56381d" stroke-width="2"/><path d="M12 25h6m-3-3v10m11-14h6m-3-3v10m2 9h6" stroke="#f0d18a"/></g>`,
  'counter-bell': `<g>${shadow}<path d="M11 28h29v7H11z" fill="#57402a"/><path d="M16 27q1-13 9-17 8 4 9 17z" fill="#c49a53" stroke="#674720" stroke-width="2"/><path d="M14 28h20m-8-21h-3" stroke="#f2d38f" stroke-width="2"/><circle cx="27" cy="7" r="2" fill="#8d6135"/></g>`,
  'reading-lamp': `<g>${shadow}<path d="M20 34h18v5H20z" fill="#4c3927"/><path d="M28 34V20l7-8" fill="none" stroke="#b68a4c" stroke-width="3"/><path d="M25 5h15l5 9H20z" fill="#9e713d" stroke="#52371e" stroke-width="2"/><path d="M24 12h16" stroke="#f0d091"/><path d="M24 16l-4 10m21-10 4 10" stroke="#e9c16e" opacity=".5"/></g>`,
  'tea-glass-holder': `<g>${shadow}<path d="M10 32h29v5H10z" fill="#9a7040"/><path d="M15 13h19l-2 18H17z" fill="#b5d0c2" opacity=".8" stroke="#343c35" stroke-width="2"/><path d="M12 12h25v4H12zm3 6h20m-18 6h16" stroke="#c3924e" stroke-width="2"/><path d="M19 12V8h11v4" fill="none" stroke="#d4ad67" stroke-width="2"/></g>`,
  'wool-shawl': `<g>${shadow}<path d="M9 10h30l-4 24H13z" fill="#653c35" stroke="#2a1b17" stroke-width="2"/><path d="M13 14h22m-23 5h21m-21 5h19m-19 5h17" stroke="#d0ad73" stroke-width="2"/><path d="M14 34l-2 5m7-5-1 5m8-5 1 5m7-5 2 5" stroke="#c5a06a"/></g>`,
  'icon-corner': `<g>${shadow}<path d="M11 5h27v33H11z" fill="#58382a" stroke="#1e1510" stroke-width="2"/><path d="M14 8h21v27H14z" fill="#b48b4c"/><path d="M17 11h15v20H17z" fill="#273d3b"/><circle cx="24.5" cy="17" r="4" fill="#d7b978"/><path d="M19 28q5-9 11 0v2H19z" fill="#a8503b"/><path d="M23 21h3v6h-3z" fill="#dfc98e"/></g>`,
  'coat-rack': `<g>${shadow}<path d="M23 9h5v29h-5z" fill="#795333"/><path d="M15 12h21m-18 0-5 5m21-5 5 5" stroke="#ae8050" stroke-width="3"/><path d="M12 17l5-2 4 4-2 12-9-1z" fill="#39423c"/><path d="M31 17l5-2 5 5-3 11-9-2z" fill="#704039"/><path d="M18 38h15" stroke="#4c3320" stroke-width="3"/></g>`,
  'felt-boots': `<g>${shadow}<path d="M8 14h12v15l8 5v5H8z" fill="#39312a" stroke="#15120f" stroke-width="2"/><path d="M27 10h11v18l6 5v6H26z" fill="#51463a" stroke="#17130f" stroke-width="2"/><path d="M10 18h8m11-4h7" stroke="#a98a5e" stroke-width="2"/><path d="M9 36h18m0 1h17" stroke="#c49b58" stroke-width="2"/></g>`,
  'hand-broom': `<g>${shadow}<path d="M29 5l4 2-17 25-4-3z" fill="#b28d55"/><path d="M12 28l9 5-6 8-11-4z" fill="#8a6338"/><path d="M8 34l9 4m-8-7 8 4m-4-8 7 4" stroke="#d0ab6c"/></g>`,
  'carved-chair': `<g>${shadow}<path d="M12 8h6v17h-6zm19 0h6v17h-6z" fill="#66422a" stroke="#231810"/><path d="M15 10h17v12H15z" fill="#963e32"/><path d="M10 22h29v5H10z" fill="#805633"/><path d="M14 27l-3 12m24-12 3 12" stroke="#56371f" stroke-width="4"/><path d="M18 12l5 4 5-4m-5 4v5" fill="none" stroke="#d1a85d" stroke-width="2"/></g>`,
  'tea-tray': `<g>${shadow}<ellipse cx="24" cy="29" rx="19" ry="10" fill="#8b5a32" stroke="#4c2f1d" stroke-width="2"/><ellipse cx="24" cy="27" rx="15" ry="7" fill="#bd9658"/><path d="M16 24h8v6h-8zm13-2h8v6h-8z" fill="#e1d2af" stroke="#776548"/><path d="M18 25h4m9-1h4" stroke="#9c4635"/></g>`,
  'samovar-tongs': `<g>${shadow}<path d="M11 10l25 24m0-24L11 34" stroke="#b58b4b" stroke-width="4"/><path d="M11 10l4 1-2 6-4-2zm25 0-4 1 2 6 4-2z" fill="#d9bb77"/><path d="M20 23h12" stroke="#7d5430" stroke-width="2"/></g>`,
  'porcelain-cups': `<g>${shadow}<path d="M7 21h15v12q-1 6-7 6t-8-6z" fill="#e5d7b6" stroke="#655641"/><path d="M22 24h6q4 5-5 7" fill="none" stroke="#aa8043" stroke-width="2"/><path d="M27 16h14v12q-1 6-7 6t-7-6z" fill="#d7e0d2" stroke="#526055"/><path d="M40 19h4q4 5-4 7" fill="none" stroke="#9b7441" stroke-width="2"/><path d="M10 25h9m11-5h8" stroke="#a14838"/></g>`,
  'manuscript-envelope': `<g>${shadow}<path d="M7 12h34v24H7z" fill="#dfcca0" stroke="#6c5638" stroke-width="2"/><path d="M8 14l16 13 16-13M8 34l12-10m20 10L28 24" fill="none" stroke="#ad9469" stroke-width="2"/><circle cx="25" cy="27" r="4" fill="#963b2e"/><path d="M23 27h4m-2-2v4" stroke="#dfbf7d"/></g>`,
  'inkstand': `<g>${shadow}<path d="M8 31h32v7H8z" fill="#4b3525"/><path d="M12 18h11v14H12z" fill="#252726" stroke="#151513"/><path d="M10 16h15v4H10z" fill="#b78a49"/><path d="M29 29L38 7l3 1-7 24z" fill="#b3ad9e"/><path d="M39 8l4-4 2 2-4 4z" fill="#9b4535"/><path d="M13 21h8" stroke="#67817b"/></g>`,
  'stitched-cushion': `<g>${shadow}<path d="M11 13l25-3 5 19-9 10-24-7z" fill="#6d3d35" stroke="#2d1b16" stroke-width="2"/><path d="M14 16l20-2 3 14-7 6-19-5z" fill="#8f4c3d"/><path d="M18 16l13 15m4-15L15 29m8-13v15m-9-8h21" stroke="#d1b16f" stroke-width="2"/></g>`,
  'rug-edge': `<g>${shadow}<path d="M6 14l29-8 8 23-29 11z" fill="#713c34" stroke="#281a16" stroke-width="2"/><path d="M11 16l21-6 5 16-22 7z" fill="#263d38"/><path d="M15 17l14-4 3 10-14 5z" fill="none" stroke="#d0aa64" stroke-width="2"/><path d="M12 13l-3-4m9 2-2-5m11 2V3m8 8 3-5" stroke="#d7b779" stroke-width="2"/></g>`,
  'wall-lamp': `<g>${shadow}<path d="M21 8h8v6h-8z" fill="#78502d"/><path d="M24 14h3v19h-3z" fill="#b58b4d"/><path d="M16 18h19l-3 16H19z" fill="#dfc68a" opacity=".8" stroke="#805b31" stroke-width="2"/><path d="M19 21h13m-11 4h9" stroke="#a46936"/><path d="M20 13l-3-5m16 5 3-5" stroke="#bb8b49" stroke-width="2"/></g>`,
  'curtain-tieback': `<g>${shadow}<path d="M8 6h12v32H8z" fill="#753d36"/><path d="M28 6h12v32H28z" fill="#34443d"/><path d="M12 8v26m22-26v26" stroke="#c09657" stroke-width="2"/><path d="M7 23h14l-4 5h-7zm20 0h14l-4 5h-7z" fill="#d0ae6c"/><path d="M4 5h42" stroke="#65432c" stroke-width="3"/></g>`,
  'firewood-stove': `<g>${shadow}<path d="M10 14h29v23H10z" fill="#38413d" stroke="#191714" stroke-width="2"/><path d="M14 18h21v14H14z" fill="#211c18"/><path d="M18 30q6-13 11 0" fill="#bc6234"/><path d="M22 30q2-8 5 0" fill="#e5b15b"/><path d="M14 37v3m21-3v3" stroke="#563c26" stroke-width="4"/><path d="M18 10h13v4H18z" fill="#714b30"/></g>`,
  'umbrella-stand': `<g>${shadow}<path d="M12 23h26l-3 16H15z" fill="#6b3d30" stroke="#2c1b15" stroke-width="2"/><path d="M19 21l3-15 3 1-2 17m5-2 5-17 3 1-4 19" fill="none" stroke="#b58b4b" stroke-width="2"/><path d="M19 7q3-5 6 0m6-1q3-5 6 0" fill="none" stroke="#4a3930" stroke-width="2"/><path d="M16 28h18" stroke="#d0ad6b" stroke-width="2"/></g>`,
  'paneled-entry-door': `<g><path d="M5 59V5h38v54z" fill="#37271c"/><path d="M9 57V8h30v49z" fill="#705039" stroke="#211710" stroke-width="2"/><path d="M13 54V13h22v41z" fill="#503729"/><path d="M16 17h16v13H16zm0 18h16v15H16z" fill="#72513a" stroke="#a37b4b" stroke-width="2"/><path d="M18 19h12v9H18zm0 20h12v11H18z" fill="#846042"/><path d="M11 10h26M11 53h26" stroke="#c19a60" stroke-width="2"/><circle cx="30" cy="34" r="2" fill="#e0bd74"/><path d="M33 33h3v3h-3" fill="#b58a4b"/><path d="M4 5h40v4H4z" fill="#a07a4c"/><path d="M6 57h36v3H6z" fill="#211710"/></g>`,
};

const placements = {
  printshop: ['proof-folded','proof-red-pencil','proof-stack','ledger-brass-clasp','loose-type','composing-stick','ink-pot-feather','paper-ream','wax-seal','thread-spool','binding-awl','courier-satchel'],
  'bookshop-interior': ['open-novel','stitched-almanac','returned-parcel','price-tokens','counter-bell','reading-lamp','tea-glass-holder','wool-shawl','icon-corner','coat-rack','felt-boots','hand-broom'],
  'sofiya-salon': ['carved-chair','tea-tray','samovar-tongs','porcelain-cups','manuscript-envelope','inkstand','stitched-cushion','rug-edge','wall-lamp','curtain-tieback','firewood-stove','umbrella-stand'],
};
const allAssets = Object.keys(pieces);
if (allAssets.length !== 37) throw new Error(`Expected 37 distinct props, got ${allAssets.length}`);
await mkdir(dir, { recursive: true });
for (const [name, drawing] of Object.entries(pieces)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" shape-rendering="crispEdges"><rect width="48" height="48" fill="none"/>${drawing}</svg>\n`;
  await writeFile(join(dir, `${name}.svg`), svg, 'utf8');
}
for (const [mapId, names] of Object.entries(placements)) {
  const file = join(root, `rpg/maps/${mapId}.json`);
  const map = JSON.parse(await (await import('node:fs/promises')).readFile(file, 'utf8'));
  const layer = map.layers.find(item => item.name === 'Interactions');
  if (mapId === 'bookshop-interior') layer.objects = layer.objects.filter(item => item.name !== '골목 쪽 문');
  if (mapId === 'printshop') {
    const returnObject = layer.objects.find(item => item.id === 9062);
    if (returnObject) { returnObject.x = 176; returnObject.y = 112; }
    else layer.objects.push({ id: 9062, name: '「탈니코프 가족」을 읽고 장면으로 돌아가기', type: 'quest-object',
      x: 176, y: 112, width: 16, height: 16, visible: true,
      properties: [{ name: 'questId', type: 'string', value: 'V47_MAIN01_A03' },
        { name: 'sourceId', type: 'string', value: 'V47-PANAEVA-TALNIKOV-CH1-1848' }] });
  }
  const realDoor = layer.objects.find(item => item.type === 'map-exit');
  if (realDoor) {
    const doorOffsetY = mapId === 'printshop' ? -32 : 0;
    realDoor.properties = (realDoor.properties ?? []).filter(property => !['displayAsset','displayWidth','displayHeight','displayOffsetX','displayOffsetY','shadowElevation'].includes(property.name));
    realDoor.properties.push(
      { name: 'displayAsset', type: 'string', value: '../assets/v47/interiors/paneled-entry-door.svg' },
      { name: 'displayWidth', type: 'int', value: 48 }, { name: 'displayHeight', type: 'int', value: 64 },
      { name: 'displayOffsetX', type: 'int', value: -16 }, { name: 'displayOffsetY', type: 'int', value: doorOffsetY },
      { name: 'castShadow', type: 'bool', value: false });
  }
  const coords = mapId === 'printshop'
    ? [[32,32],[96,32],[160,32],[272,32],[336,32],[48,96],[112,96],[176,96],[256,96],[336,96],[64,160],[304,160]]
    : mapId === 'bookshop-interior'
      ? [[48,32],[112,32],[176,32],[240,32],[320,32],[48,112],[112,112],[256,112],[320,112],[64,192],[112,192],[304,192]]
      : [[32,48],[96,48],[160,48],[240,48],[320,48],[32,112],[96,112],[272,112],[336,112],[64,192],[112,192],[304,192]];
  const existingIds = new Set(layer.objects.map(item => item.id));
  let id = Math.max(7000, ...existingIds) + 1;
  for (const [index, name] of names.entries()) {
    const [x, y] = mapId === 'printshop' && name === 'paper-ream' ? [112, 64] : coords[index];
    const existingDecoration = layer.objects.find(item => item.name === `장식 · ${name}`);
    if (existingDecoration) { existingDecoration.x = x; existingDecoration.y = y; continue; }
    layer.objects.push({ id: id++, name: `장식 · ${name}`, type: 'decoration', x, y, width: 16, height: 16, visible: true,
      properties: [
        { name: 'displayAsset', type: 'string', value: `../assets/v47/interiors/${name}.svg` },
        { name: 'displayWidth', type: 'int', value: 48 }, { name: 'displayHeight', type: 'int', value: 48 },
        { name: 'displayOffsetX', type: 'int', value: -16 }, { name: 'displayOffsetY', type: 'int', value: -32 },
        { name: 'shadowElevation', type: 'int', value: 9 }, { name: 'shadowStrength', type: 'float', value: 1.05 },
        { name: 'historicalScope', type: 'string', value: 'fictional-period-inspired-scene-prop' },
      ] });
  }
  map.nextobjectid = Math.max(map.nextobjectid, id);
  await writeFile(file, `${JSON.stringify(map, null, 2)}\n`, 'utf8');
}

const provenancePath = join(root, 'rpg/assets/ASSET_PROVENANCE.json');
const provenance = JSON.parse(await (await import('node:fs/promises')).readFile(provenancePath, 'utf8'));
for (const [mapId, names] of Object.entries(placements)) for (const name of names) {
  const path = `rpg/assets/v47/interiors/${name}.svg`;
  const sha256 = createHash('sha256').update(await (await import('node:fs/promises')).readFile(join(root, path))).digest('hex').toUpperCase();
  const existing = provenance.assets.find(asset => asset.path === path);
  const record = existing ?? { id: `v47-period-inspired-${name}`, path, type: 'AUTHORED_PIXEL_ART_SCENE_PROP' };
  Object.assign(record, { sha256,
    generatedBy: 'Project-authored crisp-edge SVG pixel illustration', license: 'Project-authored; no external image embedded',
    historicalConfidence: 'PERIOD_INSPIRED_FICTIONAL_SCENE_PROP_NOT_A_DOCUMENTED_OBJECT', intendedScene: [mapId],
    sourceIds: ['V47-ART-DURAND-NEVSKY-1839', 'OBJ-SOV-1847'],
    sourceUrls: ['https://commons.wikimedia.org/wiki/File:Durand_-_View_of_Nevsky_Prospekt_near_the_Politseisky_Bridge_1839.jpg', 'https://rusneb.ru/catalog/000199_000009_007828983/'], sha256,
    notes: 'Original decorative artwork based on period street/interior materials and documented urban setting. It is a fictional room prop, not an image of a specific surviving historical object.' });
  if (!existing) provenance.assets.push(record);
}
const doorPath = 'rpg/assets/v47/interiors/paneled-entry-door.svg';
const doorHash = createHash('sha256').update(await (await import('node:fs/promises')).readFile(join(root, doorPath))).digest('hex').toUpperCase();
const existingDoor = provenance.assets.find(asset => asset.path === doorPath);
const doorRecord = existingDoor ?? { id: 'v47-authored-paneled-entry-door', path: doorPath, type: 'AUTHORED_PIXEL_ART_ARCHITECTURAL_PROP' };
Object.assign(doorRecord, {
  generatedBy: 'Project-authored crisp-edge SVG pixel illustration', license: 'Project-authored; no external image embedded',
  historicalConfidence: 'PERIOD_INSPIRED_FICTIONAL_ARCHITECTURAL_DETAIL_NOT_A_DOCUMENTED_DOOR',
  intendedScene: Object.keys(placements), sourceIds: ['V47-ART-DURAND-NEVSKY-1839'],
  sourceUrls: ['https://commons.wikimedia.org/wiki/File:Durand_-_View_of_Nevsky_Prospekt_near_the_Politseisky_Bridge_1839.jpg'], sha256: doorHash,
  notes: 'Replaces a misleading decorative doorway with a paneled entrance drawn at each actual map exit. It is not a claim about a specific surviving door.' });
if (!existingDoor) provenance.assets.push(doorRecord);
await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`, 'utf8');
