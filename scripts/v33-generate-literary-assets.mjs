import { readFile, writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

const pngCrcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; pngCrcTable[n] = c >>> 0; }
function crc32(bytes) { let c = 0xffffffff; for (const byte of bytes) c = pngCrcTable[(c ^ byte) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) { const name = Buffer.from(type), length = Buffer.alloc(4), crc = Buffer.alloc(4); length.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data]))); return Buffer.concat([length, name, data, crc]); }
function makeSprite(palette = {}) {
  const pixels = new Uint8Array(48 * 96 * 4);
  const colors = { outline:'#28211e', coat:'#604735', trim:'#c3a070', skin:'#d4a67f', hair:'#382923', shirt:'#d5c6a7', trousers:'#393b37', shoes:'#211c19', hat:'#332a24', satchel:'#865c36', ...palette };
  const rgba = color => [1,3,5].map(index => parseInt(color.slice(index,index+2),16)).concat(255);
  function put(x,y,color) { if (x < 0 || y < 0 || x >= 48 || y >= 96) return; const at = (y*48+x)*4; pixels.set(rgba(colors[color] ?? color),at); }
  function rect(x,y,w,h,color) { for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)put(xx,yy,color); }
  for(let direction=0;direction<4;direction++) for(let frame=0;frame<3;frame++) {
    const ox=frame*16, oy=direction*24, stride=frame===1?1:0;
    rect(ox+5,oy+20,3,3,'shoes'); rect(ox+9,oy+20,3,3,'shoes');
    rect(ox+5,oy+15+stride,3,5,'trousers'); rect(ox+9,oy+15+(frame===2?1:0),3,5,'trousers');
    rect(ox+4,oy+9,8,8,'outline'); rect(ox+5,oy+10,6,6,'coat'); rect(ox+7,oy+10,2,6,'trim');
    rect(ox+3,oy+11,2,6,'coat'); rect(ox+12,oy+11,2,6,'coat');
    rect(ox+6,oy+6,5,4,'skin'); rect(ox+5,oy+5,7,2,'hair');
    rect(ox+5,oy+3,7,2,'hat'); rect(ox+6,oy+2,5,1,'trim'); rect(ox+4,oy+4,9,1,'hat');
    if(direction===0){put(ox+7,oy+7,'outline');put(ox+10,oy+7,'outline');put(ox+8,oy+8,'outline');}
    if(direction===2||direction===3){put(direction===2?6:10,oy+7,'outline');rect(ox+(direction===2?9:5),oy+7,2,1,'skin');}
    rect(ox+1,oy+15,2,4,'satchel'); put(ox+2,oy+16,'trim');
    if(frame===1){put(ox+7,oy+23,'#e4d4b3');}
  }
  const scan=Buffer.alloc((48*4+1)*96);for(let y=0;y<96;y++)scan.set(pixels.subarray(y*48*4,(y+1)*48*4),y*(48*4+1)+1);
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(48,0);ihdr.writeUInt32BE(96,4);ihdr.set([8,6,0,0,0],8);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

const map=JSON.parse(await readFile('rpg/maps/courtyard.json','utf8'));
map.name='dead-souls';map.mapId='dead-souls';
map.metadata={displayNameKo:'《죽은 혼》의 도청 소재지 여관',observerStart:{x:9,y:10},date:'1842-01-01',mapClass:'LITERARY_REALM',realmId:'LITERARY_DEAD_SOULS',geography:'A literary provincial town and inn from chapter one of Gogol’s 1842 novel; no real Russian town is claimed.',sourceIds:['LIT-GOGOL-DEAD-SOULS-1842'],note:'The fictional realm is kept separate from the 1847–1849 historical timeline.'};
map.properties=map.properties.filter(item=>!['date','mapClass','geography','note','sourceIds','displayNameKo','observerStart','mapId'].includes(item.name));
map.properties.push(...[['mapId','string','"dead-souls"'],['displayNameKo','string','"《죽은 혼》의 도청 소재지 여관"'],['observerStart','string','{"x":9,"y":10}'],['date','string','"1842-01-01"'],['mapClass','string','"LITERARY_REALM"'],['geography','string','"fictional town from Gogol’s novel; not a real location"'],['sourceIds','string','["LIT-GOGOL-DEAD-SOULS-1842"]'],['note','string','"A separate literary scene, not a historical witness setting."']].map(([name,type,value])=>({name,type,value})));
const interactions=map.layers.find(layer=>layer.name==='Interactions');
interactions.objects=[
  {id:80,name:'여관 문간에 놓인 제1장',type:'source',x:112,y:160,width:16,height:16,rotation:0,visible:true,properties:[{name:'sourceId',type:'string',value:'LIT-GOGOL-DEAD-SOULS-1842'}]},
  {id:81,name:'여관 장부',type:'quest-object',x:192,y:128,width:16,height:16,rotation:0,visible:true,properties:[{name:'questId',type:'string',value:'LITERARY_DEAD_SOULS_1842'}]},
  {id:83,name:'도청 소재지로 들어가는 여관 마당',type:'inspectable',x:64,y:80,width:16,height:16,rotation:0,visible:true,properties:[{name:'realmId',type:'string',value:'LITERARY_DEAD_SOULS'}]}
];
const npcs=map.layers.find(layer=>layer.name==='NPCs');
npcs.objects=[{id:82,name:'파벨 이바노비치 치치코프',type:'npc',x:160,y:160,width:16,height:16,rotation:0,visible:true,properties:[{name:'hostId',type:'string',value:'literary_chichikov'}]}];
map.nextobjectid=84;
await writeFile('rpg/maps/dead-souls.json',`${JSON.stringify(map,null,2)}\n`);
await writeFile('rpg/assets/chichikov.png',makeSprite());
await writeFile('rpg/assets/nekrasov.png',makeSprite({coat:'#354448',trim:'#b98c52',hat:'#41332b',satchel:'#5b4936'}));
