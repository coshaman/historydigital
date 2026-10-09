import { readFile } from 'node:fs/promises';
const read = file => readFile(new URL(`../data/${file}`, import.meta.url), 'utf8').then(JSON.parse);
const [data, claims, voices, assets, act, route] = await Promise.all([read('content.json'), read('claim-registry.json'), read('voice-sheets.json'), read('asset-manifest.json'), read('act-iii-scenes.json'), read('route-evidence.json')]);
const ids = new Set(data.sources.map(s => s.id));
const fail = [];
for (const scene of data.scenes) for (const id of scene.sourceIds) if (!ids.has(id)) fail.push(`${scene.id}: missing source ${id}`);
for (const line of data.dialogue) { for (const id of line.sourceIds) if (!ids.has(id)) fail.push(`${line.id}: missing source ${id}`); if (!line.date_ceiling) fail.push(`${line.id}: missing date ceiling`); }
if (data.endings.length !== 5) fail.push(`ending count ${data.endings.length}, expected 5`);
for (const ending of data.endings) if (!ending.hardGates || ending.hardGates.length < 3) fail.push(`${ending.id}: fewer than three hard gates`);
for (const asset of data.assets) for (const field of ['rights','provenance','confidence']) if (!asset[field]) fail.push(`${asset.id}: missing ${field}`);
for (const claim of claims.claims) { if (!claim.sourceIds?.length) fail.push(`${claim.id}: factual claim has no source`); for (const id of claim.sourceIds) if (!ids.has(id)) fail.push(`${claim.id}: missing source ${id}`); }
for (const voice of voices.voices) for (const field of ['address','vocabulary','lineLength','interests','forbidden']) if (!voice[field]) fail.push(`${voice.id}: missing voice field ${field}`);
for (const asset of assets.assets) for (const field of ['license','provenance','confidence']) if (!asset[field]) fail.push(`${asset.id}: missing asset ${field}`);
const modern = /unlock|seamless|let's get started|welcome back|social media|startup/i;
for (const line of data.dialogue) if (modern.test(line.line)) fail.push(`${line.id}: modern dialogue blacklist match`);
for (const scene of data.scenes) if (!scene.date || !scene.location || !scene.sourceIds?.length) fail.push(`${scene.id}: missing date, location, or sources`);
if (act.scenes.length !== 7) fail.push(`Act III scene count ${act.scenes.length}, expected 7`);
for (const scene of act.scenes) { if (!scene.date || !scene.city || !scene.institution || !scene.participants?.length || !scene.sourceIds?.length) fail.push(`${scene.id}: incomplete historical scene packet`); for (const id of scene.sourceIds) if (!ids.has(id)) fail.push(`${scene.id}: missing scene source ${id}`); if (scene.choices) for (const choice of scene.choices) if (!choice.stateEffect || !Object.keys(choice.stateEffect).length) fail.push(`${scene.id}/${choice.id}: missing state effect`); }
if (route.landmarks.length < 5) fail.push('route: fewer than five evidence-backed landmarks'); if (!route.sources?.length) fail.push('route: missing map/panorama sources'); if (route.lengthMeters < 180 || route.lengthMeters > 300) fail.push('route: length outside 180–300 m target'); for (const landmark of route.landmarks) { if (!landmark.floors || !landmark.bays || !landmark.widthMeters || !landmark.sources?.length || !landmark.confidence) fail.push(`${landmark.id}: incomplete façade evidence`); for (const id of landmark.sources) if (!ids.has(id)) fail.push(`${landmark.id}: missing source ${id}`); }
if (!route.referenceImages?.length || route.referenceImages.some(i => !i.url || !i.sourcePage || !i.rights)) fail.push('route: incomplete reference image provenance');
try { const gltf=JSON.parse(await readFile(new URL('../assets/route-reconstruction.gltf',import.meta.url))); if(gltf.asset?.version!=='2.0'||gltf.nodes?.length<5||!gltf.asset?.extras?.sources?.length) fail.push('route glTF: missing version, landmark nodes, or source metadata'); } catch { fail.push('route glTF: missing or invalid route-reconstruction.gltf'); }
if (fail.length) { console.error(fail.join('\n')); process.exit(1); }
console.log(`historical-lint: ${data.sources.length} sources, ${data.scenes.length} core scenes + ${act.scenes.length} Act III packets, ${data.dialogue.length} dialogue lines, ${claims.claims.length} claims, ${voices.voices.length} voice sheets, ${assets.assets.length} assets, exactly ${data.endings.length} endings — PASS`);
