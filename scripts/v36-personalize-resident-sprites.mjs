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
  watercarrier_luka:['water pail',['#####','#...#','#...#','#####','.###.']],
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
    if(card.id==='street_vendor_matryona') {
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
function personalizePortrait(svg, card, identity) {
  svg = svg.replace(/<g aria-label="[^"]*"><path d="M7 50h11v9H7z"[\s\S]*?<\/g>/g, '');
  const palette = card.sprite.palette ?? {};
  const accent = palette.trim ?? ['#b18a57','#9b654c','#71816c','#687b8f','#8d6e91','#ad7959'][identity % 6];
  const code = identity.toString(2).padStart(6,'0');
  const marks = [...code].map((bit,index) => bit === '1'
    ? `<rect x="${8 + (index % 3) * 3}" y="${51 + Math.floor(index / 3) * 3}" width="2" height="2" fill="${accent}"/>`
    : '').join('');
  return svg.replace('</svg>', `<g aria-label="${card.occupation}"><path d="M7 50h11v9H7z" fill="${palette.cloth ?? '#55443b'}" stroke="${accent}" stroke-width="1"/>${marks}</g></svg>`);
}

const generatedFiles = new Set();
const reassignedSpriteFiles = {
  senior_clerk_konstantin: 'assets/senior_clerk_konstantin.png',
  reader_darya: 'assets/reader_darya.png',
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
  const portraitPath = path.join(root,'rpg',card.portrait.file);
  if (card.portrait.file.toLowerCase().endsWith('.svg')) {
    const portrait = await fs.readFile(portraitPath,'utf8');
    await fs.writeFile(portraitPath,personalizePortrait(portrait,card,identity));
  }
  const spritePath = path.join(root,'rpg',card.sprite.file);
  if (!card.sprite.file.toLowerCase().endsWith('.png')) continue;
  await fs.writeFile(spritePath,makeSheet(card,prop,identity));
  generatedFiles.add(`rpg/${card.sprite.file}`);
}
const provenancePath=path.join(root,'rpg/assets/ASSET_PROVENANCE.json');
const provenance=JSON.parse(await fs.readFile(provenancePath,'utf8'));
for(const id of ids){let record=provenance.assets.find(asset=>asset.id===`sprite-${id}`);if(!record){const matching=JSON.parse(await fs.readFile(path.join(root,'rpg/characters',`${id}.json`),'utf8'));record=provenance.assets.find(asset=>asset.path===`rpg/${matching.sprite.file}`);}const card=JSON.parse(await fs.readFile(path.join(root,'rpg/characters',`${id}.json`),'utf8'));if(record&&generatedFiles.has(`rpg/${card.sprite.file}`)){record.path=`rpg/${card.sprite.file}`;record.generatedBy='scripts/v36-personalize-resident-sprites.mjs';record.notes=`Original project-authored 16×24 pixel sprite frames with a role-specific everyday prop for fictional citizen ${id}; not a documented likeness or evidence of a specific individual's clothing.`;if(card.sprite.visualReferenceIds?.length){record.sourceIds=[...new Set([...(record.sourceIds??[]),...card.sprite.visualReferenceIds])];record.notes=`Original project-authored costume silhouette for fictional resident ${id}. ${card.sprite.visualReferenceNotes??'Source-informed details are listed in the character record.'} Not a documented likeness or exact reconstruction.`;}}}
await fs.writeFile(provenancePath,`${JSON.stringify(provenance,null,2)}\n`);
console.log(JSON.stringify({status:'PASS',residents:ids.length,generatedRasterSheets:generatedFiles.size,svgSheetsKept:ids.length-generatedFiles.size,roleProps:ids.length,framesPerResident:'3×4',propTypes:Object.fromEntries(Object.entries(props).map(([id,[name]])=>[id,name]))},null,2));
