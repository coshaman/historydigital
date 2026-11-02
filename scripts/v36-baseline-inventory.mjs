import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const out = path.join(root, 'docs', 'v36', 'current-audit');
const git = (...args) => execFileSync('git', ['-c', `safe.directory=${root.replaceAll('\\', '/')}`, ...args], { cwd: root, encoding: 'utf8' }).trim();
const json = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = (headers, rows) => [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n') + '\n';
const files = async (dir, extension = '.json') => (await readdir(path.join(root, dir), { withFileTypes: true }))
  .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(extension))
  .map(entry => path.join(dir, entry.name).replaceAll('\\', '/')).sort();
const normalize = value => typeof value === 'string' ? value.replace(/^"|"$/g, '') : value;
const props = object => Object.fromEntries((object?.properties ?? []).map(item => [item.name, normalize(item.value)]));
const commit = git('rev-parse', 'HEAD');
const branch = git('branch', '--show-current');
const generatedAt = new Date().toISOString();
await mkdir(out, { recursive: true });

const characterFiles = await files('rpg/characters');
const characters = await Promise.all(characterFiles.map(json));
const questFiles = await files('rpg/quests');
const quests = await Promise.all(questFiles.map(json));
const mapFiles = await files('rpg/maps');
const maps = await Promise.all(mapFiles.map(json));
const questHostIds = new Map(characters.map(person => [person.id, []]));
for (const quest of quests) for (const action of quest.actions ?? []) for (const hostId of action.hostIds ?? []) questHostIds.get(hostId)?.push(quest.id);

const npcRows = characters.map(person => {
  const id = person.id;
  const classification = id.startsWith('literary_') ? 'LITERARY_REALM_CHARACTER'
    : id.endsWith('_reconstruction') ? 'HISTORICAL_RECONSTRUCTION'
      : 'FICTIONAL_CITY_CITIZEN';
  const playableInClient = (person.kind === 'FICTIONAL' || classification === 'LITERARY_REALM_CHARACTER') && !classification.includes('RECONSTRUCTION');
  const schedule = person.schedule ?? [];
  return [id, classification, person.kind, person.displayNameKo, person.occupation, person.socialEstate,
    person.start?.mapId, (person.allowedMaps ?? []).join('|'), schedule.length,
    [...new Set(schedule.map(item => item.mapId))].join('|'), person.personalObjective,
    [...new Set(questHostIds.get(id) ?? [])].join('|'), playableInClient ? 'catalogued; runtime possession still requires live reachability' : 'restricted/reconstruction; verify route-specific constraints',
    (person.sourceIds ?? []).join('|'), person.sprite?.file ?? person.spriteAtlas?.file ?? '', person.portrait?.file ?? ''];
});
await writeFile(path.join(out, 'NPC_ROSTER_AUDIT.csv'), csv(
  ['id','baseline_class','kind','name_ko','occupation','social_estate','start_map','allowed_maps','schedule_entries','scheduled_map_ids','personal_objective','quest_action_coverage','possession_baseline','source_ids','sprite_path','portrait_path'], npcRows), 'utf8');

const mapRows = maps.map(map => {
  const interactions = map.layers?.find(item => item.name === 'Interactions')?.objects ?? [];
  const exits = interactions.filter(item => item.type === 'map-exit').map(item => {
    const data = props(item);
    return { objectId: item.id, label: item.name, targetMapId: data.targetMapId ?? null, exitId: data.exitId ?? null,
      arrival: data.arrivalX != null && data.arrivalY != null ? { x: Number(data.arrivalX), y: Number(data.arrivalY) } : null,
      requiredHostId: data.requiredHostId ?? null, publicAccess: data.publicAccess ?? null };
  });
  return { mapId: map.mapId, nameKo: map.metadata?.displayNameKo ?? map.mapId, mapClass: map.metadata?.mapClass ?? 'UNCLASSIFIED',
    width: map.width, height: map.height, geography: map.metadata?.geography ?? '', date: map.metadata?.date ?? null,
    sourceIds: map.metadata?.sourceIds ?? [], interactionObjects: interactions.length, mapExits: exits };
});
const mapIdSet = new Set(mapRows.map(map => map.mapId));
for (const map of mapRows) map.mapExits = map.mapExits.map(exit => ({ ...exit, targetExists: mapIdSet.has(exit.targetMapId) }));
const cityMaps = mapRows.filter(map => map.mapClass !== 'LITERARY_REALM');
const interiorCandidates = cityMaps.filter(map => /interior|room|office|shop|station|house/i.test(map.geography)).map(map => map.mapId);
await writeFile(path.join(out, 'MAP_GRAPH_AUDIT.json'), JSON.stringify({ auditedHead: commit, generatedAt,
  summary: { totalMaps: mapRows.length, cityAndReconstructionMaps: cityMaps.length,
    literaryMapsSeparate: mapRows.length - cityMaps.length, knownInteriorCandidatesByMetadata: interiorCandidates,
    totalInteractionObjects: mapRows.reduce((sum, map) => sum + map.interactionObjects, 0),
    nonExitInteractionCandidates: mapRows.reduce((sum, map) => sum + map.interactionObjects - map.mapExits.length, 0),
    totalMapExitObjects: mapRows.reduce((sum, map) => sum + map.mapExits.length, 0),
    missingTargets: mapRows.flatMap(map => map.mapExits.filter(exit => !exit.targetExists).map(exit => `${map.mapId}:${exit.objectId}->${exit.targetMapId}`)) }, maps: mapRows }, null, 2) + '\n', 'utf8');

const provenance = await json('rpg/assets/ASSET_PROVENANCE.json');
const provenanceByPath = new Map((provenance.assets ?? []).map(asset => [asset.path.replaceAll('\\', '/'), asset]));
const assetFiles = [];
async function walkAssets(dir) {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) await walkAssets(relative);
    else assetFiles.push(relative);
  }
}
await walkAssets('rpg/assets');
assetFiles.sort();
const assetRows = await Promise.all(assetFiles.map(async file => {
  const bytes = await readFile(path.join(root, file));
  const record = provenanceByPath.get(file);
  let dimensions = '';
  if (file.endsWith('.png') && bytes.length >= 24) dimensions = `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
  else if (file.endsWith('.svg')) {
    const markup = bytes.toString('utf8', 0, Math.min(bytes.length, 2000));
    const viewBox = markup.match(/viewBox=["']([^"']+)["']/i)?.[1];
    const width = markup.match(/\bwidth=["']([^"']+)["']/i)?.[1] ?? '';
    const height = markup.match(/\bheight=["']([^"']+)["']/i)?.[1] ?? '';
    dimensions = viewBox || `${width}x${height}`;
  }
  return [record?.id ?? path.basename(file, path.extname(file)), file, bytes.length, dimensions,
    record?.type ?? 'NO_PROVENANCE_RECORD', record?.generatedBy ?? '', record?.license ?? 'UNRECORDED',
    (record?.sourceIds ?? []).join('|'), (record?.sourceUrls ?? []).join('|'), record?.historicalConfidence ?? 'UNRECORDED', record?.notes ?? ''];
}));
await writeFile(path.join(out, 'ASSET_AUDIT.csv'), csv(
  ['asset_id','path','bytes','dimensions','asset_type','generated_by','license','source_ids','source_urls','historical_confidence','notes'], assetRows), 'utf8');

const questRows = [];
for (const quest of quests) questRows.push([quest.id, 'campaign_or_case', quest.chapterId ?? '', quest.date ?? '', quest.titleKo ?? '',
  quest.actions?.length ?? 0, [...new Set((quest.actions ?? []).flatMap(action => action.hostIds ?? []))].join('|'),
  [...new Set((quest.actions ?? []).flatMap(action => action.sourceIds ?? []))].join('|'), quest.historicalOutcome?.id ?? '', quest.historicalOutcome?.value ?? '']);
const discussion = await json('rpg/data/discussion-quests.json');
const districts = await json('rpg/data/city-districts-v36.json');
for (const quest of discussion.quests ?? []) questRows.push([quest.id, 'opinion_or_perspective', '', quest.date ?? '', quest.titleKo ?? '',
  Object.keys(quest.hosts ?? {}).length, Object.keys(quest.hosts ?? {}).join('|'), (quest.sourceIds ?? []).join('|'), '', '']);
await writeFile(path.join(out, 'QUEST_AUDIT.csv'), csv(
  ['quest_id','baseline_type','chapter_id','available_date','title_ko','action_or_host_count','host_ids','source_ids','immutable_outcome_id','historical_outcome'], questRows), 'utf8');

const baseline = { auditedHead: commit, branch, generatedAt, workingTreeStatus: git('status', '--porcelain'),
  counts: { characterRecords: characters.length, fictionalCityCitizens: npcRows.filter(row => row[1] === 'FICTIONAL_CITY_CITIZEN').length,
    literaryCharacters: npcRows.filter(row => row[1] === 'LITERARY_REALM_CHARACTER').length,
    historicalReconstructions: npcRows.filter(row => row[1] === 'HISTORICAL_RECONSTRUCTION').length,
    mapRecords: maps.length, cityAndReconstructionMaps: cityMaps.length, questRecords: questRows.length,
    personalOrCaseQuestFiles: quests.length, opinionQuestRecords: (discussion.quests ?? []).length, assetFiles: assetFiles.length,
    registeredGameplayDistricts: (districts.districts ?? []).length,
    playableDistricts: (districts.districts ?? []).filter(district => district.prototypeStatus === 'PHASE_1_PLAYABLE_PROTOTYPE').length,
    currentCityNonExitInteractionObjects: cityMaps.reduce((sum, map) => sum + map.interactionObjects - map.mapExits.length, 0),
    distinctProvenanceAssetTypes: new Set((provenance.assets ?? []).map(asset => asset.type)).size },
  rosterGaps: { scheduleUnderFour: characters.filter(person => person.kind === 'FICTIONAL' && !person.id.startsWith('literary_') && (person.schedule ?? []).length < 4).map(person => person.id),
    residentsWithTwoAuthoredActorRelations: characters.filter(person => person.kind === 'FICTIONAL' && !person.id.startsWith('literary_') && Object.keys(person.relations ?? {}).length >= 2).length,
    residentsWithExplicitNeedsProfile: characters.filter(person => person.kind === 'FICTIONAL' && !person.id.startsWith('literary_') && Boolean(person.needs)).length,
    residentsWithFourExplicitTodayGoals: characters.filter(person => person.kind === 'FICTIONAL' && !person.id.startsWith('literary_') && (person.todayGoals ?? []).length >= 4).length,
    residentsWithPersonalObjective: characters.filter(person => person.kind === 'FICTIONAL' && !person.id.startsWith('literary_') && Boolean(person.personalObjective)).length },
  questGaps: { threeStagePersonalQuestRecords: quests.filter(quest => quest.lifeChain?.stageCount >= 3).length,
    uniqueAuthoredLifeChains: new Set(quests.map(quest => quest.lifeChain?.id).filter(Boolean)).size,
    threeStagePersonalQuestChains: new Set(quests.filter(quest => quest.lifeChain?.stageCount >= 3).map(quest => quest.lifeChain.id)).size },
  knownConstraints: ['The 36 fictional city residents exist as active cards, but route-specific possession is not proven by the roster count.',
    'NPC movement is schedule-led with an initial needs-driven layer: hunger meals and fatigue-triggered rest for the first six residents, plus authored delivery/trade target tracking. Income, safety, social goals, and competing-goal planning remain incomplete.',
    'The current city prototype connects three gameplay districts and has three usable interiors, below the V36 targets of six and eight.',
    'The cohort has 26 primarily single-choice work quests and one six-stage life chain; it does not meet the 30 three-stage personal quest or 10 social-chain targets.',
    'Maps are stylized and not georeferenced; cited records contextualize them but do not prove survey-grade in-game coordinates.',
    'Local live-provider smoke exercises the same Vercel handler but does not verify the deployed production environment or its environment variables.'] };
await writeFile(path.join(out, 'HEAD_AUDIT.json'), JSON.stringify(baseline, null, 2) + '\n', 'utf8');

await writeFile(path.join(out, 'API_AUDIT.md'), `# API audit — current V36 checkpoint\n\nAudited HEAD: \`${commit}\` (${branch})\n\n- Deployment contract: Vercel same-origin functions; no Cloudflare worker or external client-side key.\n- Runtime routes: \`/api/rpg/health\`, \`/api/rpg/session/start\`, \`/api/rpg/dialogue\`.\n- Secret configuration name: \`OPENAI_API_KEY\` (value intentionally not recorded); optional \`OPENAI_DIALOGUE_MODEL\`.\n- Dialogue uses a server-created, signed session and validated model response. NPC simulation must not call the LLM.\n- Regression coverage includes generated turns, missing-key fallback, provider 429/5xx/timeout, incomplete-output cause, invalid response rejection, session recovery, and authoritative-state protection.\n- On 2026-11-03, the actual Vercel function handler was exercised locally with the private `.env.local` key: session creation returned `AI`; the Responses API returned two generated beats with `fallback: false` at a 700-token ceiling. No key or generated text is recorded.\n- Vercel production deployment and environment settings remain unverified; health confirms key presence only, while a successful dialogue request is the generation check.\n`, 'utf8');

console.log(JSON.stringify({ status: 'AUDITED', auditedHead: commit, output: path.relative(root, out).replaceAll('\\', '/'), counts: baseline.counts, constraints: baseline.knownConstraints }, null, 2));
