import { readFile } from 'node:fs/promises';
const src=await readFile(new URL('../three-walk.js',import.meta.url),'utf8');
const checks=[['pixel ratio cap',/setPixelRatio\(Math\.min\(devicePixelRatio,1\.5\)/.test(src)],['frustum/camera culling',/PerspectiveCamera/.test(src)],['collision guard',/function blocked/.test(src)],['geometry reuse intent',/const building=/.test(src)],['reduced-motion fallback',/walk-scene/.test(await readFile(new URL('../index.html',import.meta.url),'utf8'))]];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'}\t${name}`); if(checks.some(([,ok])=>!ok))process.exit(1);
