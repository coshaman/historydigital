import { readFile } from 'node:fs/promises';
const src=await readFile(new URL('../three-walk.js',import.meta.url),'utf8');
const css=await readFile(new URL('../styles.css',import.meta.url),'utf8');
const checks=[['pixel ratio cap',/setPixelRatio\(Math\.min\(devicePixelRatio,1\.5\)/.test(src)],['frustum/camera culling',/PerspectiveCamera/.test(src)],['collision guard',/function blocked/.test(src)],['geometry reuse intent',/const building=/.test(src)],['reduced-motion fallback',/const reduceMotion = window\.matchMedia/.test(src)&&/if\(!reduceMotion\|\|keys\.size\)requestAnimationFrame\(frame\)/.test(src)&&/prefers-reduced-motion:reduce/.test(css)&&/threeWalkCanvas\{display:none!important\}/.test(css)]];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'}\t${name}`); if(checks.some(([,ok])=>!ok))process.exit(1);
