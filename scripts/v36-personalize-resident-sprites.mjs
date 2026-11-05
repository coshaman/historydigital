import fs from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';

const root = process.cwd();
const districts = JSON.parse(await fs.readFile(path.join(root, 'rpg/data/city-districts-v36.json'), 'utf8'));
const ids = [...new Set(districts.districts.flatMap(district => district.residentIds ?? []))];
const props = {
  clerk_alexei:['folder',['.###.','#####','##.##','#####','.###.']],
  printer_ekaterina:['composing stick',['##...','##...','#####','..##.','..##.']],
  courier_pavel:['satchel',['.###.','#####','##.##','#####','.###.']],
  seamstress_anna:['needle and cloth',['#...#','.#.#.','..#..','#####','..#..']],
  tenant_mikhail:['work sack',['.###.','#####','#####','.###.','..#..']],
  bookseller_lev:['book',['#####','#...#','#.##.','#...#','#####']],
  editor_sofia:['proof sheet',['#####','#.#.#','#...#','#.###','#####']],
  police_sergeant_ivan:['duty baton',['..#..','..#..','..#..','..#..','.###.']],
  reader_darya:['open book',['#...#','##.##','#.#.#','##.##','#...#']],
  senior_clerk_konstantin:['sealed ledger',['#####','#...#','#.O.#','#.###','#####']],
  yardkeeper_semyon:['key ring',['.###.','#...#','.###.','..#..','..#.#']],
  laundress_mariya:['folded linen',['#####','#...#','#####','#...#','#####']],
  baker_fyodor:['kalach tray',['#####','#*#*#','#####','..#..','..#..']],
  market_nadezhda:['wicker baskets',['.###.','#####','#*#*#','#####','#...#']],
  porter_gavrila:['shoulder load',['.###.','#####','##.##','#####','..#..']],
  coachman_timofey:['reins',['#...#','.#.#.','..#..','.#.#.','#...#']],
  housemaid_olga:['broom',['....#','...#.', '..#..','.##..','#....']],
  midwife_avdotya:['care case',['#####','#...#','##.##','#...#','#####']],
  apothecary_yakov:['medicine bottle',['.###.','.###.','#####','#####','.###.']],
  print_apprentice_stepan:['type block',['#####','#.#.#','#####','#.#.#','#####']],
  bookbinder_elizaveta:['bound volume',['#####','#...#','##..#','#...#','#####']],
  scribal_yuri:['quill and paper',['#....','##...','.#.#.','..##.','...#.']],
  innkeeper_irina:['room key',['..#..','..#..','#####','..#..','..#..']],
  student_vasily:['pamphlet',['#####','##..#','#.##.','#...#','#####']],
  teacher_lyubov:['lesson slate',['#####','#...#','#.##.','#...#','#####']],
  minor_noble_andrei:['walking cane',['#....','#....','#....','#....','####.']],
  landlady_polina:['house key',['..##.','.#...','#####','..#..','..#..']],
  watercarrier_luka:['handled water pail',['#####','#...#','#...#','#####','.###.']],
  fishseller_klavdiya:['fish basket',['#####','#.#.#','#...#','#####','.###.']],
  warehouse_pyotr:['crate tally',['#####','#.#.#','#####','#...#','#####']],
  servant_varvara:['work cloth',['#####','##..#','#####','#..##','#####']],
  junior_guard_sergey:['hat carried at side',['.###.','#####','#...#','..#..','..#..']],
  carter_roman:['cart reins',['#...#','.#.#.','..#..','.#.#.','##..#']],
  street_vendor_matryona:['brush yoke and hanging brushes',['#####','#.#.#','#####','#.#.#','..#..']],
  typesetter_nikita:['type gauge',['#.#.#','#####','#.#.#','#####','#.#.#']],
  lodging_tatyana:['thread spool',['.###.','#####','..#..','#####','.###.']],
};
const chars = {};
for (let index = 0; index < 256; index++) {
  let value = index; const out = [];
  for (let bit = 0; bit < 4; bit++) { out.push(value & 1 ? '1' : '0'); value >>= 1; }
  chars[index] = out;
}
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
function crc32(bytes) { let c = 0xffffffff; for (const value of bytes) c = crcTable[(c ^ value) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(name, bytes) { const type = Buffer.from(name), size = Buffer.alloc(4), checksum = Buffer.alloc(4); size.writeUInt32BE(bytes.length); checksum.writeUInt32BE(crc32(Buffer.concat([type, bytes]))); return Buffer.concat([size, type, bytes, checksum]); }
function hex(value) { return [1,3,5].map(index => parseInt(value.slice(index,index+2),16)); }
function makeSheet(card, roleProp, identity) {
  const width = 48, height = 96, pixels = new Uint8Array(width * height * 4);
  const colors = { ink:[38,31,28], outline:[47,37,31], skin:[208,160,126], skinShade:[153,103,82], hair:[48,37,32], pants:[53,43,35], shoe:[37,32,29], paper:[226,211,174], highlight:[234,210,156] };
  const palette = card.sprite.palette ?? {}, cloth = hex(palette.cloth ?? '#55443b'), trim = hex(palette.trim ?? '#b18a57'), headwear = hex(palette.headwear ?? '#43382f');
  const put = (x,y,color) => { if (x < 0 || y < 0 || x >= width || y >= height) return; const at = (y*width+x)*4; pixels.set([...color,255],at); };
  const rect = (x,y,w,h,color) => { for(let yy=y;yy<y+h;yy++) for(let xx=x;xx<x+w;xx++) put(xx,yy,color); };
  const [propName, mask] = roleProp, accent = identity % 2 ? trim : headwear;
  for(let direction=0;direction<4;direction++) for(let frame=0;frame<3;frame++) {
    const ox=frame*16, oy=direction*24, bob=frame===1?-1:frame===2?1:0;
    const p=(x,y,color)=>put(ox+x,oy+y+bob,color), r=(x,y,w,h,color)=>rect(ox+x,oy+y+bob,w,h,color);
    const leg=frame===1?-1:frame===2?1:0;
    // Face, back hair or period head covering.
    r(5,2,6,6,colors.skin); r(6,7,4,2,colors.skinShade);
    if(direction===1) { r(4,2,2,6,colors.hair); r(10,2,2,6,colors.hair); r(5,2,6,2,colors.hair); }
    else { r(4,2,8,2,colors.hair); r(4,3,2,4,colors.hair); r(10,3,2,4,colors.hair); }
    const style=card.sprite.style;
    if(style==='gatekeeper') { /* The source shows the hat carried, not worn. */ }
    else if(style==='cap'||style==='cartdriver'||style==='cabman') { r(4,1,8,2,headwear); r(3,3,10,1,headwear); }
    else if(style==='scarf'||style==='skirt'||style==='fishvendor') { r(5,1,6,2,headwear); r(4,3,2,4,headwear); r(10,3,2,4,headwear); }
    else if(style==='hair') { r(4,2,2,5,colors.hair); r(10,2,2,5,colors.hair); r(5,1,6,2,colors.hair); }
    else { r(4,1,8,2,headwear); r(5,0,6,1,headwear); }
    if(direction===0) { p(6,5,colors.ink); p(10,5,colors.ink); p(8,8,colors.skinShade); }
    if(direction===2) { p(7,5,colors.ink); p(6,6,colors.skinShade); }
    if(direction===3) { p(10,5,colors.ink); p(9,6,colors.skinShade); }
    // Work clothes vary by silhouette and the resident's recorded palette.
    if(style==='gatekeeper') { r(4,9,8,8,cloth); r(3,10,2,6,cloth); r(11,10,2,6,cloth); r(6,10,1,5,trim); r(9,10,1,5,trim); p(8,16,trim); }
    else if(style==='fishvendor') { r(4,9,8,8,cloth); r(3,10,2,6,cloth); r(11,10,2,6,cloth); r(4,16,8,4,colors.pants); r(6,10,4,1,trim); p(7,13,trim); }
    else if(style==='skirt') { r(4,9,8,5,cloth); r(3,13,10,8,cloth); r(5,12,6,7,trim); r(7,12,1,7,headwear); }
    else if(style==='dress') { r(4,9,8,9,cloth); r(3,15,10,3,trim); }
    else if(style==='apron') { r(4,9,8,8,cloth); r(5,10,6,7,trim); r(4,8,8,2,trim); }
    else if(style==='coat'||style==='cartdriver'||style==='cabman') { r(4,9,8,8,cloth); r(7,9,2,7,trim); p(6,12,colors.paper); if(style==='cartdriver'||style==='cabman') { r(4,15,3,2,cloth); r(9,15,3,2,cloth); } }
    else { r(4,9,8,8,cloth); r(4,14,8,2,trim); p(7,10,colors.highlight); }
    r(3,10,2,5,cloth); r(11,10,2,5,cloth); p(3,15,colors.skin); p(12,15,colors.skin);
    if(style==='gatekeeper') { r(4+leg,17,4,4,colors.pants); r(8-leg,17,4,4,colors.pants); r(4+leg,21,4,2,colors.shoe); r(8-leg,21,4,2,colors.shoe); }
    else if(style==='fishvendor'||style==='skirt') { r(5+leg,20,3,2,colors.shoe); r(9-leg,20,3,2,colors.shoe); }
    else { r(5+leg,17,3,4,cloth); r(9-leg,17,3,4,cloth); r(4+leg,21,4,2,colors.shoe); r(9-leg,21,4,2,colors.shoe); }
    // A distinct, period-appropriate work object gives the resident a readable silhouette.
    const px = direction===1 || direction===2 ? 0 : 11;
    const py = 11 + (identity % 2);
    if(card.id==='watercarrier_luka') {
      // A clear original handled-pail role marker; the source plate does not assign this vessel to its water carrier.
      const bx = direction===2 ? 0 : 11;
      r(bx+1,py,2,1,colors.outline); r(bx,py+1,4,1,colors.outline);
      r(bx+1,py+1,2,1,trim); r(bx,py+2,1,2,colors.outline); r(bx+3,py+2,1,2,colors.outline);
      r(bx+1,py+2,2,2,trim); r(bx+1,py+4,2,1,colors.outline);
      p(bx+1,py-1,colors.outline); p(bx+2,py-1,colors.outline);
    } else if(card.id==='street_vendor_matryona') {
      // A source-bounded portable load: a shoulder pole with hanging brush shapes.
      // Keep her clothing and scarf wholly project-designed; the drawing depicts a man.
      r(0,8,16,1,colors.outline); r(1,8,14,1,trim);
      if(direction===0||direction===1) {
        for(const x of [0,2,4,11,13,15]) { p(x,9,colors.outline); p(x,10,trim); }
        for(const [x,w] of [[0,3],[3,2],[12,3],[7,2]]) {
          r(x,11,w,2,colors.outline); r(x,12,w,1,trim); p(x,13,accent); p(x+w-1,13,accent);
        }
        for(const x of [5,9,10]) { p(x,9,colors.ink); p(x,10,trim); p(x,11,colors.outline); }
      } else {
        r(direction===2?0:5,8,11,1,trim);
        for(const x of (direction===2?[0,2,4]:[11,13,15])) {
          p(x,9,colors.outline); p(x,10,trim); r(Math.max(0,x-1),11,3,2,colors.outline); p(x,13,accent);
        }
      }
    } else {
      for(let row=0;row<mask.length;row++) for(let col=0;col<mask[row].length;col++) {
        const cell=mask[row][col];
        if(cell==='#') p(px+col,py+row,trim);
        else if(cell==='*') p(px+col,py+row,accent);
      }
    }
    // Small wardrobe accent is individual and survives walk-frame animation.
    if(style!=='gatekeeper') { const markerX=direction===2?3:direction===3?12:7; p(markerX,10,headwear); p(markerX+1,10,trim); }
  }
  const scan=Buffer.alloc((width*4+1)*height);
  for(let y=0;y<height;y++) scan.set(pixels.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
  const ihdr=Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height,4); ihdr.set([8,6,0,0,0],8);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
const portraitProfiles = {
  apothecary_yakov: { skin:'#c99472', hair:'#46362e', coat:'#4c4a43', rx:11, cap:'', hairBack:'<path d="M20 26q-4-17 4-21 8-5 17 0 8 5 5 21l-4 8-4-16-13 1-2 14z"/>', hairFront:'<path d="M21 22q1-14 11-15 11 0 13 14-7-6-13-5-7 0-11 6z"/>', face:'<path d="M23 35q9 8 18 0" fill="none" stroke="#765046" stroke-width="2.4"/>', facial:'<path d="M25 32q7-5 14 0-2 5-7 5-5 0-7-5z" fill="#60463b"/><path d="M27 34h10" stroke="#c99472" stroke-width="1.2"/>', collar:'<path d="M26 45l6 7 6-7" fill="#ded0b2"/>' },
  bookbinder_elizaveta: { skin:'#e0b18b', hair:'#52372c', coat:'#465345', rx:12, hairBack:'<path d="M20 26q-3-14 5-20 9-6 17 1 7 6 3 20l-3 5-2-16-15-2-2 17z"/><circle cx="45" cy="13" r="5"/>', hairFront:'<path d="M20 22q3-16 13-16 11 0 13 16-8-5-13-8-4 5-13 8z"/>', face:'<path d="M28 35q4 3 8 0" fill="none" stroke="#8b5146" stroke-width="2"/>', facial:'', collar:'<path d="M22 45h20l-3 12H25z" fill="#b17a49" stroke="#33291f" stroke-width="1.5"/><path d="M25 48h14M26 52h12" stroke="#e1c48d" stroke-width="1.4"/>' },
  housemaid_olga: { skin:'#d6a47e', hair:'#3a2c27', coat:'#56625a', rx:10, hairBack:'<path d="M17 28q-3-18 8-23 13-5 22 6l-1 18-5 8-4-20-14 3-2 12z"/>', hairFront:'<path d="M18 17l4-10 10-3 11 5 5 9-5 4-4-6-8 3-9-2z" fill="#b5a17d"/><path d="M21 18l-2 11M45 17l2 12" stroke="#b5a17d" stroke-width="3"/>', face:'<path d="M28 35q4 2 8 0" fill="none" stroke="#8b5146" stroke-width="2"/>', facial:'', collar:'<path d="M24 45h16l6 14H18z" fill="#a89675" stroke="#33291f" stroke-width="1.5"/><path d="M23 49l18 8" stroke="#ddd0ad" stroke-width="2"/>' },
  innkeeper_irina: { skin:'#e1b78f', hair:'#4e3028', coat:'#654439', rx:13, hairBack:'<path d="M18 26q-4-16 7-22 11-5 21 2 7 7 3 22l-4 9-4-21-18 1-1 17z"/>', hairFront:'<path d="M19 18q4-13 13-13 11 0 15 13l-5 4-3-7-5 4-7-5-5 7z" fill="#d7c9a8" stroke="#352820" stroke-width="1.5"/>', face:'<path d="M27 35q5 5 10 0" fill="none" stroke="#8b5146" stroke-width="2.2"/>', facial:'', collar:'<path d="M23 45h18l7 13H16z" fill="#d0b47a" stroke="#33291f" stroke-width="1.5"/><path d="M25 47l7 6 7-6" fill="none" stroke="#6c4b3a" stroke-width="2"/>' },
  landlady_polina: { skin:'#d0a181', hair:'#79706a', coat:'#4f5350', rx:13, hairBack:'<path d="M18 29q-4-19 7-24 12-5 21 4 6 7 1 22l-6 5-2-19-15 1-2 17z"/><circle cx="46" cy="16" r="5"/>', hairFront:'<path d="M19 18q3-13 13-13 10 0 14 12-8-4-13-7-6 5-14 8z"/>', face:'<path d="M27 35q5 2 10-1" fill="none" stroke="#80574a" stroke-width="1.7"/><path d="M24 27h4m12 0h4" stroke="#9b725d" stroke-width="1.2"/>', facial:'', collar:'<path d="M24 45h16l9 14H15z" fill="#766a5b" stroke="#33291f" stroke-width="1.5"/><path d="M24 49l8 4 8-4" fill="none" stroke="#cfb580" stroke-width="2"/>' },
  lodging_tatyana: { skin:'#e3b692', hair:'#684234', coat:'#5d4436', rx:11, hairBack:'<path d="M20 25q-3-15 6-20 10-5 18 3 6 7 2 19l-4 7-3-19-14-1-2 18z"/><path d="M42 17q10 6 8 23" fill="none" stroke="#684234" stroke-width="4"/>', hairFront:'<path d="M20 19q4-13 12-13 10 0 14 14-7-6-13-6-7 0-13 5z"/>', face:'<path d="M28 35q4 3 8 0" fill="none" stroke="#8d5145" stroke-width="2"/>', facial:'', collar:'<path d="M23 45h18l5 14H18z" fill="#a58060" stroke="#33291f" stroke-width="1.5"/><path d="M25 47l7 5 7-5" fill="none" stroke="#e1c99c" stroke-width="2"/>' },
  midwife_avdotya: { skin:'#d3a27d', hair:'#857668', coat:'#5d4436', rx:12, hairBack:'<path d="M18 27q-3-18 8-23 12-4 20 6l2 17-6 7-2-21-16 1-1 17z"/>', hairFront:'<path d="M18 16l7-10 9-3 10 6 5 10-5 4-5-8-8 4-10-2z" fill="#b4a58a" stroke="#352820" stroke-width="1.5"/>', face:'<path d="M27 35q5 3 10-1" fill="none" stroke="#80574a" stroke-width="1.8"/><path d="M24 27l4-1m12 0 4 1" stroke="#8b6455" stroke-width="1.2"/>', facial:'', collar:'<path d="M23 45h18l7 14H16z" fill="#8d755c" stroke="#33291f" stroke-width="1.5"/><path d="M25 48h14" stroke="#d5bf96" stroke-width="2"/>' },
  minor_noble_andrei: { skin:'#e2b690', hair:'#332b28', coat:'#3b4144', rx:10, hairBack:'<path d="M21 24q-2-16 7-19 9-4 17 4l1 15-4 8-3-20-14 1-1 17z"/>', hairFront:'<path d="M21 19q1-14 10-14 10-1 14 12-8-5-13-4-5 0-11 6z"/>', face:'<path d="M28 35q4 2 8 0" fill="none" stroke="#874b43" stroke-width="1.8"/>', facial:'', collar:'<path d="M25 44h14l5 15H20z" fill="#e2d8c3" stroke="#33291f" stroke-width="1.4"/><path d="M27 45l5 8 5-8" fill="#874333"/>' },
  print_apprentice_stepan: { skin:'#e4b68d', hair:'#795239', coat:'#713e31', rx:10, hairBack:'<path d="M20 25q-2-16 8-20 11-4 18 6l1 17-5 8-3-20-16 0-1 17z"/>', hairFront:'<path d="M19 15q3-10 13-11 11 0 15 10l-2 5-7-4-7 3-8-1z" fill="#8a6742" stroke="#382920" stroke-width="1.5"/>', face:'<path d="M28 35q4 3 8 0" fill="none" stroke="#955549" stroke-width="2"/>', facial:'<circle cx="25" cy="29" r="1" fill="#9a604b"/><circle cx="40" cy="30" r="1" fill="#9a604b"/>', collar:'<path d="M24 45h16l5 14H18z" fill="#bf9b68" stroke="#33291f" stroke-width="1.5"/><path d="M25 48h14" stroke="#57362b" stroke-width="2"/>' },
  scribal_yuri: { skin:'#c89573', hair:'#352b27', coat:'#3b4144', rx:11, hairBack:'<path d="M18 28q-4-18 8-24 12-4 20 7l1 20-7 8-2-24-17 1-1 19z"/>', hairFront:'<path d="M19 19q2-14 12-15 11 0 15 15-8-4-13-6-7 4-14 6z"/>', face:'<path d="M26 32q6-3 12 0" fill="none" stroke="#69483d" stroke-width="2"/>', facial:'<path d="M26 31q6-5 12 0l-2 8-4 3-4-3z" fill="#49372e"/>', collar:'<path d="M25 44h14l6 15H19z" fill="#ded0b2" stroke="#33291f" stroke-width="1.5"/><path d="M27 45l5 6 5-6" fill="#874333"/>' },
  servant_varvara: { skin:'#d5a27d', hair:'#382a26', coat:'#56625a', rx:11, hairBack:'<path d="M18 28q-4-18 8-24 12-5 20 6l2 19-6 6-2-21-17 2-1 19z"/>', hairFront:'<path d="M18 16l7-10 9-3 11 6 4 9-6 4-3-8-8 3-9-2z" fill="#88775f" stroke="#352820" stroke-width="1.5"/><path d="M20 18l-2 9m27-9 2 9" stroke="#88775f" stroke-width="2"/>', face:'<path d="M28 35q4 2 8 0" fill="none" stroke="#8b5146" stroke-width="2"/>', facial:'', collar:'<path d="M23 45h18l6 14H17z" fill="#a49173" stroke="#33291f" stroke-width="1.5"/><path d="M24 49l8 8 8-8" fill="none" stroke="#ddd0ad" stroke-width="2"/>' },
  student_vasily: { skin:'#e1b38d', hair:'#65442f', coat:'#55443b', rx:10, hairBack:'<path d="M20 24q-2-15 7-19 11-5 18 5l2 15-5 8-3-19-15 1-1 18z"/>', hairFront:'<path d="M19 19q2-14 12-15 11 0 15 13-8-5-13-5-7 0-14 7z"/><path d="M21 10q5-5 11-5" fill="none" stroke="#9a7650" stroke-width="2"/>', face:'<path d="M28 35q4 3 8 0" fill="none" stroke="#8e5146" stroke-width="2"/>', facial:'', collar:'<path d="M23 45h18l5 14H18z" fill="#a7845f" stroke="#33291f" stroke-width="1.5"/><path d="M25 47h14m-12 4h10" stroke="#e2d1aa" stroke-width="1.5"/>' },
  teacher_lyubov: { skin:'#ddb08d', hair:'#6a4a39', coat:'#5d4436', rx:12, hairBack:'<path d="M18 28q-3-18 8-24 12-5 20 6l1 17-6 7-2-20-16 1-1 18z"/><circle cx="46" cy="15" r="5"/>', hairFront:'<path d="M19 19q2-14 12-15 11 0 15 13-8-5-14-5-7 1-13 7z"/>', face:'<path d="M27 35q5 3 10-1" fill="none" stroke="#805247" stroke-width="1.8"/><path d="M24 27h4m12 0h4" stroke="#936857" stroke-width="1"/>', facial:'', collar:'<path d="M23 45h18l8 14H15z" fill="#b5916e" stroke="#33291f" stroke-width="1.5"/><path d="M24 49h16" stroke="#e2d1aa" stroke-width="2"/>' },
  typesetter_nikita: { skin:'#c99472', hair:'#392d28', coat:'#713e31', rx:11, hairBack:'<path d="M20 25q-2-16 8-20 11-4 18 6l1 16-5 8-3-20-16 0-1 18z"/>', hairFront:'<path d="M20 18q2-13 12-14 10 0 14 12-6-4-11-4-7 0-15 6z"/>', face:'<path d="M28 35q4 2 8 0" fill="none" stroke="#7c493e" stroke-width="2"/>', facial:'<path d="M26 32q6-4 12 0" stroke="#49362e" stroke-width="2.5"/>', collar:'<path d="M24 45h16l5 14H18z" fill="#9c603e" stroke="#33291f" stroke-width="1.5"/><path d="M25 48l7 5 7-5" fill="none" stroke="#d0ae76" stroke-width="2"/><circle cx="43" cy="43" r="2" fill="#30251f"/>' },
  warehouse_pyotr: { skin:'#c89574', hair:'#46372d', coat:'#3b4144', rx:13, cap:'', hairBack:'<path d="M18 26q-4-17 8-22 13-4 21 7l1 18-7 7-2-20-17 1-1 18z"/>', hairFront:'<path d="M18 16q3-11 14-12 12 0 16 11l-3 6-7-5-8 4-7-3-4 4z" fill="#51463a" stroke="#30251f" stroke-width="1.5"/>', face:'<path d="M25 33q7 4 14 0-2 5-7 6-5-1-7-6z" fill="#5b4438"/>', facial:'<path d="M26 25q2-2 5 0m5 0q3-2 5 0" stroke="#30251f" stroke-width="1.4"/>', collar:'<path d="M24 45h16l7 14H17z" fill="#6d7069" stroke="#33291f" stroke-width="1.5"/><path d="M25 48h14m-13 4h12" stroke="#c6a46c" stroke-width="1.6"/>' },
  street_vendor_matryona: { skin:'#d49d78', hair:'#392a25', coat:'#6b4936', rx:13, hairBack:'<path d="M18 28q-4-18 8-24 13-5 21 7l1 19-6 8-3-23-16 1-1 20z"/><path d="M43 17q8 7 6 23" fill="none" stroke="#392a25" stroke-width="4"/>', hairFront:'<path d="M17 15l7-10 10-3 11 7 5 9-6 4-5-8-8 3-9-2z" fill="#a88c69" stroke="#30251f" stroke-width="1.5"/><path d="M19 16l-2 11m30-11 2 11" fill="none" stroke="#a88c69" stroke-width="3"/>', face:'<path d="M27 35q5 4 10 0" fill="none" stroke="#8b5146" stroke-width="2.2"/>', facial:'<path d="M24 28h4m12 0h4" stroke="#a66e56" stroke-width="1.4"/>', collar:'<path d="M22 45h20l7 14H15z" fill="#b68b58" stroke="#33291f" stroke-width="1.5"/><path d="M23 49h18m-16 4h14" stroke="#e5c88d" stroke-width="1.4"/>' },
  watercarrier_luka: { skin:'#b9825e', hair:'#332923', coat:'#454843', rx:13, hairBack:'<path d="M18 27q-4-17 8-23 12-4 20 7l1 18-7 9-2-23-18 1-1 20z"/>', hairFront:'<path d="M18 13q3-9 14-10 12 1 16 10l-2 5-7-3-8 4-8-2-4 4z" fill="#534233" stroke="#30251f" stroke-width="1.5"/>', face:'<path d="M24 33q8 5 16 0-2 6-8 7-6-1-8-7z" fill="#49352b"/>', facial:'<path d="M24 25h5m6 0h5" stroke="#30251f" stroke-width="1.5"/>', collar:'<path d="M24 45h16l7 14H17z" fill="#6b715e" stroke="#33291f" stroke-width="1.5"/><path d="M25 48h14m-12 4h10" stroke="#c3aa79" stroke-width="1.5"/>' },
  fishseller_klavdiya: { skin:'#dca985', hair:'#302621', coat:'#4b5554', rx:11, hairBack:'<path d="M18 27q-4-18 8-24 13-4 21 8l1 18-7 8-3-22-16 1-1 19z"/><path d="M43 17q8 5 7 22" fill="none" stroke="#302621" stroke-width="4"/>', hairFront:'<path d="M18 14q5-11 14-11 10 0 15 10l-4 6-7-5-7 4-8-2-3 4z" fill="#8b7460" stroke="#30251f" stroke-width="1.5"/>', face:'<path d="M27 35q5 3 10 0" fill="none" stroke="#8b5146" stroke-width="2"/>', facial:'<path d="M24 27h5m7 0h5" stroke="#30251f" stroke-width="1.3"/><circle cx="22" cy="32" r="1" fill="#bb8064"/><circle cx="42" cy="32" r="1" fill="#bb8064"/>', collar:'<path d="M23 45h18l6 14H17z" fill="#a78f73" stroke="#33291f" stroke-width="1.5"/><path d="M24 49l8 5 8-5" fill="none" stroke="#d9c7a4" stroke-width="2"/>' },
  carter_roman: { skin:'#c28d68', hair:'#46352a', coat:'#57514a', rx:10, hairBack:'<path d="M19 24q-3-16 8-20 12-4 18 7l2 16-5 8-4-20-15 1-1 17z"/>', hairFront:'<path d="M18 13q4-10 15-10 12 0 16 10l-3 6-8-4-7 4-8-2-4 4z" fill="#6e533d" stroke="#30251f" stroke-width="1.5"/>', face:'<path d="M26 32q6-3 12 0" fill="none" stroke="#30251f" stroke-width="2.5"/><path d="M28 35q4 3 8 0" fill="none" stroke="#805044" stroke-width="1.8"/>', facial:'<path d="M25 25q2-2 5 0m5 0q3-2 5 0" stroke="#30251f" stroke-width="1.5"/>', collar:'<path d="M24 45h16l6 14H18z" fill="#86775c" stroke="#33291f" stroke-width="1.5"/><path d="M24 48h16" stroke="#c8a873" stroke-width="2"/>' },
  senior_clerk_konstantin: { skin:'#c89470', hair:'#514239', coat:'#474b4a', rx:10, hairBack:'<path d="M18 25q-2-15 8-19 12-4 18 6l2 17-6 8-2-22-17 1-1 18z"/>', hairFront:'<path d="M19 15q2-10 13-11 11 0 14 9l-5 4-7-3-8 3-7 2z" fill="#74675a" stroke="#30251f" stroke-width="1.5"/>', face:'', facial:'<path d="M25 31q7-4 14 0-2 6-7 7-5-1-7-7z" fill="#5b4236"/><path d="M23 23h6m6 0h6" stroke="#30251f" stroke-width="1.5"/><path d="M25 19h4m6 0h4" stroke="#8b6955" stroke-width="1"/>', collar:'<path d="M24 45h16l6 14H18z" fill="#d9d0bc" stroke="#33291f" stroke-width="1.5"/><path d="M27 45l5 8 5-8" fill="#783f35"/><path d="M24 55h16" stroke="#c6a46c" stroke-width="2"/>' },
  reader_darya: { skin:'#e1b28e', hair:'#55372c', coat:'#53604f', rx:12, hairBack:'<path d="M19 27q-4-18 8-24 12-5 20 7l1 20-6 7-3-23-16 1-1 20z"/><path d="M43 17q8 6 5 20" fill="none" stroke="#55372c" stroke-width="4"/>', hairFront:'<path d="M19 19q1-13 12-15 11 1 14 14-7-6-13-6-6 0-13 7z"/>', face:'<path d="M28 36q4 3 8-1" fill="none" stroke="#955b50" stroke-width="1.8"/>', facial:'<path d="M24 26q4-2 8 0m2 0q4-2 7 1" fill="none" stroke="#30251f" stroke-width="1.4"/>', collar:'<path d="M22 45h20l7 14H15z" fill="#829174" stroke="#33291f" stroke-width="1.5"/><path d="M24 49l8 5 8-5" fill="none" stroke="#dcc69a" stroke-width="2"/>' },
  editor_sofia: { skin:'#e0b48f', hair:'#3c2d29', coat:'#65434a', rx:10, hairBack:'<path d="M18 27q-3-19 9-24 13-4 20 8l1 19-7 8-2-25-17 2-1 20z"/>', hairFront:'<path d="M19 20q1-14 12-16 11 0 15 14-9-5-15-4-5 0-12 6z"/><path d="M40 15q7 9 3 19" fill="none" stroke="#3c2d29" stroke-width="3"/>', face:'<path d="M29 37h6" stroke="#825247" stroke-width="1.4"/>', facial:'<path d="M23 25h7m4 0h7" stroke="#30251f" stroke-width="1.6"/><path d="M24 29l4 1m9-1 4-1" stroke="#b87f66" stroke-width="1"/>', collar:'<path d="M22 45h20l7 14H15z" fill="#b59a8a" stroke="#33291f" stroke-width="1.5"/><path d="M24 48l8 7 8-7" fill="none" stroke="#ead9b4" stroke-width="2"/>' },
  police_sergeant_ivan: { skin:'#bd875f', hair:'#3b2d28', coat:'#374452', rx:13, hairBack:'<path d="M18 26q-4-17 8-23 12-4 20 7l1 19-6 8-3-24-17 1-1 20z"/>', hairFront:'<path d="M18 15q3-11 14-12 12 0 16 11l-4 5-7-5-8 4-7-2-4 4z" fill="#40312a" stroke="#30251f" stroke-width="1.5"/><path d="M20 17l-1 13m25-13 1 13" stroke="#40312a" stroke-width="3"/>', face:'', facial:'<path d="M24 30q8-4 16 0-1 7-8 8-7-1-8-8z" fill="#4c392f"/><path d="M22 23h7m6 0h7" stroke="#30251f" stroke-width="2"/>', collar:'<path d="M23 45h18l8 14H15z" fill="#56687b" stroke="#33291f" stroke-width="1.5"/><path d="M25 48h14m-12 4h10" stroke="#cfb476" stroke-width="2"/><circle cx="32" cy="55" r="2" fill="#cfb476"/>' },
  junior_guard_sergey: { skin:'#edbf98', hair:'#765a40', coat:'#46566a', rx:10, hairBack:'<path d="M21 23q-2-14 8-18 10-3 16 7l1 15-5 7-3-19-14 1-1 17z"/>', hairFront:'<path d="M20 14q3-10 12-10 10 0 14 9l-4 5-7-4-7 3-6-2-3 3z" fill="#8c704e" stroke="#30251f" stroke-width="1.5"/>', face:'<path d="M29 36q3 1 6 0" stroke="#945d4d" stroke-width="1.3"/>', facial:'<path d="M24 25q4-3 8 0m2 0q4-3 7 0" fill="none" stroke="#30251f" stroke-width="1.3"/>', collar:'<path d="M23 45h18l5 14H18z" fill="#6d8091" stroke="#33291f" stroke-width="1.5"/><path d="M25 48h14" stroke="#d9c58f" stroke-width="2"/>' },
  yardkeeper_semyon: { skin:'#bd885f', hair:'#65594b', coat:'#756446', rx:13, hairBack:'<path d="M18 26q-4-17 8-23 12-4 20 7l1 17-7 8-2-22-18 1-1 18z"/>', hairFront:'<path d="M18 15q3-11 14-12 12 1 16 11l-2 6-7-5-8 3-8-2-4 3z" fill="#6d6254" stroke="#30251f" stroke-width="1.5"/>', face:'', facial:'<path d="M24 30q8 5 16 0-2 7-8 8-6-1-8-8z" fill="#5a4033"/><path d="M23 24h6m7 0h6" stroke="#30251f" stroke-width="1.5"/>', collar:'<path d="M22 45h20l9 14H13z" fill="#9e875e" stroke="#33291f" stroke-width="1.5"/><path d="M24 49h16" stroke="#d7bd87" stroke-width="2"/>' },
  laundress_mariya: { skin:'#dbad88', hair:'#6a5142', coat:'#59635d', rx:11, hairBack:'<path d="M19 27q-4-17 8-23 12-4 19 7l1 19-6 6-2-23-17 1-1 18z"/>', hairFront:'<path d="M18 15l7-10 9-3 11 7 4 9-5 4-6-7-7 4-8-2-5 4z" fill="#a6957c" stroke="#30251f" stroke-width="1.5"/>', face:'<path d="M28 37q4 1 8-1" fill="none" stroke="#825247" stroke-width="1.6"/>', facial:'<path d="M23 29l5 1m9-1 5-1M25 21h4m8 0h4" stroke="#8a6252" stroke-width="1.1"/>', collar:'<path d="M22 45h20l8 14H14z" fill="#a8a18c" stroke="#33291f" stroke-width="1.5"/><path d="M23 48l9 6 9-6" fill="none" stroke="#e5d7b2" stroke-width="2"/>' },
  baker_fyodor: { skin:'#d09a70', hair:'#49352a', coat:'#93643f', rx:12, hairBack:'<path d="M19 25q-3-16 8-21 11-4 19 7l1 17-6 8-3-21-16 1-1 19z"/>', hairFront:'<path d="M19 12q4-9 13-9 12 0 16 10l-3 5-8-4-8 4-7-3-4 3z" fill="#594333" stroke="#30251f" stroke-width="1.5"/>', face:'<path d="M27 36q5 4 10 0" fill="none" stroke="#75483d" stroke-width="1.7"/>', facial:'<path d="M24 25q4-3 8 0m2 0q4-3 8 0" stroke="#30251f" stroke-width="1.4"/>', collar:'<path d="M22 45h20l7 14H15z" fill="#d5c9ad" stroke="#33291f" stroke-width="1.5"/><path d="M24 49h16" stroke="#885b38" stroke-width="2"/>' },
  market_nadezhda: { skin:'#dda985', hair:'#40302a', coat:'#704d39', rx:12, hairBack:'<path d="M18 27q-3-18 9-24 13-5 21 8v19l-7 7-2-23-17 1-1 19z"/>', hairFront:'<path d="M17 15l8-11 9-2 12 7 5 10-6 4-6-8-8 4-9-3-5 4z" fill="#ad9578" stroke="#30251f" stroke-width="1.5"/>', face:'<path d="M27 36q5 2 10-1" fill="none" stroke="#895349" stroke-width="2"/>', facial:'<path d="M23 26q5-3 9 0m2 0q4-3 8 0" fill="none" stroke="#30251f" stroke-width="1.6"/><path d="M22 32h3m17 0h3" stroke="#b77e61" stroke-width="1.2"/>', collar:'<path d="M22 45h20l7 14H15z" fill="#a88059" stroke="#33291f" stroke-width="1.5"/><path d="M22 50q10 4 20 0" fill="none" stroke="#e4ca92" stroke-width="2"/>' },
  porter_gavrila: { skin:'#a97554', hair:'#362a24', coat:'#4e4e48', rx:14, hairBack:'<path d="M17 26q-4-18 9-24 13-5 21 8v21l-7 6-2-25-18 2-1 18z"/>', hairFront:'<path d="M17 14q4-11 15-11 12 0 16 11l-2 6-7-5-8 4-8-2-6 4z" fill="#43352c" stroke="#30251f" stroke-width="1.5"/>', face:'<path d="M23 31q9-4 18 0-2 8-9 10-7-2-9-10z" fill="#49342a"/>', facial:'<path d="M22 24q5-3 9 0m2 0q5-3 9 0" stroke="#30251f" stroke-width="1.7"/><path d="M25 32h14" stroke="#a97554" stroke-width="1.5"/>', collar:'<path d="M20 45h24l9 14H11z" fill="#797461" stroke="#33291f" stroke-width="1.5"/><path d="M22 50h20" stroke="#c4ab7e" stroke-width="2"/>' },
  coachman_timofey: { skin:'#c38b65', hair:'#4b382c', coat:'#545760', rx:10, hairBack:'<path d="M20 24q-3-16 8-20 11-4 18 6l2 16-5 9-4-22-15 1-1 18z"/>', hairFront:'<path d="M18 13q4-11 15-10 12 0 16 11l-3 6-8-4-7 4-8-2-5 4z" fill="#594330" stroke="#30251f" stroke-width="1.5"/>', face:'<path d="M28 37q4-2 8 0" fill="none" stroke="#75463c" stroke-width="1.5"/>', facial:'<path d="M23 25q4-3 8 0m3 0q4-3 8 0" stroke="#30251f" stroke-width="1.3"/><path d="M27 32q5-3 10 0" stroke="#49342b" stroke-width="2"/>', collar:'<path d="M23 45h18l7 14H16z" fill="#85816d" stroke="#33291f" stroke-width="1.5"/><path d="M24 48h16" stroke="#d7bd87" stroke-width="2"/>' },
};

const facialTraits = {
  apothecary_yakov:'long|tired|long|closed|broad', bookbinder_elizaveta:'oval|direct|straight|firm|apron',
  housemaid_olga:'round|downcast|short|quiet|narrow', innkeeper_irina:'wide|arched|button|open|broad',
  landlady_polina:'square|hooded|crooked|frown|shawl', lodging_tatyana:'heart|wide|button|smile|narrow',
  midwife_avdotya:'long|weary|long|flat|shawl', minor_noble_andrei:'angular|direct|straight|thin|high',
  print_apprentice_stepan:'round|bright|small|shy|short', scribal_yuri:'long|hooded|bent|stern|high',
  servant_varvara:'oval|alert|narrow|closed|shawl', student_vasily:'angular|bright|short|smile|coat',
  teacher_lyubov:'round|kind|broad|warm|shawl', typesetter_nikita:'square|tired|straight|flat|work',
  warehouse_pyotr:'wide|deep|broad|down|work', street_vendor_matryona:'broad|alert|short|smile|apron',
  watercarrier_luka:'broad|deep|long|firm|coat', fishseller_klavdiya:'heart|narrow|small|pressed|apron',
  carter_roman:'angular|narrow|straight|crooked|coat', yardkeeper_semyon:'square|deep|broad|stern|broad',
  laundress_mariya:'heart|weary|small|pressed|shawl', baker_fyodor:'round|bright|button|warm|short',
  market_nadezhda:'wide|alert|straight|firm|apron', porter_gavrila:'broad|deep|broad|down|broad',
  coachman_timofey:'angular|narrow|crooked|thin|high', senior_clerk_konstantin:'angular|hooded|bent|stern|high',
  reader_darya:'heart|bright|small|smile|shawl', editor_sofia:'oval|hooded|straight|pressed|narrow',
  police_sergeant_ivan:'square|deep|broad|stern|broad', junior_guard_sergey:'round|alert|button|shy|short',
};
const faceContours = {
  long:'M22 17Q22 10 32 9Q42 10 42 17L41 32Q39 42 32 45Q25 42 23 32Z',
  oval:'M21 18Q20 10 32 10Q44 10 43 18L42 31Q40 41 32 44Q24 41 22 31Z',
  round:'M20 19Q19 10 32 10Q45 10 44 19L42 31Q39 40 32 42Q25 40 22 31Z',
  wide:'M20 18Q20 10 32 10Q44 10 44 18L45 30Q43 41 32 44Q21 41 19 30Z',
  square:'M21 17Q21 10 32 10Q43 10 43 17L43 31Q42 41 32 44Q22 41 21 31Z',
  heart:'M21 17Q21 10 32 10Q43 10 43 17L41 31Q39 41 32 45Q25 41 23 31Z',
  angular:'M21 18L24 11Q32 8 40 11L43 18L42 31Q39 40 32 44Q25 40 22 31Z',
  broad:'M19 18Q20 9 32 9Q44 9 45 18L45 31Q42 42 32 44Q22 42 19 31Z',
};
const eyeStyles = {
  tired:'<path d="M23 26q4-3 8 0m3 0q4-3 8 0" fill="none" stroke="#342720" stroke-width="1.5"/><path d="M24 28h5m7 0h5" stroke="#342720" stroke-width="1.2"/>',
  direct:'<path d="M23 25q4-2 8 0l-1 3h-6zm10 0q4-2 8 0l-1 3h-6z" fill="#342720"/>',
  downcast:'<path d="M23 26q4-4 8-1m3 0q4-3 8 1" fill="none" stroke="#342720" stroke-width="1.7"/><circle cx="27" cy="27" r="1" fill="#342720"/><circle cx="37" cy="27" r="1" fill="#342720"/>',
  arched:'<path d="M22 24q5-4 10 0m2 0q5-4 10 0" fill="none" stroke="#342720" stroke-width="1.4"/><ellipse cx="27" cy="27" rx="2" ry="1.5" fill="#342720"/><ellipse cx="37" cy="27" rx="2" ry="1.5" fill="#342720"/>',
  hooded:'<path d="M23 27h8m4 0h8" stroke="#342720" stroke-width="2.2"/><circle cx="27" cy="27" r=".8" fill="#d9aa83"/><circle cx="37" cy="27" r=".8" fill="#d9aa83"/>',
  wide:'<ellipse cx="27" cy="26" rx="2.4" ry="2.1" fill="#342720"/><ellipse cx="37" cy="26" rx="2.4" ry="2.1" fill="#342720"/>',
  bright:'<path d="M23 25q4-2 8 0m3 0q4-2 8 0" fill="none" stroke="#342720" stroke-width="1.4"/><circle cx="27" cy="27" r="1.5" fill="#342720"/><circle cx="37" cy="27" r="1.5" fill="#342720"/>',
  weary:'<path d="M23 27q4-2 8 0m3 0q4-2 8 0" stroke="#342720" stroke-width="1.5"/><path d="M23 30q4 2 8 0m3 0q4 2 8 0" stroke="#a26d59" stroke-width="1"/>',
  narrow:'<path d="M23 26q4-2 8 0m3 0q4-2 8 0" fill="none" stroke="#342720" stroke-width="2.1"/>',
  alert:'<path d="M23 25q4-3 8 0m3 0q4-3 8 0" fill="none" stroke="#342720" stroke-width="1.3"/><circle cx="27" cy="27" r="1.4" fill="#342720"/><circle cx="37" cy="27" r="1.4" fill="#342720"/>',
  kind:'<path d="M23 25q4-2 8 1m3-1q4-2 8 1" fill="none" stroke="#342720" stroke-width="1.3"/><circle cx="27" cy="27" r="1" fill="#342720"/><circle cx="37" cy="27" r="1" fill="#342720"/>',
  deep:'<path d="M22 25q5-3 9 1m2-1q5-3 9 1" fill="none" stroke="#30251f" stroke-width="2"/><circle cx="27" cy="28" r="1.2" fill="#30251f"/><circle cx="37" cy="28" r="1.2" fill="#30251f"/>',
};
const noseStyles = {
  long:'<path d="M32 27v6l-2 2h4" fill="none" stroke="#9a6c54" stroke-width="1.4"/>',
  straight:'<path d="M32 27v7" stroke="#9a6c54" stroke-width="1.3"/>',
  short:'<path d="M31 29v3h2" fill="none" stroke="#a17057" stroke-width="1.4"/>',
  button:'<path d="M30 32q2-2 4 0" fill="none" stroke="#9a6c54" stroke-width="1.5"/>',
  crooked:'<path d="M32 27l-1 4 2 2-3 2" fill="none" stroke="#8f604d" stroke-width="1.4"/>',
  bent:'<path d="M32 27v5l-3 3 4 1" fill="none" stroke="#8f604d" stroke-width="1.4"/>',
  broad:'<path d="M30 29q2-2 4 0l1 4q-3 2-6 0z" fill="#ae7b61"/>',
  small:'<circle cx="32" cy="32" r="1.1" fill="#96644e"/>',
};
const mouthStyles = {
  closed:'<path d="M28 37h8" stroke="#70463c" stroke-width="1.5"/>', firm:'<path d="M27 37q5 1 10 0" stroke="#70463c" stroke-width="2"/>',
  quiet:'<path d="M29 37q3 1 6 0" stroke="#89574a" stroke-width="1.2"/>', open:'<ellipse cx="32" cy="37" rx="2.5" ry="1.8" fill="#75433a"/>',
  frown:'<path d="M28 38q4-3 8 0" fill="none" stroke="#75463c" stroke-width="1.7"/>', thin:'<path d="M29 37h6" stroke="#683e36" stroke-width="1.1"/>',
  shy:'<path d="M29 37q3 2 6 0" fill="none" stroke="#9a5e51" stroke-width="1.2"/>', smile:'<path d="M27 36q5 5 10 0" fill="none" stroke="#875146" stroke-width="1.7"/>',
  stern:'<path d="M27 37h10" stroke="#583a34" stroke-width="2"/>', flat:'<path d="M28 37q4-1 8 0" stroke="#70463c" stroke-width="1.5"/>',
  warm:'<path d="M27 36q5 4 10 0" fill="none" stroke="#95604e" stroke-width="1.3"/>', down:'<path d="M27 38q5-4 10 0" fill="none" stroke="#70463c" stroke-width="1.5"/>',
  pressed:'<path d="M28 37q4-2 8 0" fill="none" stroke="#75463e" stroke-width="1.8"/>', crooked:'<path d="M28 37l5 1 3-2" fill="none" stroke="#70463c" stroke-width="1.6"/>',
};
const shoulderShapes = {
  broad:'M4 64q2-16 12-19 7-3 16-3t16 3q10 3 12 19z', narrow:'M10 64q1-12 10-17 5-3 12-3t12 3q9 5 10 17z',
  apron:'M5 64q1-13 11-18 7-4 16-4t16 4q10 5 11 18z', shawl:'M4 64q2-14 12-19 7-3 16-3t16 3q10 5 12 19z',
  high:'M7 64q1-15 10-19 6-3 15-3t15 3q9 4 10 19z', short:'M9 64q1-10 9-14 6-3 14-3t14 3q8 4 9 14z',
  coat:'M5 64q1-14 11-19 7-3 16-3t16 3q10 5 11 19z', work:'M3 64q2-15 12-19 7-3 17-3t17 3q10 4 12 19z',
};

function personalizePortrait(_svg, card) {
  const p = portraitProfiles[card.id];
  if (!p) throw new Error(`No individually authored portrait profile for ${card.id}`);
  const [shape, eyes, nose, mouth, shouldersKey] = (facialTraits[card.id] ?? 'oval|bright|straight|closed|coat').split('|');
  for (const key of [shape, eyes, nose, mouth, shouldersKey]) if (!({ ...faceContours, ...eyeStyles, ...noseStyles, ...mouthStyles, ...shoulderShapes })[key]) throw new Error(`Unknown portrait feature ${key} for ${card.id}`);
  const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
  const shoulderPath = shoulderShapes[shouldersKey];
  const shoulders = `<path d="${shoulderPath}" fill="${p.coat}" stroke="#241d19" stroke-width="2"/><path d="M13 53q19 6 38 0" fill="none" stroke="#c6a46c" stroke-width="2"/>`;
  const face = `<path d="${faceContours[shape]}" fill="${p.skin}" stroke="#30251f" stroke-width="1.5"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${escape(card.displayNameKo)}의 창작 초상"><rect width="64" height="64" fill="#30251f"/><path d="M3 64V4h58v60" fill="none" stroke="#8a6d45" stroke-width="2"/>${shoulders}<path d="M${32-p.rx} 27q-2-17 10-20 12-4 17 9l-3 22-8 5-2-19-13 1-2 17-7-5z" fill="${p.hair}"/>${face}${eyeStyles[eyes]}${noseStyles[nose]}${mouthStyles[mouth]}${p.facial}<g fill="${p.hair}" stroke="#30251f" stroke-width="1">${p.hairFront}</g>${p.collar}<path d="M18 46q14 4 28 0" fill="none" stroke="#30251f" stroke-width="1.5"/></svg>`;
}

const generatedFiles = new Set();
const generatedPortraitFiles = new Set();
const reassignedSpriteFiles = {
  senior_clerk_konstantin: 'assets/senior_clerk_konstantin.png',
  reader_darya: 'assets/reader_darya.png',
};
const reassignedPortraitFiles = {
  street_vendor_matryona: 'assets/portrait-street_vendor_matryona.svg',
  watercarrier_luka: 'assets/portrait-watercarrier_luka.svg',
  fishseller_klavdiya: 'assets/portrait-fishseller_klavdiya.svg',
  carter_roman: 'assets/portrait-carter_roman.svg',
  yardkeeper_semyon: 'assets/portrait-yardkeeper_semyon.svg',
  laundress_mariya: 'assets/portrait-laundress_mariya.svg',
  baker_fyodor: 'assets/portrait-baker_fyodor.svg',
  market_nadezhda: 'assets/portrait-market_nadezhda.svg',
  porter_gavrila: 'assets/portrait-porter_gavrila.svg',
  coachman_timofey: 'assets/portrait-coachman_timofey.svg',
};
for (const [identity,id] of ids.entries()) {
  const prop = props[id]; if (!prop) throw new Error(`No role prop defined for ${id}`);
  const file = path.join(root,'rpg','characters',`${id}.json`);
  const card = JSON.parse(await fs.readFile(file,'utf8'));
  if (reassignedSpriteFiles[id]) {
    card.sprite.file = reassignedSpriteFiles[id];
    if (card.spriteAtlas) card.spriteAtlas.file = reassignedSpriteFiles[id];
    await fs.writeFile(file,`${JSON.stringify(card,null,2)}\n`);
  }
  if (reassignedPortraitFiles[id]) {
    card.portrait.file = reassignedPortraitFiles[id];
    await fs.writeFile(file,`${JSON.stringify(card,null,2)}\n`);
  }
  const portraitPath = path.join(root,'rpg',card.portrait.file);
  if (card.portrait.file.toLowerCase().endsWith('.svg') && portraitProfiles[id]) {
    await fs.writeFile(portraitPath,personalizePortrait('',card));
    generatedPortraitFiles.add(`rpg/${card.portrait.file}`);
  }
  const spritePath = path.join(root,'rpg',card.sprite.file);
  if (!card.sprite.file.toLowerCase().endsWith('.png')) continue;
  await fs.writeFile(spritePath,makeSheet(card,prop,identity));
  generatedFiles.add(`rpg/${card.sprite.file}`);
}
const provenancePath=path.join(root,'rpg/assets/ASSET_PROVENANCE.json');
const provenance=JSON.parse(await fs.readFile(provenancePath,'utf8'));
for(const id of ids){const card=JSON.parse(await fs.readFile(path.join(root,'rpg/characters',`${id}.json`),'utf8'));let record=provenance.assets.find(asset=>asset.id===`sprite-${id}`);if(!record)record=provenance.assets.find(asset=>asset.path===`rpg/${card.sprite.file}`);if(record&&generatedFiles.has(`rpg/${card.sprite.file}`)){record.path=`rpg/${card.sprite.file}`;record.generatedBy='scripts/v36-personalize-resident-sprites.mjs';record.notes=`Original project-authored 16×24 pixel sprite frames with a role-specific everyday prop for fictional citizen ${id}; not a documented likeness or evidence of a specific individual's clothing.`;if(card.sprite.visualReferenceIds?.length){record.sourceIds=[...new Set([...(record.sourceIds??[]),...card.sprite.visualReferenceIds])];record.notes=`Original project-authored costume silhouette for fictional resident ${id}. ${card.sprite.visualReferenceNotes??'Source-informed details are listed in the character record.'} Not a documented likeness or exact reconstruction.`;}}const portraitRecord=provenance.assets.find(asset=>asset.path===`rpg/${card.portrait.file}`);if(portraitRecord&&generatedPortraitFiles.has(`rpg/${card.portrait.file}`)){portraitRecord.generatedBy='scripts/v36-personalize-resident-sprites.mjs';portraitRecord.license='original project-authored fictional vector portrait';portraitRecord.historicalConfidence=card.portrait.historicalConfidence??'FICTIONAL_CHARACTER_RECONSTRUCTION';portraitRecord.sourceIds=[];portraitRecord.notes=`Individually authored fictional face, hair, expression, and clothing design for ${id}; created for game readability, not a documented likeness, period portrait, or evidence of typical historical dress.`;}}
for (const id of Object.keys(reassignedPortraitFiles)) {
  const card = JSON.parse(await fs.readFile(path.join(root,'rpg/characters',`${id}.json`),'utf8'));
  const record = provenance.assets.find(asset => asset.id === `portrait-${id}`);
  if (!record) throw new Error(`Missing portrait provenance record for ${id}`);
  record.path = `rpg/${card.portrait.file}`;
  record.generatedBy = 'scripts/v36-personalize-resident-sprites.mjs';
  record.type = 'ORIGINAL_VECTOR_PORTRAIT';
  record.license = 'original project-authored fictional vector portrait';
  record.historicalConfidence = card.portrait.historicalConfidence ?? 'FICTIONAL_CHARACTER_RECONSTRUCTION';
  record.sourceIds = [];
  record.notes = `Individually authored fictional face, hair, expression, and clothing design for ${id}; created for game readability, not a documented likeness, period portrait, or evidence of typical historical dress.`;
}
for (const id of ids) {
  const card = JSON.parse(await fs.readFile(path.join(root,'rpg/characters',`${id}.json`),'utf8'));
  if (card.kind !== 'FICTIONAL') continue;
  const portraitRecord = provenance.assets.find(asset => asset.path === `rpg/${card.portrait.file}`);
  if (!portraitRecord?.sourceIds?.length) continue;
  portraitRecord.contextSourceIds = [...new Set([...(portraitRecord.contextSourceIds ?? []), ...portraitRecord.sourceIds])];
  portraitRecord.sourceIds = [];
  portraitRecord.notes = `${portraitRecord.notes ?? ''} Linked publication or event records provide narrative context only; they are not visual references for this fictional portrait.`.trim();
}
await fs.writeFile(provenancePath,`${JSON.stringify(provenance,null,2)}\n`);
console.log(JSON.stringify({status:'PASS',residents:ids.length,generatedRasterSheets:generatedFiles.size,individuallyAuthoredVectorPortraits:generatedPortraitFiles.size,svgSheetsKept:ids.length-generatedFiles.size,roleProps:ids.length,framesPerResident:'3×4',propTypes:Object.fromEntries(Object.entries(props).map(([id,[name]])=>[id,name]))},null,2));
