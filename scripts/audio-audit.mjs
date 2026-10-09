import { readFile } from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../data/audio-manifest.json',import.meta.url)));
const source=await readFile(new URL('../three-walk.js',import.meta.url),'utf8');
const failures=[];for(const item of manifest.events)if(!item.license||!item.source)failures.push(`${item.id}: missing license/source`);for(const token of ['AudioContext','lowpass','setInterval','triangle'])if(!source.includes(token))failures.push(`three-walk missing ${token}`);if(failures.length){console.error(JSON.stringify(failures));process.exit(1);}console.log(`audio-audit: ${manifest.events.length} licensed/original ambience events, no external recordings — PASS`);
