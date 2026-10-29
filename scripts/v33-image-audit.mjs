import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

const root = process.cwd();
const assetRoot = path.join(root, 'rpg', 'assets');
const provenance = JSON.parse(fs.readFileSync(path.join(assetRoot, 'ASSET_PROVENANCE.json'), 'utf8'));
const characters = fs.readdirSync(path.join(root, 'rpg', 'characters')).filter(file => file.endsWith('.json')).map(file => JSON.parse(fs.readFileSync(path.join(root, 'rpg', 'characters', file), 'utf8')));
const failures = [];
const pngs = fs.readdirSync(assetRoot).filter(file => file.toLowerCase().endsWith('.png'));
const records = new Map(provenance.assets.map(asset => [asset.path.replaceAll('\\', '/'), asset]));

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function inspectPng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error('invalid PNG signature');
  let offset = 8;
  let header;
  let ended = false;
  const imageData = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) throw new Error('truncated PNG chunk');
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = buffer.readUInt32BE(offset + 8 + length);
    const actualCrc = crc32(buffer.subarray(offset + 4, offset + 8 + length));
    if (expectedCrc !== actualCrc) throw new Error(`${type} CRC mismatch`);
    if (!header && type !== 'IHDR') throw new Error('IHDR is not the first chunk');
    if (type === 'IHDR') {
      if (header || length !== 13) throw new Error('invalid IHDR');
      header = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9], interlace: data[12] };
    } else if (type === 'IDAT') imageData.push(data);
    else if (type === 'IEND') { ended = true; offset = end; break; }
    offset = end;
  }
  if (!header || !ended || offset !== buffer.length) throw new Error('missing IEND or trailing bytes');
  if (!header.width || !header.height || !imageData.length) throw new Error('empty PNG dimensions or pixel data');
  inflateSync(Buffer.concat(imageData));
  return header;
}

const results = [];
for (const file of pngs) {
  const relativePath = `rpg/assets/${file}`;
  const asset = records.get(relativePath);
  if (!asset) { failures.push(`${relativePath} has no asset provenance record`); continue; }
  if (!asset.license || !asset.type || !asset.historicalConfidence) failures.push(`${relativePath} lacks type, license, or historical-confidence metadata`);
  const bytes = fs.readFileSync(path.join(assetRoot, file));
  let dimensions = null;
  try { dimensions = inspectPng(bytes); }
  catch (error) { failures.push(`${relativePath}: ${error.message}`); }
  results.push({ path: relativePath, width: dimensions?.width ?? null, height: dimensions?.height ?? null, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), license: asset.license, confidence: asset.historicalConfidence });
}
for (const asset of provenance.assets) if (asset.path.startsWith('rpg/assets/') && !fs.existsSync(path.join(root, asset.path))) failures.push(`${asset.path} is listed in provenance but missing`);
for (const character of characters) {
  const sprite = character.sprite;
  const filename = sprite?.file?.replaceAll('\\', '/');
  const result = results.find(item => item.path === `rpg/${filename}`);
  if (!result) { failures.push(`${character.id} references missing sprite ${sprite?.file}`); continue; }
  if (result.width % sprite.frameWidth || result.height % sprite.frameHeight) failures.push(`${character.id} sprite dimensions do not align to ${sprite.frameWidth}×${sprite.frameHeight} frames`);
  const portraitPath = character.portrait?.file?.replaceAll('\\', '/');
  const portrait = results.find(item => item.path === `rpg/${portraitPath}`);
  if (!portrait || portrait.width !== 64 || portrait.height !== 64) failures.push(`${character.id} requires a 64×64 face portrait`);
  if (!records.has(`rpg/${portraitPath}`)) failures.push(`${character.id} portrait has no provenance record`);
}
const tileSheet = results.find(item => item.path === 'rpg/assets/petersburg-tiles.png');
if (!tileSheet || tileSheet.width % 16 || tileSheet.height % 16) failures.push('Petersburg tilesheet is missing or does not align to the 16px map grid');

const result = { schemaVersion: 'V33-IMAGE-AUDIT-2', status: failures.length ? 'FAIL' : 'PASS', pngCount: results.length, assets: results, failures };
fs.mkdirSync(path.join(root, 'docs', 'v33'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'v33', 'IMAGE_AUDIT.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);

