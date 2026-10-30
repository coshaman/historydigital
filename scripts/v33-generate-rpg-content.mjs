import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'rpg');
const palette = {
  ink: '#241d1a', outline: '#30231f', stone: '#62564b', stoneLight: '#897769', stonePale: '#a3907b', snow: '#d3c9b8', snowBlue: '#98aab0',
  wood: '#55392a', woodLight: '#76513a', woodEdge: '#36241d', brick: '#754738', brickDark: '#4a302a', plaster: '#a98a66', plasterLight: '#c2a27a',
  green: '#3f5844', greenLight: '#718364', window: '#455c68', windowLight: '#77909a', glow: '#ddb46a', paper: '#e0d2aa', paperShade: '#bca879',
  skin: '#d0a27b', skinShade: '#9b6d58', black: '#1d1918', white: '#ede2c9', red: '#873b2d', blue: '#435663', brown: '#72513d', ochre: '#aa7748',
};
const rgba = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).concat(255);
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
function crc32(buffer) { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(name, data) { const type = Buffer.from(name); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const check = Buffer.alloc(4); check.writeUInt32BE(crc32(Buffer.concat([type, data]))); return Buffer.concat([len, type, data, check]); }
function image(width, height, draw) {
  const pixels = new Uint8Array(width * height * 4);
  const put = (x, y, color) => { if (x < 0 || y < 0 || x >= width || y >= height) return; const at = (y * width + x) * 4; pixels.set(typeof color === 'string' ? rgba(color.startsWith('#') ? color : palette[color]) : color, at); };
  const rect = (x, y, w, h, color) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) put(xx, yy, color); };
  const line = (x1, y1, x2, y2, color) => { const dx = Math.sign(x2 - x1), dy = Math.sign(y2 - y1); let x = x1, y = y1; for (;;) { put(x, y, color); if (x === x2 && y === y2) break; if (Math.abs(x2 - x) >= Math.abs(y2 - y)) x += dx; else y += dy; } };
  draw({ put, rect, line, width, height, palette });
  const scan = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) scan.set(pixels.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(scan, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const tileDrawers = [
  ({ put, rect }) => { rect(0, 0, 16, 16, '#52483f'); for (let y = 0; y < 16; y += 5) { const shift = y % 10 ? 2 : 0; for (let x = shift; x < 16; x += 7) { rect(x, y, 6, 4, '#6c5d4f'); put(x + 1, y + 1, '#897568'); put(x + 4, y + 3, '#453b36'); } } },
  ({ put, rect }) => { rect(0, 0, 16, 16, '#574a40'); for (let y = 0; y < 16; y += 8) for (let x = (y ? 4 : 0); x < 16; x += 8) { rect(x, y, 7, 6, '#736254'); put(x + 2, y + 1, '#91806e'); put(x + 6, y + 5, '#463d37'); } },
  ({ rect, put }) => { rect(0, 0, 16, 16, '#4a4442'); rect(2, 3, 5, 2, '#66787d'); rect(10, 9, 4, 2, '#627276'); put(4, 4, '#a4aaa3'); put(11, 10, '#9aa49f'); },
  ({ rect, put }) => { rect(0, 0, 16, 16, '#766f66'); rect(1, 3, 14, 1, '#d3c9b8'); rect(4, 11, 9, 3, '#aab4b0'); put(7, 12, '#eef0e8'); put(2, 7, '#9ba9ab'); },
  ({ rect, line }) => { rect(0, 0, 16, 16, '#543927'); for (let y = 2; y < 16; y += 5) { line(0, y, 15, y, '#32231d'); line(2, y + 1, 13, y + 1, '#79563a'); } line(5, 0, 5, 2, '#34251e'); line(12, 7, 12, 9, '#34251e'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#65452e'); line(1, 3, 14, 3, '#3d2a20'); line(0, 9, 15, 9, '#412c21'); line(5, 4, 5, 8, '#8b6342'); line(11, 10, 11, 15, '#875e3e'); put(2, 12, '#a57e54'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#704337'); for (let y = 1; y < 16; y += 4) { const shift = y % 8 ? 3 : 0; for (let x = shift; x < 16; x += 7) { line(x, y, x + 5, y, '#9a6248'); line(x + 2, y + 1, x + 2, y + 3, '#4f302a'); } } },
  ({ rect, line }) => { rect(0, 0, 16, 16, '#49322b'); for (let y = 2; y < 16; y += 5) { line(0, y, 15, y, '#80513d'); line(5, y + 1, 5, y + 4, '#362722'); line(13, y + 1, 13, y + 4, '#362722'); } },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#9b7e61'); line(0, 3, 15, 3, '#c4a27b'); line(0, 12, 15, 12, '#81684f'); put(3, 7, '#745f4c'); put(12, 8, '#d0b18a'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#3e302b'); rect(2, 2, 12, 12, '#75909a'); rect(4, 4, 8, 8, '#4e6976'); line(7, 2, 7, 13, '#d1bb91'); line(2, 8, 13, 8, '#d1bb91'); put(3, 3, '#b8c0b8'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#372c27'); rect(2, 2, 12, 12, '#b9844c'); rect(4, 4, 8, 8, '#e0b76b'); line(7, 2, 7, 13, '#49372d'); line(2, 8, 13, 8, '#49372d'); put(4, 5, '#f1d397'); },
  ({ rect, line }) => { rect(0, 0, 16, 16, '#3a3029'); rect(1, 4, 14, 11, '#3f5644'); rect(2, 3, 12, 2, '#b28c59'); line(3, 6, 12, 6, '#78906c'); line(4, 7, 4, 13, '#302c24'); line(11, 7, 11, 13, '#302c24'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#34261f'); rect(3, 1, 10, 15, '#754731'); rect(5, 3, 6, 12, '#96623e'); rect(10, 8, 1, 1, '#d5b268'); line(3, 1, 12, 1, '#b08a57'); },
  ({ rect, put, line }) => { rect(0, 0, 16, 16, '#574536'); rect(1, 2, 14, 12, '#c4a16a'); rect(2, 3, 12, 10, '#e0c58d'); line(2, 13, 13, 13, '#42332b'); drawText({ put, text: 'КНИГИ', x: 2, y: 6, color: '#4a3126' }); },
  ({ rect, line }) => { rect(0, 0, 16, 16, '#514235'); rect(7, 2, 2, 10, '#302a25'); rect(6, 2, 4, 1, '#c9a363'); rect(5, 12, 6, 2, '#362920'); rect(4, 14, 8, 1, '#765238'); line(7, 4, 3, 8, '#9b7c4d'); line(8, 4, 13, 8, '#9b7c4d'); },
  ({ rect, put }) => { rect(0, 0, 16, 16, '#665a50'); rect(0, 0, 16, 4, '#d5d4c7'); rect(0, 11, 16, 5, '#e1d8c4'); rect(3, 4, 3, 8, '#aeb9b4'); rect(9, 5, 5, 6, '#c1cbc3'); put(4, 6, '#eef0e8'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#58473a'); rect(2, 2, 12, 11, '#b78d56'); rect(3, 3, 10, 8, '#e2cb9a'); line(3, 12, 12, 12, '#332620'); put(5, 5, '#823d2f'); put(6, 5, '#823d2f'); put(8, 5, '#823d2f'); put(10, 5, '#823d2f'); },
  ({ rect, line }) => { rect(0, 0, 16, 16, '#4c3a30'); rect(3, 6, 10, 5, '#89623f'); line(4, 11, 2, 15, '#34251f'); line(12, 11, 14, 15, '#34251f'); line(3, 6, 3, 3, '#b08d59'); line(12, 6, 12, 3, '#b08d59'); line(3, 3, 12, 3, '#c2a16b'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#4a3027'); rect(2, 5, 12, 9, '#644632'); rect(4, 2, 8, 4, '#b1824e'); rect(4, 6, 8, 5, '#2e2824'); line(1, 13, 14, 13, '#c49a5a'); put(5, 7, '#d2b270'); put(10, 7, '#d2b270'); },
  ({ rect, line }) => { rect(0, 0, 16, 16, '#574439'); rect(1, 2, 14, 2, '#b28652'); rect(2, 4, 12, 10, '#765336'); for (let y = 6; y < 14; y += 3) line(2, y, 13, y, '#32261f'); line(4, 4, 4, 14, '#c5a06b'); line(11, 4, 11, 14, '#c5a06b'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#554434'); rect(2, 3, 12, 10, '#9c8057'); rect(3, 4, 10, 8, '#e3d3ad'); for (let y = 6; y < 11; y += 2) line(4, y, 11, y, '#bdab80'); put(5, 8, '#704438'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#4d382b'); rect(2, 5, 12, 8, '#765338'); rect(3, 4, 10, 2, '#c09a5c'); line(4, 6, 4, 12, '#3a2922'); line(11, 6, 11, 12, '#3a2922'); put(8, 8, '#e0c992'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#564137'); rect(5, 5, 6, 8, '#24201d'); rect(6, 3, 4, 2, '#896344'); rect(4, 13, 8, 2, '#30251f'); line(7, 7, 7, 11, '#bb8a4d'); line(9, 7, 9, 11, '#bb8a4d'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#5b4939'); rect(2, 3, 12, 10, '#9a7749'); rect(3, 4, 10, 8, '#dfcca1'); line(4, 6, 11, 6, '#b29463'); line(4, 8, 10, 8, '#b29463'); line(4, 10, 9, 10, '#b29463'); put(12, 13, '#30251e'); },
  ({ rect, line }) => { rect(0, 0, 16, 16, '#594536'); rect(2, 6, 12, 6, '#76583e'); rect(3, 4, 10, 2, '#bd9862'); line(4, 12, 3, 15, '#32251f'); line(12, 12, 13, 15, '#32251f'); line(2, 6, 2, 13, '#32251f'); line(13, 6, 13, 13, '#32251f'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#42302a'); rect(3, 1, 10, 13, '#758b8b'); rect(4, 2, 8, 11, '#b78958'); rect(5, 3, 6, 9, '#43525a'); line(7, 3, 7, 12, '#bd9a69'); put(5, 4, '#879da1'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#5a4330'); rect(1, 2, 14, 12, '#68422f'); rect(2, 3, 12, 10, '#ab7749'); line(2, 6, 13, 6, '#493128'); line(3, 10, 12, 10, '#493128'); put(4, 4, '#d1a266'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#433329'); rect(2, 2, 12, 12, '#795339'); rect(4, 4, 8, 8, '#b6935f'); rect(5, 5, 6, 6, '#cdb47e'); put(8, 8, '#6b4934'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#463a32'); rect(2, 2, 12, 12, '#c6b9a4'); line(3, 4, 12, 4, '#988d7e'); line(3, 7, 10, 7, '#988d7e'); line(3, 10, 12, 10, '#988d7e'); line(3, 13, 8, 13, '#988d7e'); put(12, 12, '#744635'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#42362f'); rect(2, 2, 12, 12, '#52666b'); rect(4, 4, 8, 8, '#859995'); line(7, 4, 7, 11, '#d5c3a0'); line(4, 7, 11, 7, '#d5c3a0'); put(4, 4, '#c4d0c8'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#3e2f27'); rect(1, 2, 14, 12, '#7d5a3e'); line(2, 4, 13, 4, '#c49e69'); line(2, 12, 13, 12, '#30241e'); put(4, 7, '#ddc99d'); put(8, 7, '#ddc99d'); put(12, 7, '#ddc99d'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#5b4a3b'); rect(1, 1, 14, 14, '#88734f'); for (let y = 2; y < 15; y += 4) line(2, y, 13, y, '#40322a'); line(4, 2, 4, 14, '#c4a36e'); line(11, 2, 11, 14, '#c4a36e'); put(7, 6, '#e0d0aa'); },
  ({ rect, line }) => { rect(0, 0, 16, 16, '#49372d'); rect(2, 2, 12, 12, '#b19164'); line(3, 4, 12, 4, '#4f4035'); line(3, 8, 12, 8, '#4f4035'); line(3, 12, 12, 12, '#4f4035'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#40332b'); rect(2, 2, 12, 12, '#76533a'); rect(3, 3, 10, 2, '#b28c5e'); rect(4, 7, 8, 6, '#39302a'); line(4, 13, 11, 13, '#c3a168'); put(7, 9, '#dfc696'); },
  ({ rect, line }) => { rect(0, 0, 16, 16, '#43352c'); rect(2, 3, 12, 11, '#9a7b56'); rect(3, 4, 10, 9, '#695039'); line(4, 5, 11, 5, '#d0af75'); line(4, 8, 11, 8, '#d0af75'); line(4, 11, 11, 11, '#d0af75'); },
  ({ rect, put, line }) => { rect(0, 0, 16, 16, '#47362a'); rect(2, 4, 12, 9, '#9a6b46'); rect(4, 3, 8, 2, '#d1aa69'); rect(4, 6, 8, 4, '#312922'); put(6, 7, '#e3c48a'); line(2, 13, 13, 13, '#30241e'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#484541'); for (let y = 0; y < 16; y += 5) { const shift = y % 10 ? 2 : 0; for (let x = shift; x < 16; x += 8) { rect(x, y, 7, 4, '#5a5650'); line(x + 1, y, x + 5, y, '#6d665d'); put(x + 6, y + 3, '#363533'); } } },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#504c47'); for (let y = 1; y < 16; y += 5) { const shift = y % 10 ? 4 : 1; for (let x = shift; x < 16; x += 8) { rect(x, y, 6, 4, '#625c54'); line(x + 1, y, x + 4, y, '#797166'); } } put(3, 12, '#373633'); put(13, 6, '#777066'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#756d62'); rect(0, 0, 15, 15, '#92887b'); line(0, 7, 15, 7, '#6b6258'); line(7, 0, 7, 15, '#6b6258'); line(2, 2, 5, 2, '#aaa08f'); line(10, 10, 13, 10, '#aaa08f'); put(6, 6, '#5d554c'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#5b554d'); rect(0, 0, 16, 5, '#83796c'); line(0, 5, 15, 5, '#3c3934'); line(2, 8, 14, 8, '#70685f'); line(4, 9, 12, 9, '#49453f'); put(3, 13, '#82796d'); put(13, 12, '#373633'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#3d3b39'); for (let y = 1; y < 16; y += 5) { const shift = y % 10 ? 3 : 0; for (let x = shift; x < 16; x += 7) { rect(x, y, 6, 4, '#514e4a'); line(x + 1, y, x + 4, y, '#67615a'); put(x + 5, y + 3, '#302f2d'); } } },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#403e3b'); for (let y = 0; y < 16; y += 5) { const shift = y % 10 ? 1 : 4; for (let x = shift; x < 16; x += 8) { rect(x, y, 6, 4, '#55514b'); line(x, y, x + 3, y, '#777067'); } } line(1, 9, 14, 9, '#66615a'); put(5, 10, '#797267'); put(12, 10, '#2e2d2b'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#746c61'); rect(0, 0, 15, 15, '#9a9082'); line(0, 7, 15, 7, '#6b6259'); line(7, 0, 7, 15, '#6b6259'); line(1, 1, 6, 1, '#b0a494'); line(9, 9, 14, 9, '#b0a494'); put(6, 6, '#554d45'); },
  ({ rect, line, put }) => { rect(0, 0, 16, 16, '#534e47'); rect(0, 0, 16, 5, '#81786b'); line(0, 5, 15, 5, '#393733'); line(1, 8, 14, 8, '#6c655c'); line(3, 9, 12, 9, '#48443f'); put(2, 12, '#777064'); put(13, 13, '#343331'); },
];
function drawText({ put, text, x, y, color }) {
  const glyphs = { 'К': ['101','110','100','110','101'], 'Н': ['101','101','111','101','101'], 'И': ['101','101','111','111','101'], 'Г': ['111','100','100','100','100'], 'П': ['111','101','101','101','101'], 'Е': ['111','100','110','100','111'], 'Ч': ['101','101','111','001','001'], 'Ь': ['100','100','110','101','110'], 'А': ['010','101','111','101','101'], 'Я': ['011','101','011','101','101'], 'О': ['111','101','101','101','111'], 'В': ['110','101','110','101','110'] };
  for (let i = 0; i < text.length; i++) { const glyph = glyphs[text[i]]; if (!glyph) continue; for (let row = 0; row < glyph.length; row++) for (let col = 0; col < 3; col++) if (glyph[row][col] === '1') put(x + i * 4 + col, y + row, color); }
}
function buildTileset() {
  return image(256, 160, ({ put, rect, line }) => {
    for (let i = 0; i < tileDrawers.length; i++) tileDrawers[i]({ put: (x,y,c) => put((i % 16) * 16 + x, Math.floor(i / 16) * 16 + y, c), rect: (x,y,w,h,c) => rect((i % 16) * 16 + x, Math.floor(i / 16) * 16 + y, w,h,c), line: (x1,y1,x2,y2,c) => line((i % 16) * 16 + x1, Math.floor(i/16)*16+y1, (i%16)*16+x2, Math.floor(i/16)*16+y2,c) });
    drawText({ put, text: 'КНИГИ', x: 210, y: 118, color: '#4a3126' });
  });
}

function makeCharacterSprite(card) {
  const cloth = card.sprite.palette.cloth, trim = card.sprite.palette.trim, headwear = card.sprite.palette.headwear;
  return image(48, 96, ({ put, rect, line }) => {
    for (let direction = 0; direction < 4; direction++) for (let frame = 0; frame < 3; frame++) {
      const ox = frame * 16, oy = direction * 24;
      const p = (x,y,c) => put(ox + x,y + oy,c); const r=(x,y,w,h,c)=>rect(ox+x,oy+y,w,h,c);
      p(5,21,'#332a25'); p(10,22,'#332a25');
      const bob = frame === 1 ? -1 : frame === 2 ? 1 : 0;
      r(5,2+bob,6,6,'#211b18'); r(6,3+bob,4,4,palette.skin); r(6,7+bob,4,2,palette.skinShade);
      if (card.sprite.style === 'cap') { r(4,2+bob,8,2,headwear); r(3,4+bob,10,1,headwear); }
      else if (card.sprite.style === 'scarf') { r(5,2+bob,6,2,headwear); r(4,3+bob,2,4,headwear); r(10,3+bob,2,4,headwear); }
      else if (card.sprite.style === 'hair') { r(4,2+bob,2,5,'#302522'); r(10,2+bob,2,5,'#302522'); r(5,2+bob,6,2,'#302522'); }
      else { r(4,2+bob,8,2,headwear); r(5,1+bob,6,1,headwear); }
      if (direction === 0) { p(7,5+bob,'#281f1c'); p(10,5+bob,'#281f1c'); }
      if (direction === 2) { r(5,3+bob,2,4,'#211b18'); p(7,5+bob,'#281f1c'); }
      if (direction === 3) { r(9,3+bob,2,4,'#211b18'); p(8,5+bob,'#281f1c'); }
      r(6,8+bob,4,2,'#30231f');
      if (card.sprite.style === 'apron') { r(4,9+bob,8,7,cloth); r(6,10+bob,5,6,trim); r(5,8+bob,6,2,trim); }
      else if (card.sprite.style === 'dress') { r(4,9+bob,8,8,cloth); r(3,14+bob,10,3,trim); r(5,9+bob,6,4,cloth); }
      else if (card.sprite.style === 'coat') { r(4,9+bob,8,7,cloth); r(7,9+bob,2,7,trim); p(6,12+bob,'#d3c2a0'); }
      else { r(4,9+bob,8,7,cloth); r(4,14+bob,8,2,trim); p(7,10+bob,'#c7ab7a'); }
      r(3,10+bob,2,5,cloth); r(11,10+bob,2,5,cloth); p(3,15+bob,palette.skin); p(12,15+bob,palette.skin);
      if (card.id === 'courier_pavel') { r(11,9+bob,3,6,'#75533d'); r(12,10+bob,2,2,'#bb925b'); }
      const legShift = frame === 1 ? -1 : frame === 2 ? 1 : 0;
      r(5+legShift,16+bob,3,5,cloth); r(9-legShift,16+bob,3,5,cloth); r(4+legShift,21+bob,4,2,'#2e2824'); r(9-legShift,21+bob,4,2,'#2e2824');
      if (frame !== 0) { r(5,18+bob,2,2,trim); r(10,18+bob,2,2,trim); }
    }
  });
}

function tileLayer(name, width, height, data, id) { return { id, name, type: 'tilelayer', width, height, x: 0, y: 0, opacity: 1, visible: true, data }; }
function objectLayer(name, objects, id) { return { id, name, type: 'objectgroup', draworder: 'topdown', objects }; }
function obj(id, name, type, x, y, properties = {}) { return { id, name, type, x: x * 16, y: y * 16, width: 16, height: 16, visible: true, properties: Object.entries(properties).map(([name,value]) => ({ name, type: typeof value === 'number' ? 'int' : 'string', value })) }; }
function makeMap({ id, name, width, height, baseGid, observerStart, architecture, collision, objects, npcs, mapProperties = {} }) {
  const ground = Array.from({ length: width * height }, (_, at) => baseGid + ((at * 17 + Math.floor(at / width) * 7) % 4 === 0 ? 1 : 0));
  const decor = Array(width * height).fill(0);
  const arch = Array(width * height).fill(0);
  const block = Array(width * height).fill(0);
  const set = (layer,x,y,gid) => { if (x >= 0 && y >= 0 && x < width && y < height) layer[y * width + x] = gid; };
  for (const [x,y,gid] of architecture) set(arch,x,y,gid);
  for (const [x,y,gid] of collision) set(block,x,y,gid);
  for (const [x,y,gid] of (mapProperties.decorations ?? [])) set(decor,x,y,gid);
  for (const [x,y,gid] of (mapProperties.groundTiles ?? [])) set(ground,x,y,gid);
  const { decorations, groundTiles, ...metadata } = mapProperties;
  return {
    type: 'map', version: '1.10', tiledversion: '1.10.2', orientation: 'orthogonal', renderorder: 'right-down', compressionlevel: -1,
    name: id, mapId: id, metadata: { displayNameKo: name, observerStart, ...metadata },
    width, height, tilewidth: 16, tileheight: 16, infinite: false, nextlayerid: 7, nextobjectid: 1,
    properties: Object.entries({ mapId: id, displayNameKo: name, observerStart, ...metadata }).map(([name,value]) => ({ name, type: 'string', value: JSON.stringify(value) })),
    tilesets: [{ firstgid: 1, name: 'petersburg-1847-original', image: '../assets/petersburg-tiles.png', imagewidth: 256, imageheight: 160, tilewidth: 16, tileheight: 16, tilecount: tileDrawers.length, columns: 16 }],
    layers: [tileLayer('Ground',width,height,ground,1), tileLayer('Architecture',width,height,arch,2), tileLayer('Collision',width,height,block,3), tileLayer('StreetDetail',width,height,decor,4), objectLayer('Interactions',objects,5), objectLayer('NPCs',npcs,6)],
  };
}

function buildMaps() {
  const streetW = 30, streetH = 20, streetArch = [], streetCollision = [], streetDecor = [], streetGround = [];
  for (let y = 8; y <= 9; y++) for (let x = 1; x <= 28; x++) streetGround.push([x,y,43]);
  for (let x = 1; x <= 28; x++) streetGround.push([x,10,44]);
  for (let y = 11; y <= 17; y++) for (let x = 1; x <= 28; x++) streetGround.push([x,y,((x + y * 3) % 5 === 0) ? 42 : 41]);
  for (let x = 1; x <= 28; x++) streetGround.push([x,18,43]);
  for (let x = 0; x < streetW; x++) { streetCollision.push([x,0,1],[x,19,1]); }
  for (let y = 0; y < streetH; y++) streetCollision.push([0,y,1],[29,y,1]);
  for (let y = 2; y <= 7; y++) for (let x = 1; x <= 28; x++) { streetArch.push([x,y,7]); streetCollision.push([x,y,1]); }
  for (const x of [3,4,8,9,15,16,25,26]) { streetArch.push([x,3,10],[x,5,10]); }
  for (const x of [6,12,19,27]) streetArch.push([x,4,11]);
  for (let x = 4; x < 10; x++) streetArch.push([x,7,12]);
  streetArch.push([22,8,13],[6,2,14],[13,2,14],[23,2,14]);
  streetCollision.push([21,8,1],[23,8,1],[22,7,1]);
  streetCollision.push([11,15,1],[3,8,1],[5,8,1],[4,7,1],[15,8,1],[17,8,1],[16,7,1]);
  streetDecor.push([2,10,15],[27,11,15],[3,16,16],[26,15,16],[6,12,18],[18,12,18]);
  const streetObjects = [
    obj(1,'신문 가판대','source',7,13,{ sourceId: 'LIT-TURGENEV-KHOR-KALYNYCH-1847', actionId: 'READ_PUBLIC_PRINT', scope: 'public' }),
    obj(2,'돌 틈에 낀 쪽지','clue',12,16,{ evidenceId: 'PRINTSHOP_ROUTING_NOTE', actionId: 'OBSERVE_NOTE', scope: 'fictional_personal_record' }),
    obj(3,'인쇄소 문','map-exit',22,8,{ exitId: 'nevsky-printshop-door', targetMapId: 'printshop', arrivalX: 12, arrivalY: 14, returnExitId: 'printshop-nevsky-door', publicAccess: true }),
    obj(4,'가로등 아래 배달 표식','clue',25,11,{ evidenceId: 'COURIER_ROUTE_MARK', actionId: 'OBSERVE_MARK', scope: 'public' }),
    obj(5,'관청 쪽 출입문','map-exit',4,8,{ exitId:'nevsky-chancery-door',targetMapId:'chancery',arrivalX:12,arrivalY:14,returnExitId:'chancery-nevsky-door',publicAccess:true }),
    obj(6,'안뜰로 드는 문','map-exit',16,8,{ exitId:'nevsky-courtyard-gate',targetMapId:'courtyard',arrivalX:11,arrivalY:13,returnExitId:'courtyard-nevsky-gate',publicAccess:true }),
  ];
  const streetNpcs = [
    obj(10,'알렉세이 오를로프','npc',18,12,{ hostId: 'clerk_alexei' }),
    obj(11,'파벨 안토노프','npc',10,16,{ hostId: 'courier_pavel' }),
    obj(12,'안나','npc',4,15,{ hostId: 'seamstress_anna' }),
    obj(13,'예카테리나 벨로바','npc',2,12,{hostId:'printer_ekaterina'}),
    obj(14,'미하일','npc',27,15,{hostId:'tenant_mikhail'}),
    obj(15,'레프','npc',25,16,{hostId:'bookseller_lev'}),
  ];
  const street = makeMap({ id:'nevsky', name:'네프스키 거리', width:streetW,height:streetH,baseGid:1,observerStart:{x:11,y:16},architecture:streetArch,collision:streetCollision,objects:streetObjects,npcs:streetNpcs, mapProperties:{ date:'1847-06-01', mapClass:'REAL_WORLD_RECONSTRUCTION', geography:'stylized, not georeferenced', sourceIds:['OBJ-PETERSBURG-PLAN-1840','OBJ-SADOVNIKOV-1835'], note:'1830–1835 panorama informs the continuous facade rhythm and active main-street scene; paving, curb widths, and exact shop positions are stylized reconstructions, not surveyed details.', decorations:streetDecor, groundTiles:streetGround }});

  const shopW=24,shopH=18,shopArch=[],shopCollision=[],shopDecor=[];
  for (let x=0;x<shopW;x++) shopCollision.push([x,0,1],[x,17,1]);
  for (let y=0;y<shopH;y++) shopCollision.push([0,y,1],[23,y,1]);
  for (let x=1;x<23;x++) { shopArch.push([x,1,8],[x,2,8],[x,3,8]); shopCollision.push([x,1,1],[x,2,1],[x,3,1]); }
  for (let x=1;x<23;x+=1) shopArch.push([x,4,9]);
  shopArch.push([4,2,25],[18,2,25],[12,16,13],[5,4,14]);
  shopCollision.push([11,16,1],[13,16,1]);
  shopCollision.push([5,9,1],[6,9,1],[7,9,1],[17,8,1],[18,8,1]);
  shopDecor.push([4,7,21],[8,7,22],[15,7,20],[19,7,23],[4,12,24],[17,12,27]);
  const shopObjects=[
    obj(20,'교정쇄가 놓인 작업대','quest-object',11,12,{ questId:'PRINTSHOP_PROOF_1847', actionId:'OPEN_PROOF', sourceId:'LIT-TURGENEV-KHOR-KALYNYCH-1847' }),
    obj(21,'활자 서랍','inspectable',6,8,{ evidenceId:'TYPE_CASE_LAYOUT', actionId:'INSPECT_TYPE_CASE' }),
    obj(22,'작업 장부','inspectable',19,9,{ evidenceId:'SHOP_LEDGER_NOTE', actionId:'READ_LEDGER' }),
    obj(23,'네프스키로 나가는 문','map-exit',12,16,{ exitId:'printshop-nevsky-door', targetMapId:'nevsky', arrivalX:22, arrivalY:9, returnExitId:'nevsky-printshop-door', publicAccess:true }),
    obj(24,'《Современник》 1847년 제1호','source',8,12,{sourceId:'LIT-TURGENEV-KHOR-KALYNYCH-1847',actionId:'READ_PUBLIC_PRINT',scope:'public'}),
  ];
  const shopNpcs=[
    obj(30,'예카테리나 벨로바','npc',11,13,{hostId:'printer_ekaterina'}),
    obj(31,'알렉세이 오를로프','npc',20,14,{hostId:'clerk_alexei'}),
    obj(32,'파벨 안토노프','npc',20,13,{hostId:'courier_pavel'}),
    obj(33,'안나','npc',20,12,{hostId:'seamstress_anna'}),
    obj(34,'미하일','npc',20,11,{hostId:'tenant_mikhail'}),
    obj(35,'레프','npc',20,10,{hostId:'bookseller_lev'}),
  ];
  const shop=makeMap({id:'printshop',name:'네프스키 인쇄소',width:shopW,height:shopH,baseGid:5,observerStart:{x:11,y:14},architecture:shopArch,collision:shopCollision,objects:shopObjects,npcs:shopNpcs,mapProperties:{date:'1847-06-01',mapClass:'REAL_WORLD_RECONSTRUCTION',geography:'fictional shop interior, not a documented named address',sourceIds:['OBJ-SOV-1847','OBJ-PETERSBURG-PLAN-1840'],note:'A reconstructed working printshop. No claim is made that this exact room or business is documented.',decorations:shopDecor}});

  const officeW=24,officeH=18,officeArch=[],officeCollision=[],officeDecor=[];
  for(let x=0;x<officeW;x++) officeCollision.push([x,0,1],[x,17,1]);
  for(let y=0;y<officeH;y++) officeCollision.push([0,y,1],[23,y,1]);
  for(let x=2;x<22;x++) { officeArch.push([x,2,8],[x,3,8]); officeCollision.push([x,2,1],[x,3,1]); }
  for(const [x,y,gid] of [[3,1,24],[8,1,24],[15,1,24],[20,1,24],[4,7,18],[5,7,18],[6,7,18],[17,7,18],[18,7,18],[19,7,18],[8,11,21],[15,11,21]]) officeArch.push([x,y,gid]);
  officeCollision.push([4,7,1],[5,7,1],[6,7,1],[17,7,1],[18,7,1],[19,7,1]);
  officeCollision.push([11,16,1],[13,16,1],[11,12,1],[12,12,1],[13,12,1]);
  officeDecor.push([3,5,19],[20,5,19],[4,13,23],[19,13,23]);
  const officeObjects=[
    obj(40,'접수대 위의 메모','inspectable',7,10,{evidenceId:'CHANCERY_INTAKE_NOTE',actionId:'READ_INTAKE_NOTE',scope:'fictional_office_record'}),
    obj(41,'반송 서류 묶음','inspectable',17,10,{evidenceId:'RETURNED_PAPERS_NOTE',actionId:'INSPECT_RETURNED_PAPERS',scope:'fictional_office_record'}),
    obj(42,'네프스키로 나가는 문','map-exit',12,16,{exitId:'chancery-nevsky-door',targetMapId:'nevsky',arrivalX:4,arrivalY:9,returnExitId:'nevsky-chancery-door',publicAccess:true}),
  ];
  const officeNpcs=[
    obj(50,'알렉세이 오를로프','npc',11,13,{hostId:'clerk_alexei'}),
    obj(51,'예카테리나 벨로바','npc',19,14,{hostId:'printer_ekaterina'}),
    obj(52,'파벨 안토노프','npc',19,13,{hostId:'courier_pavel'}),
    obj(53,'안나','npc',19,12,{hostId:'seamstress_anna'}),
    obj(54,'미하일','npc',19,11,{hostId:'tenant_mikhail'}),
    obj(55,'레프','npc',19,10,{hostId:'bookseller_lev'}),
  ];
  const chancery=makeMap({id:'chancery',name:'관청 접수실',width:officeW,height:officeH,baseGid:5,observerStart:{x:12,y:14},architecture:officeArch,collision:officeCollision,objects:officeObjects,npcs:officeNpcs,mapProperties:{date:'1847-06-01',mapClass:'REAL_WORLD_RECONSTRUCTION',geography:'fictional office interior; no specific historical institution or room is claimed',sourceIds:['OBJ-PETERSBURG-PLAN-1840'],note:'A fictional clerk’s workroom reconstructed for the game. The register and papers are fictional props.',decorations:officeDecor}});

  const yardW=24,yardH=18,yardArch=[],yardCollision=[],yardDecor=[];
  for(let x=0;x<yardW;x++) yardCollision.push([x,0,1],[x,17,1]);
  for(let y=0;y<yardH;y++) yardCollision.push([0,y,1],[23,y,1]);
  for(let x=1;x<10;x++) { yardArch.push([x,2,7],[x,3,7],[x,4,7]); yardCollision.push([x,2,1],[x,3,1],[x,4,1]); }
  for(let x=15;x<23;x++) { yardArch.push([x,2,7],[x,3,7],[x,4,7]); yardCollision.push([x,2,1],[x,3,1],[x,4,1]); }
  for(const [x,y,gid] of [[3,3,10],[7,3,10],[17,3,10],[21,3,10],[3,7,18],[4,7,18],[19,8,22],[20,8,22],[7,12,23],[17,13,23]]) yardArch.push([x,y,gid]);
  yardCollision.push([4,10,1],[5,10,1],[18,11,1],[19,11,1]);
  yardDecor.push([11,6,15],[12,6,15],[13,6,15],[14,6,15],[11,10,16],[12,10,16],[13,10,16],[14,10,16],[3,14,20],[20,14,20]);
  const yardObjects=[
    obj(60,'방세가 적힌 쪽지','inspectable',8,12,{evidenceId:'COURTYARD_RENT_NOTE',actionId:'READ_RENT_NOTE',scope:'fictional_household_record'}),
    obj(61,'우물가의 물동이','inspectable',15,13,{evidenceId:'COURTYARD_WELL_NOTE',actionId:'INSPECT_WELL',scope:'fictional_scene_clue'}),
    obj(62,'거리로 나가는 안뜰 문','map-exit',12,16,{exitId:'courtyard-nevsky-gate',targetMapId:'nevsky',arrivalX:16,arrivalY:9,returnExitId:'nevsky-courtyard-gate',publicAccess:true}),
  ];
  const yardNpcs=[
    obj(70,'미하일','npc',10,13,{hostId:'tenant_mikhail'}),
    obj(71,'안나','npc',7,13,{hostId:'seamstress_anna'}),
    obj(72,'알렉세이 오를로프','npc',20,13,{hostId:'clerk_alexei'}),
    obj(73,'예카테리나 벨로바','npc',20,12,{hostId:'printer_ekaterina'}),
    obj(74,'파벨 안토노프','npc',20,11,{hostId:'courier_pavel'}),
    obj(75,'레프','npc',20,10,{hostId:'bookseller_lev'}),
  ];
  const courtyard=makeMap({id:'courtyard',name:'하숙집 안뜰',width:yardW,height:yardH,baseGid:1,observerStart:{x:11,y:13},architecture:yardArch,collision:yardCollision,objects:yardObjects,npcs:yardNpcs,mapProperties:{date:'1847-06-01',mapClass:'REAL_WORLD_RECONSTRUCTION',geography:'fictional lodging courtyard; not a documented named address',sourceIds:['OBJ-PETERSBURG-PLAN-1840','OBJ-SADOVNIKOV-1835'],note:'A reconstructed shared courtyard and rented rooms. Household notes and named residents are fictional.',decorations:yardDecor}});
  return { street, shop, chancery, courtyard };
}

const characters = [
  { id:'clerk_alexei', kind:'FICTIONAL', displayNameKo:'알렉세이 오를로프', displayNameRu:'Алексей Орлов', ageAtDate:{value:31,status:'fictional_character_design'}, socialEstate:'service_class', occupation:'관청의 문서 정리 서기', rank:{value:'10등급 콜레기스키 세크레타리',ru:'коллежский секретарь',status:'fictional_design'}, legalMobility:'공무 문서가 있는 기관과 공개 거리만 이용; 인쇄·최종 검열 권한 없음', wealthBracket:'modest', money:{amount:64,unit:'kopeks',status:'designedEstimate'}, literacy:'러시아어 행정 문서에 능숙', health:'working', reputationByGroup:{office:'careful'}, risk:'공식 장부에 남는 행위에 신중', relations:{}, secretKnowledge:[{id:'ALEXEI_OFFICE_ROUTING',summaryKo:'상신 전에는 접수 번호와 담당자를 먼저 확인한다.'}], knownEvidence:[], privateKnowledgeIds:['ALEXEI_OFFICE_ROUTING'], knownEvidenceIds:[], desires:'접수 순서를 틀리지 않고 상급자 검토를 받는다', fears:'권한 밖 판단이 공식 서명으로 남는 것', taboos:['상급자의 결재를 대신하지 않는다'], speechRhythm:'짧고 절차를 확인한 뒤 말한다', lexicon:['접수','원본','상신'], emotions:['절제','걱정','마른 농담'], personalObjective:'인쇄소에서 올라온 교정쇄의 접수 경로를 확인한다', objectiveByChapter:{'1847':'한 인쇄물의 접수와 전달 경로를 기록한다'}, allowedMaps:['nevsky','printshop','chancery'], start:{mapId:'chancery',x:11,y:13}, wealthBracketStatus:'designedEstimate', inventory:['작은 수첩','연필'], sourceIds:[], canonConstraint:'fictional person; never replaces a real official or makes a final historical censorship decision', reconstructionDisclaimer:'허구 인물이며 직무 범위와 경제 수치는 플레이용 재구성이다.', sprite:{file:'assets/alexei.png',frameWidth:16,frameHeight:24,style:'coat',palette:{cloth:'#3b4144',trim:'#874333',headwear:'#51473b'}} },
  { id:'printer_ekaterina', kind:'FICTIONAL', displayNameKo:'예카테리나 벨로바', displayNameRu:'Екатерина Белова', ageAtDate:{value:28,status:'fictional_character_design'}, socialEstate:'urban_artisan', occupation:'인쇄소 교정·활자 정리 노동자', rank:{value:null,ru:null,status:'not_applicable'}, legalMobility:'자신의 작업장과 공개 거리 이용; 관청 기록실 출입 권한 없음', wealthBracket:'poor', money:{amount:27,unit:'kopeks',status:'designedEstimate'}, literacy:'교정쇄를 읽고 활자 오류를 찾을 수 있음', health:'working', reputationByGroup:{workshop:'reliable'}, risk:'인쇄물에 남는 이름과 인쇄 비용을 함께 계산', relations:{}, secretKnowledge:[{id:'EKATERINA_PROOF_ORDER',summaryKo:'오늘 교정쇄는 배달되기 전까지 작업대 위에 있다.'}], knownEvidence:[], privateKnowledgeIds:['EKATERINA_PROOF_ORDER'], knownEvidenceIds:[], desires:'작업한 교정쇄의 전달처와 책임자를 확인한다', fears:'자신이 보지 못한 문장까지 자기 이름으로 책임지는 것', taboos:['남의 이름을 허락 없이 원고에 적지 않는다'], speechRhythm:'질문을 짧게 던지고 낱말을 바로잡는다', lexicon:['교정쇄','활자','인쇄비'], emotions:['집중','빈정거림','불안'], personalObjective:'교정쇄를 돌려보낼지, 보류할지, 검토용으로 묶을지 정한다', objectiveByChapter:{'1847':'교정쇄의 실제 전달 경로를 정한다'}, allowedMaps:['nevsky','printshop','courtyard'], start:{mapId:'printshop',x:11,y:13}, wealthBracketStatus:'designedEstimate', inventory:['활자 집게','천 조각'], sourceIds:['OBJ-SOV-1847'], canonConstraint:'fictional worker; her choices affect only a reconstructed duplicate proof, never the periodical’s attested publication', reconstructionDisclaimer:'허구 인물이다. 장면의 교정쇄와 작업장은 역사적 사례를 바탕으로 한 재구성이다.', sprite:{file:'assets/ekaterina.png',frameWidth:16,frameHeight:24,style:'apron',palette:{cloth:'#465345',trim:'#b17a49',headwear:'#68533e'}} },
  { id:'courier_pavel', kind:'FICTIONAL', displayNameKo:'파벨 안토노프', displayNameRu:'Павел Антонов', ageAtDate:{value:34,status:'fictional_character_design'}, socialEstate:'urban_laborer', occupation:'인쇄물과 봉투를 나르는 배달원', rank:{value:null,ru:null,status:'not_applicable'}, legalMobility:'배달 경로와 공개 거리 이용; 봉투를 열 권한이나 관청 출입 권한 없음', wealthBracket:'precarious', money:{amount:11,unit:'kopeks',status:'designedEstimate'}, literacy:'주소와 배달 표식을 판독함; 봉투 안의 내용은 알지 못함', health:'working', reputationByGroup:{street:'knows_the_routes'}, risk:'지각하면 품삯과 다음 일감을 잃을 수 있음', relations:{}, secretKnowledge:[{id:'PAVEL_CLOSED_ENVELOPE',summaryKo:'배달 봉투는 봉인되어 있고 내용은 모른다.'}], knownEvidence:[], privateKnowledgeIds:['PAVEL_CLOSED_ENVELOPE'], knownEvidenceIds:[], desires:'정해진 시각에 봉투를 온전하게 건넨다', fears:'봉투가 훼손됐다는 누명을 쓰는 것', taboos:['밀봉된 편지를 읽지 않는다'], speechRhythm:'길과 날씨, 남은 시간을 먼저 짚는다', lexicon:['골목','빗물','마감'], emotions:['초조','유머','경계'], personalObjective:'봉투를 열지 않고 수취인에게 전달한다', objectiveByChapter:{'1847':'배달 경로를 지키며 인쇄소에 들른다'}, allowedMaps:['nevsky','printshop','courtyard'], start:{mapId:'nevsky',x:10,y:16}, wealthBracketStatus:'designedEstimate', inventory:['밀봉 봉투','끈 달린 가방'], sourceIds:[], canonConstraint:'fictional courier; sealed contents are not available without a witnessed opening event', reconstructionDisclaimer:'허구 인물이다. 이동 시간과 품삯은 시스템을 위한 추정치다.', sprite:{file:'assets/pavel.png',frameWidth:16,frameHeight:24,style:'cap',palette:{cloth:'#713e31',trim:'#bd9b64',headwear:'#44342d'}} },
  { id:'seamstress_anna', kind:'FICTIONAL', displayNameKo:'안나', displayNameRu:'Анна', ageAtDate:{value:25,status:'fictional_character_design'}, socialEstate:'urban_laborer', occupation:'옷 수선과 바느질 품을 받는 노동자', rank:{value:null,ru:null,status:'not_applicable'}, legalMobility:'하숙집·작업장·공개 거리 이용; 관청과 살롱 출입은 소개/고용 없이 불가', wealthBracket:'precarious', money:{amount:18,unit:'kopeks',status:'designedEstimate'}, literacy:'짧은 인쇄 문장을 읽을 수 있음', health:'working', reputationByGroup:{courtyard:'steady_worker'}, risk:'오늘 일감을 놓치면 방세 납부가 늦어진다', relations:{}, secretKnowledge:[{id:'ANNA_WORK_ORDER',summaryKo:'수선 맡긴 옷의 주인은 아직 값을 치르지 않았다.'}], knownEvidence:[], privateKnowledgeIds:['ANNA_WORK_ORDER'], knownEvidenceIds:[], desires:'수선값과 다음 일감을 확보한다', fears:'다른 사람의 소문 때문에 일감을 잃는 것', taboos:['당사자가 없는 자리에서 이름을 퍼뜨리지 않는다'], speechRhythm:'짧고 분명하며 돈과 시간을 숨기지 않는다', lexicon:['수선값','방세','마감'], emotions:['피로','단단함','가벼운 농담'], personalObjective:'교정쇄를 읽어도 되는지 물어보고 오늘 품삯을 지킨다', objectiveByChapter:{'1847':'인쇄소에 들른 이유를 밝히되 남의 편지 내용은 말하지 않는다'}, allowedMaps:['nevsky','courtyard'], start:{mapId:'nevsky',x:7,y:14}, wealthBracketStatus:'designedEstimate', inventory:['바늘통','남색 실','수선 맡은 소매'], sourceIds:[], canonConstraint:'fictional resident; has no privileged access to official or private correspondence', reconstructionDisclaimer:'허구 인물이다. 품삯·재산은 재구성용 설계 수치다.', sprite:{file:'assets/anna.png',frameWidth:16,frameHeight:24,style:'scarf',palette:{cloth:'#5d4436',trim:'#9d7449',headwear:'#765c4b'}} },
  { id:'tenant_mikhail',kind:'FICTIONAL',displayNameKo:'미하일',displayNameRu:'Михаил',ageAtDate:{value:37,status:'fictional_character_design'},socialEstate:'urban_laborer',occupation:'하숙집에 머물며 짐 나르는 품을 받는 일용직 노동자',rank:{value:null,ru:null,status:'not_applicable'},legalMobility:'안뜰과 공개 거리 이용; 관청 기록실과 인쇄 작업장에는 들어갈 권한이 없음',wealthBracket:'precarious',money:{amount:9,unit:'kopeks',status:'designedEstimate'},literacy:'주소와 짧은 표지는 알아보지만 긴 문서는 천천히 읽는다',health:'working',reputationByGroup:{lodging:'keeps_to_himself'},risk:'하루 일감이 끊기면 방세와 식비가 함께 밀린다',relations:{},secretKnowledge:[{id:'MIKHAIL_RENT_DUE',summaryKo:'방세를 내일까지 마련해야 하고 집주인은 한 번만 미뤄 주기로 했다.'}],knownEvidence:[],privateKnowledgeIds:['MIKHAIL_RENT_DUE'],knownEvidenceIds:[],desires:'오늘 받을 품삯으로 방을 지키고 다음 일감을 얻는다',fears:'밀린 방세 때문에 짐을 밖으로 내놓게 되는 것',taboos:['다른 하숙인의 사정을 주인에게 함부로 전하지 않는다'],speechRhythm:'돈과 날짜를 확인한 뒤 짧게 대답한다',lexicon:['방세','품삯','하루치'],emotions:['걱정','눈치','조용한 끈기'],personalObjective:'방세 쪽지의 액수를 확인하고 오늘 일감을 구한다',objectiveByChapter:{'1847':'하숙집 안뜰에서 방세와 일감 문제를 해결한다'},allowedMaps:['nevsky','courtyard'],start:{mapId:'courtyard',x:10,y:13},wealthBracketStatus:'designedEstimate',inventory:['천 보자기','나무 숟가락'],sourceIds:[],canonConstraint:'fictional resident; rent and wages are designed scene values, not a historical case record',reconstructionDisclaimer:'허구 주민이며 수입과 방세는 플레이용으로 만든 수치다.',sprite:{file:'assets/mikhail.png',frameWidth:16,frameHeight:24,style:'scarf',palette:{cloth:'#4f5350',trim:'#b18c5e',headwear:'#5e5545'}} },
  { id:'bookseller_lev',kind:'FICTIONAL',displayNameKo:'레프',displayNameRu:'Лев',ageAtDate:{value:42,status:'fictional_character_design'},socialEstate:'petty_bourgeois',occupation:'가판과 작은 서가에서 책·잡지를 파는 상인',rank:{value:null,ru:null,status:'not_applicable'},legalMobility:'공개 거리와 거래 중인 인쇄소 이용; 관청 기록실 출입은 허가가 필요하다',wealthBracket:'modest',money:{amount:83,unit:'kopeks',status:'designedEstimate'},literacy:'러시아어 인쇄물과 거래 장부를 읽는다',health:'working',reputationByGroup:{trade:'careful'},risk:'팔리지 않은 재고와 외상값이 다음 발주를 막을 수 있다',relations:{},secretKnowledge:[{id:'LEV_STOCK_NOTE',summaryKo:'새 잡지 묶음의 값은 아직 치르지 않았고 반품 기한이 남아 있다.'}],knownEvidence:[],privateKnowledgeIds:['LEV_STOCK_NOTE'],knownEvidenceIds:[],desires:'외상값을 회수하고 팔리지 않은 책의 손실을 줄인다',fears:'거래처가 값을 미루고 재고 책임을 자신에게 돌리는 것',taboos:['구매자가 보지 못한 문장을 읽었다고 말하지 않는다'],speechRhythm:'가격과 반품 기한을 먼저 말하고 상대 반응을 살핀다',lexicon:['외상','묶음','반품'],emotions:['계산','호기심','완곡한 경계'],personalObjective:'신문 가판의 재고와 반품 기한을 확인한다',objectiveByChapter:{'1847':'읽을거리의 값과 유통 경로를 확인한다'},allowedMaps:['nevsky','printshop','courtyard'],start:{mapId:'nevsky',x:25,y:16},wealthBracketStatus:'designedEstimate',inventory:['접이식 장부','동전 주머니'],sourceIds:['OBJ-SOV-1847'],canonConstraint:'fictional bookseller; invented prices and business terms are not treated as period evidence',reconstructionDisclaimer:'허구 인물이며 재고·수입은 이 장면을 위한 설계 수치다.',sprite:{file:'assets/lev.png',frameWidth:16,frameHeight:24,style:'coat',palette:{cloth:'#4c4a43',trim:'#bc9a67',headwear:'#675542'}} },
];

const dailySchedules = {
  clerk_alexei:[{atMinute:540,mapId:'chancery',position:{x:11,y:13},activityKo:'접수대에서 문서를 정리한다'},{atMinute:600,mapId:'chancery',position:{x:14,y:13},activityKo:'안쪽 책장에 서류를 옮긴다'}],
  printer_ekaterina:[{atMinute:540,mapId:'printshop',position:{x:11,y:13},activityKo:'교정쇄와 활자를 살핀다'},{atMinute:600,mapId:'printshop',position:{x:9,y:13},activityKo:'인쇄대 쪽 작업을 맡는다'}],
  courier_pavel:[{atMinute:540,mapId:'nevsky',position:{x:10,y:16},activityKo:'네프스키 쪽 배달을 시작한다'},{atMinute:600,mapId:'nevsky',position:{x:23,y:10},activityKo:'가로등 길목을 지난다'}],
  seamstress_anna:[{atMinute:540,mapId:'nevsky',position:{x:7,y:14},activityKo:'거리에서 수선 일을 찾는다'},{atMinute:600,mapId:'nevsky',position:{x:4,y:15},activityKo:'안뜰 쪽으로 돌아간다'}],
  tenant_mikhail:[{atMinute:540,mapId:'courtyard',position:{x:10,y:13},activityKo:'하숙집 안뜰에 머문다'},{atMinute:600,mapId:'courtyard',position:{x:15,y:13},activityKo:'물을 길으러 우물가로 간다'}],
  bookseller_lev:[{atMinute:540,mapId:'nevsky',position:{x:25,y:16},activityKo:'가판의 책을 정리한다'},{atMinute:600,mapId:'nevsky',position:{x:24,y:14},activityKo:'가로등 쪽 손님을 살핀다'}],
};
for (const card of characters) card.schedule = dailySchedules[card.id];

const quest = {
  id:'PRINTSHOP_PROOF_1847', titleKo:'교정쇄의 행선지', chapterId:'V33_1847_PRINT', date:'1847-06-01',
  premiseKo:'인쇄소의 허구 교정쇄 사본을 누가 어떤 절차로 다룰지 정한다. 실제 간행물의 역사적 발행 사실은 이 선택으로 바뀌지 않는다.',
  historicalOutcome:{id:'SOVREMENNIK_1847_ISSUE_PUBLICATION',value:'the attested 1847 issue remains historically published',sourceIds:['OBJ-SOV-1847']},
  entry:{mapId:'printshop',objectId:20,requiredHostId:'printer_ekaterina'},
  actions:[
    {id:'RETURN_MANUSCRIPT',hostIds:['printer_ekaterina'],labelKo:'교정쇄 사본을 편집실로 돌려보낸다',subcopyKo:'편집실 직원에게 보입니다 · 작업 전달표에 남습니다 · 사본이 작업장을 떠나고 전달이 늦어질 수 있습니다',resultKo:'사본을 편집실로 보냈다. 인쇄소와 편집실이 그 사실을 안다.',resultFlag:'proofReturned',followup:'EDITORIAL_RETURN'},
    {id:'HOLD_FOR_CORRECTION',hostIds:['printer_ekaterina'],labelKo:'확인할 문장에 표시하고 작업대에 보류한다',subcopyKo:'가까운 동료에게 보입니다 · 공식 장부에는 남지 않고 작업장에 머뭅니다 · 마감이 늦어질 수 있습니다',resultKo:'확인할 곳을 표시해 작업대에 남겼다. 교정쇄는 아직 작업장을 떠나지 않았다.',resultFlag:'proofHeld',followup:'CORRECTION_HOLD'},
    {id:'ASK_FOR_SOURCE',hostIds:['printer_ekaterina'],labelKo:'인쇄된 원문과 대조한 뒤 결정한다',subcopyKo:'작업장 동료가 볼 수 있습니다 · 공식 장부가 아닌 대조 메모에 남습니다 · 사본은 남고 결정이 늦어집니다',requiredKnowledgeId:'LIT-TURGENEV-KHOR-KALYNYCH-1847',resultKo:'인쇄된 원문과 대조하기로 했다. 확인이 끝날 때까지 사본은 작업대에 남는다.',resultFlag:'proofCompared',followup:'SOURCE_COMPARISON'},
  ],
  completion:'one authorized action on the represented physical object',
};

const provenance = {
  schemaVersion:'V33_ASSET_PROVENANCE_V1',
  assets:[
    {id:'petersburg-tiles',path:'rpg/assets/petersburg-tiles.png',type:'ORIGINAL_PIXEL_ART',generatedBy:'scripts/v33-generate-rpg-content.mjs',license:'original project-authored pixels',historicalConfidence:'RECONSTRUCTED',intendedScene:['nevsky','printshop'],sourceIds:['OBJ-PETERSBURG-PLAN-1840','OBJ-SADOVNIKOV-1835'],sourceUrls:['https://expositions.nlr.ru/ex_map/mozaika_Saint-Petersburg/historic_plans.php','https://rusmuseumvrm.ru/data/collections/engraving/gr.-1929_15/index.php?lang=ru'],notes:'The panorama informs continuous facade rhythm and an active main-street scene. Paving, curb widths, and exact shop positions are stylized reconstructions, not surveyed details.'},
    ...characters.map(card=>({id:`sprite-${card.id}`,path:`rpg/${card.sprite.file}`,type:'ORIGINAL_PIXEL_SPRITE_SHEET',generatedBy:'scripts/v33-generate-rpg-content.mjs',license:'original project-authored pixels',historicalConfidence:'FICTIONAL_CHARACTER_RECONSTRUCTION',intendedScene:card.allowedMaps,sourceIds:card.sourceIds,notes:card.reconstructionDisclaimer})),
  ],
};

const sourceContext = {
  schemaVersion:'V33_SOURCE_CONTEXT_V1',
  sourceId:'LIT-TURGENEV-KHOR-KALYNYCH-1847',
  titleRu:'Хорь и Калинычъ', titleKo:'호리와 칼리니치', author:'И. С. Тургенев',
  dateCreated:'1847', firstPublication:'Современник, 1847, том I, № 1, раздел «Смесь»',
  firstPublicationSourceId:'OBJ-SOV-1847', firstPublicationSourceUrl:'https://library.turgenev.ru/?page_id=545', catalogUrl:'https://rusneb.ru/catalog/000199_000009_007828983/',
  witness:{edition:'Полное собраніе сочиненій И. С. Тургенева. 4-е изд. Санкт-Петербург: Типографія Глазунова, т. 1.',sourceUrl:'https://ru.wikisource.org/wiki/Хорь_и_Калиныч_(Тургенев)/ДО',stableRevisionUrl:'https://ru.wikisource.org/w/index.php?title=Хорь_и_Калиныч_(Тургенев)/ДО&oldid=4722069',range:'opening narrative; lines 123–129 on the cited edition page, four consecutive paragraphs',note:'The excerpt is from the fourth collected edition, not a facsimile transcription of the 1847 first printing. The work is fiction; its narrator is not treated as a historical witness.'},
  paragraphs:[
    {ru:'Въ первый же день моего знакомства съ г. Полутыкинымъ, онъ пригласилъ меня на ночь къ себѣ.',ko:'폴루티킨 씨를 처음 만난 날, 그는 나를 자기 집에서 하룻밤 묵고 가라고 초대했다.'},
    {ru:'— До меня верстъ пять будетъ, — прибавилъ онъ: — пѣшкомъ идти далеко; зайдемте сперва къ Хорю. (Читатель позволитъ мнѣ не передавать его заиканья).',ko:'“우리 집까지는 5베르스타쯤 될 겁니다. 걸어가기엔 머니, 먼저 호리네 들렀다 갑시다.” 그가 덧붙였다. (말을 더듬는 버릇은 옮기지 않겠다.)'},
    {ru:'— А кто такой Хорь?',ko:'“호리는 누구죠?”'},
    {ru:'— А мой мужикъ…. Онъ отсюда близехонько.',ko:'“제 농노입니다…. 여기서 아주 가까워요.”'},
  ],
  translationNoteKo:'이 프로젝트의 번역이다. 현대 한국어 번역본의 문장을 가져오지 않았다.',
};

const sceneObservations = {
  schemaVersion:'V33_FICTIONAL_SCENE_OBSERVATIONS_V1',
  entries:{
    PRINTSHOP_ROUTING_NOTE:{titleKo:'돌 틈에 낀 쪽지',textKo:'접힌 종이에는 “등불 둘, 뒤문”이라고 짧게 적혀 있다. 이름도 날짜도 봉인도 없다. 누구에게 보낼 쪽지인지는 알 수 없다.',hostLines:{courier_pavel:'배달 표식처럼 보이지만, 이 말만으로는 어느 집인지 알 수 없다. 봉투도 없으니 내용을 짐작할 근거는 없다.',clerk_alexei:'접수 번호도 서명도 없다. 관청에 올릴 근거는 되지 않는다.',printer_ekaterina:'작업 지시는 아니네. 인쇄물과 섞이지 않게 접어 두자.',seamstress_anna:'누구 이름도 없네. 본 사람이 괜히 말을 보태면 소문만 커지겠다.'}},
    COURIER_ROUTE_MARK:{titleKo:'가로등 아래의 두 줄',textKo:'가로등 밑 나무에 두 줄이 나란히 그어져 있다. 누가 그었는지, 무슨 뜻인지는 표시되어 있지 않다.',hostLines:{courier_pavel:'길을 기억하려고 남긴 표식일 수는 있어. 그래도 이걸 보고 봉투 안까지 안다고 할 순 없지.',clerk_alexei:'표식은 보이지만 작성자와 목적을 확인할 수 없다.',printer_ekaterina:'인쇄소 표시는 아니야. 우리 표식은 이렇게 남기지 않아.',seamstress_anna:'누가 길을 표시했나 보네. 누구한테 가는 길인지는 모르겠어.'}},
    TYPE_CASE_LAYOUT:{titleKo:'활자 서랍',textKo:'작은 칸마다 활자가 나뉘어 있고, 자주 쓰는 글자 몇 개는 앞쪽에 놓여 있다. 서랍 가장자리에 잉크 묻은 손자국이 남았다.',hostLines:{printer_ekaterina:'급한 글자는 앞에 빼 두지. 서랍을 뒤지느라 시간을 쓰면 마감이 밀려.',clerk_alexei:'배열은 작업 편의를 위한 것 같다. 문서 번호나 담당자를 보여 주지는 않는다.',courier_pavel:'글자 칸이 빼곡하네. 내가 맡은 건 봉투라서, 이 안의 사정은 잘 몰라.',seamstress_anna:'손이 많이 간 물건이네. 글자 하나를 찾으려면 눈이 아프겠어.'}},
    SHOP_LEDGER_NOTE:{titleKo:'작업 장부의 여백',textKo:'여백에 종이 묶음과 심부름 비용이 적혀 있다. 이 장부와 숫자는 이 장면을 위해 만든 허구 소품이다.',hostLines:{printer_ekaterina:'종이값은 적혀 있어도 누가 이 문장을 책임지는지는 없어. 그건 따로 물어야 해.',clerk_alexei:'계산 메모로 보인다. 관청의 접수 장부와는 다른 종이다.',courier_pavel:'심부름 값이 적혀 있네. 주소나 봉투 내용은 없어서 배달 기록으로 쓸 수는 없어.',seamstress_anna:'종이값만으론 오늘 품삯을 알 수 없지. 누구 몫인지도 적혀 있지 않네.'}},
    CHANCERY_INTAKE_NOTE:{titleKo:'접수대 위의 메모',textKo:'메모에는 빈 접수 번호와 담당자 칸이 그려져 있다. 서명이나 상급자의 결재는 없다. 이 소품은 허구 장면을 위해 만들었다.',hostLines:{clerk_alexei:'번호가 비어 있네. 지금은 접수 완료가 아니야. 원본을 확인하고 담당자를 적어야 해.',printer_ekaterina:'관청 안쪽 서식은 모르지만, 이름 칸이 빈 건 보여. 아직 누가 맡았는지는 정해지지 않았나 봐.',courier_pavel:'이 종이가 배달표는 아니네. 주소도 봉인도 없어.',seamstress_anna:'빈칸이 많네. 내가 채워도 되는 자리인지 먼저 물어야겠어.',tenant_mikhail:'번호와 이름을 적는 칸이 있네. 무엇을 맡기는 종이인지는 모르겠다.',bookseller_lev:'접수번호가 있어도 이건 가격표가 아니야. 담당자를 적기 전까진 효력이 없겠지.'}},
    RETURNED_PAPERS_NOTE:{titleKo:'반송 서류 묶음',textKo:'묶음 맨 위에 “확인 뒤 다시 올릴 것”이라고 적혀 있다. 누구의 서류인지는 가려져 있다. 이 메모는 허구 소품이다.',hostLines:{clerk_alexei:'반송 이유를 먼저 확인해야 해. 이름을 추측해 적으면 다른 사람 기록까지 건드릴 수 있어.',printer_ekaterina:'내 작업장으로 온 종이는 아닌 것 같아. 봉투가 없으니 가져가면 안 되겠네.',courier_pavel:'배달 주소가 없고 묶여 있어. 내 물건으로 볼 수는 없어.',seamstress_anna:'누구 서류인지 가려 놨네. 여기서 이름을 맞히는 건 도움이 안 돼.',tenant_mikhail:'누군가 다시 가져가야 하는 종이인가 봐. 그래도 내가 열어볼 건 아니지.',bookseller_lev:'반송이라고 적혔어도 이 서류의 주인을 말해 주진 않아.'}},
    COURTYARD_RENT_NOTE:{titleKo:'방세 쪽지',textKo:'방 번호와 납부 날짜만 적혀 있다. 사람 이름이나 금액은 보이지 않는다. 실제 하숙 장부가 아니라 허구 소품이다.',hostLines:{tenant_mikhail:'내 방 번호네. 내일까지 내야 하는 건 맞아. 다만 이 쪽지에 적힌 건 날짜뿐이야.',seamstress_anna:'방 번호만 있네. 금액은 안 보여. 미하일 몫까지 내가 짐작하면 안 되지.',courier_pavel:'길 주소처럼 보이지만 방세 쪽지네. 배달할 봉투는 아니야.',clerk_alexei:'관청의 납부 기록이 아니라 방 주인의 메모로 보인다.',printer_ekaterina:'이름도 금액도 없네. 여기 적힌 것 이상은 알 수 없어.',bookseller_lev:'기한만 적혔군. 액수를 모르면 장부에 계산할 수는 없어.'}},
    COURTYARD_WELL_NOTE:{titleKo:'물동이 옆의 표시',textKo:'나무 물동이 손잡이에 짧은 매듭이 묶여 있다. 누가 묶었는지, 무슨 약속인지 알 수 없다.',hostLines:{tenant_mikhail:'우리 층에서 쓰는 표시일 수도 있어. 그래도 누가 묶었는지는 모르겠네.',seamstress_anna:'끈이 닳았네. 누가 물동이를 썼는지 말해 주진 않아.',courier_pavel:'길목 표식과는 달라. 배달 경로라고 단정하면 안 되겠어.',clerk_alexei:'기록 번호도 서명도 없다. 업무 자료로 볼 근거는 없어.',printer_ekaterina:'작업장 물건은 아니야. 주인에게 물어보는 게 낫겠네.',bookseller_lev:'매듭 하나로 사람을 지목할 수는 없지.'}}
  },
  disclaimerKo:'이 소품과 문구는 플레이를 위해 만든 허구 장면입니다. 역사 사료 인용이 아닙니다.'
};

function putGridRow(grid,y,x0,x1,gid) { for(let x=x0;x<=x1;x++) grid.push([x,y,gid]); }
if (process.argv.includes('--street-materials-only')) {
  const mapPath = path.join(out, 'maps', 'nevsky.json');
  const map = JSON.parse(await readFile(mapPath, 'utf8'));
  map.tilesets[0].tilecount = tileDrawers.length;
  const ground = map.layers.find(layer => layer.name === 'Ground').data;
  const put = (x, y, gid) => { ground[y * map.width + x] = gid; };
  for (let y = 8; y <= 9; y++) for (let x = 1; x <= 28; x++) put(x, y, 43);
  for (let x = 1; x <= 28; x++) put(x, 10, 44);
  for (let y = 11; y <= 17; y++) for (let x = 1; x <= 28; x++) put(x, y, ((x + y * 3) % 5 === 0) ? 42 : 41);
  for (let x = 1; x <= 28; x++) put(x, 18, 43);
  const note = '1830–1835 panorama informs the continuous facade rhythm and active main-street scene; paving, curb widths, and exact shop positions are stylized reconstructions, not surveyed details.';
  map.metadata.note = note;
  const noteProperty = map.properties.find(property => property.name === 'note');
  if (noteProperty) noteProperty.value = JSON.stringify(note);
  const provenancePath = path.join(out, 'assets', 'ASSET_PROVENANCE.json');
  const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
  const tiles = provenance.assets.find(asset => asset.path === 'rpg/assets/petersburg-tiles.png');
  tiles.notes = 'The panorama informs continuous facade rhythm and an active main-street scene. Paving, curb widths, and exact shop positions are stylized reconstructions, not surveyed details.';
  tiles.sourceUrls = ['https://expositions.nlr.ru/ex_map/mozaika_Saint-Petersburg/historic_plans.php', 'https://rusmuseumvrm.ru/data/collections/engraving/gr.-1929_15/index.php?lang=ru'];
  await writeFile(path.join(out, 'assets', 'petersburg-tiles.png'), buildTileset());
  await writeFile(mapPath, `${JSON.stringify(map, null, 2)}\n`.replace(/\n/g, '\r\n'));
  await writeFile(provenancePath, `${JSON.stringify(provenance, null, 2)}\n`.replace(/\n/g, '\r\n'));
  console.log('Updated the original Petersburg tileset and Nevsky street materials.');
  process.exit(0);
}
const maps = buildMaps();
await mkdir(path.join(out,'assets'),{recursive:true}); await mkdir(path.join(out,'maps'),{recursive:true}); await mkdir(path.join(out,'characters'),{recursive:true}); await mkdir(path.join(out,'quests'),{recursive:true}); await mkdir(path.join(out,'data'),{recursive:true});
await writeFile(path.join(out,'assets/petersburg-tiles.png'),buildTileset());
for(const card of characters) await writeFile(path.join(out,card.sprite.file),makeCharacterSprite(card));
for(const [filename,map] of [['nevsky.json',maps.street],['printshop.json',maps.shop],['chancery.json',maps.chancery],['courtyard.json',maps.courtyard]]) await writeFile(path.join(out,'maps',filename),`${JSON.stringify(map,null,2)}\n`);
for(const card of characters) await writeFile(path.join(out,'characters',`${card.id}.json`),`${JSON.stringify(card,null,2)}\n`);
await writeFile(path.join(out,'quests','printshop-article.json'),`${JSON.stringify(quest,null,2)}\n`);
await writeFile(path.join(out,'assets','ASSET_PROVENANCE.json'),`${JSON.stringify(provenance,null,2)}\n`);
await writeFile(path.join(out,'data','khor-kalynych-source.json'),`${JSON.stringify(sourceContext,null,2)}\n`);
await writeFile(path.join(out,'data','scene-observations.json'),`${JSON.stringify(sceneObservations,null,2)}\n`);
await writeFile(path.join(out,'data','source-register.json'),`${JSON.stringify({schemaVersion:'V33_SOURCE_REGISTER_V1',sources:[{sourceId:'OBJ-SOV-1847',type:'PRIMARY_BIBLIOGRAPHIC_RECORD',title: 'Современник : журнал литературный и политический',publisher:'Н. А. Некрасов',date:'1847',issue:'том I, № 1',url:sourceContext.catalogUrl,archive:'Национальная электронная библиотека / Российская государственная библиотека'},{sourceId:sourceContext.sourceId,type:'LITERARY_SOURCE_WITNESS',author:sourceContext.author,work:sourceContext.titleRu,edition:sourceContext.witness.edition,range:sourceContext.witness.range,url:sourceContext.witness.stableRevisionUrl,firstPublicationSourceUrl:sourceContext.firstPublicationSourceUrl,rights:'Original work is public domain; the project uses its own Korean translation.'}]},null,2)}\n`);
console.log(JSON.stringify({maps:Object.keys(maps),hosts:characters.map(card=>card.id),tileset:[256,160],spriteSheets:characters.length,quest:quest.id},null,2));
