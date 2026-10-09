import { readFile } from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('../data/content.json',import.meta.url)));
const failures=[]; for(const s of data.sources){if(!/^https:\/\//.test(s.url))failures.push(`${s.id}: invalid URL`);if(!s.linkStatus)failures.push(`${s.id}: missing link status`);if(typeof s.binaryUsed!=='boolean')failures.push(`${s.id}: missing binaryUsed policy`);if(!s.binaryRights)failures.push(`${s.id}: missing binary-rights decision`);if(s.binaryUsed&&!/public-domain|licensed|original/i.test(`${s.rights} ${s.binaryRights}`))failures.push(`${s.id}: used binary lacks rights basis`);}
for(const line of data.dialogue)if(line.type==='DIRECT'&&!line.sourceIds?.length)failures.push(`${line.id}: DIRECT line without source`);
if(failures.length){console.error(failures.join('\n'));process.exit(1);} console.log(`source-audit: ${data.sources.length} source records have URL/link-status/binary-use/rights policy — PASS`);
