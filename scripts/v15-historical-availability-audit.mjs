import {readFile} from 'node:fs/promises';

const readJson=path=>readFile(new URL(path,import.meta.url),'utf8').then(JSON.parse);
const [v14,v15,corpus]=await Promise.all([
  readJson('../data/press-desk-gold.json'),
  readJson('../data/press-desk-gold-v15.json'),
  readJson('../data/v6-gold-cases.json')
]);
const failures=[];const corpusSources=new Map(corpus.cases.flatMap(item=>(item.sources||[]).map(source=>[source.sourceId,source])));
for(const manifest of [v14,v15]){
  if(!manifest.earliest||!manifest.latest)failures.push(`${manifest.sceneId}: missing scene interval`);
  for(const item of manifest.incoming){
    const source=corpusSources.get(item.sourceId); if(!source)failures.push(`${manifest.sceneId}/${item.itemId}: source ${item.sourceId} missing from corpus`);
    if(!item.latestPossibleDate)failures.push(`${manifest.sceneId}/${item.itemId}: missing latestPossibleDate`);
    if(item.latestPossibleDate>manifest.earliest)failures.push(`${manifest.sceneId}/${item.itemId}: ${item.latestPossibleDate} > ${manifest.earliest}`);
    if(!item.provenance)failures.push(`${manifest.sceneId}/${item.itemId}: missing exact provenance`);
    if(manifest.constraints.allPrimaryInWorld && source && source.role!=='PRIMARY_IN_WORLD')failures.push(`${manifest.sceneId}/${item.itemId}: source role ${source.role}`);
  }
}
const result={rule:'latestPossibleDate <= earliestPossibleDate',scenes:[v14.sceneId,v15.sceneId],incoming:v14.incoming.length+v15.incoming.length,failures};
console.log(JSON.stringify(result,null,2));
if(failures.length)process.exit(1);
console.log('v15-historical-availability-audit: uncertain intervals handled conservatively — PASS');
