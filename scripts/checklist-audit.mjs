import { readFile } from 'node:fs/promises';
const read = file => readFile(new URL(`../data/${file}`, import.meta.url), 'utf8').then(JSON.parse);
const [content, act, route, assets] = await Promise.all([read('content.json'), read('act-iii-scenes.json'), read('route-evidence.json'), read('asset-manifest.json')]);
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const checks = [
  ['Korean identity', (await readFile(new URL('../index.html', import.meta.url), 'utf8')).includes('현대 한국인')],
  ['seven Act III scene packets', act.scenes.length === 7],
  ['source-linked claims', content.sources.length >= 9],
  ['five endings', content.endings.length === 5],
  ['three hard gates per ending', content.endings.every(e => e.hardGates?.length >= 3)],
  ['five route landmarks', route.landmarks.length >= 5],
  ['asset provenance fields', assets.assets.every(a => a.license && a.provenance && a.confidence)],
  ['180–300m route', route.lengthMeters >= 180 && route.lengthMeters <= 300],
  ['branched encounter/invitation/reputation route', ['state.relationships','state.invitation','state.reputation','state.rank'].every(token => app.includes(token))],
  ['separate historical axes', ['european_outlook','tradition_affinity','state_loyalty','orthodoxy_attitude','radicalism'].every(token => app.includes(token))],
  ['explicit binary rights policy', content.sources.every(s => typeof s.binaryUsed === 'boolean' && s.binaryRights)]
];
for (const [name, ok] of checks) console.log(`${ok ? 'DONE' : 'OPEN'}\t${name}`);
if (checks.some(([, ok]) => !ok)) process.exitCode = 1;
