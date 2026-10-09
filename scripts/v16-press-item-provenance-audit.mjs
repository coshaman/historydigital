import fs from 'node:fs';
import crypto from 'node:crypto';
const manifest = JSON.parse(fs.readFileSync('data/true-press-desk-v16.json', 'utf8'));
const rows = manifest.items.map(item => {
  const runtimeTextHash = crypto.createHash('sha256').update(`${item.ru}\n${item.ko}`).digest('hex');
  const status = item.sourceId === item.excerptSourceId && item.exactDate && item.ru && item.ko && item.provenance ? 'PASS' : 'FAIL';
  return [item.itemId, manifest.sceneId, item.sourceId, item.excerptId, item.excerptSourceId, item.provenance, item.exactDate, item.pageFolio, runtimeTextHash, status];
});
fs.mkdirSync('docs/v16', {recursive:true});
fs.writeFileSync('docs/v16/PRESS_ITEM_PROVENANCE_AUDIT.csv', ['itemId,sceneId,sourceId,excerptId,excerptSourceId,supportingSources,exactDate,page/folio,runtimeTextHash,status', ...rows.map(row => row.map(value => `"${String(value).replaceAll('"','""')}"`).join(','))].join('\n')+'\n');
const pass = rows.every(row => row.at(-1) === 'PASS');
console.log(JSON.stringify({sceneId:manifest.sceneId, itemCount:rows.length, pass, statuses:rows.map(row => ({itemId:row[0],status:row.at(-1)}))}, null, 2));
if (!pass) process.exit(1);
