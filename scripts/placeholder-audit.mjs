import { readFile } from 'node:fs/promises';
const files=['index.html','app.js','styles.css','data/content.json','data/act-iii-scenes.json']; const bad=/lorem ipsum|fake screenshot|placeholder dialogue|TODO|href="#"/i; const hits=[];
for(const f of files){const text=await readFile(new URL(`../${f}`,import.meta.url),'utf8');if(bad.test(text))hits.push(f);}
if(hits.length){console.error(`placeholder audit failed: ${hits.join(', ')}`);process.exit(1);} console.log('placeholder-audit: no placeholder dialogue, lorem ipsum, TODO, or dead href — PASS');
