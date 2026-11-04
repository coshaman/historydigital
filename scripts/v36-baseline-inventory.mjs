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
const assetUsageLines = (await readFile(path.join(root, 'rpg/assets/ASSET_USAGE_V36.csv'), 'utf8')).trim().split(/\r?\n/);
const declaredAtlasGids = new Set(assetUsageLines.slice(1).map(line => Number(line.match(/^"(\d+)"/)?.[1])).filter(Number.isInteger));
if (!declaredAtlasGids.size) throw new Error('V36 asset usage ledger contains no numeric tile GIDs.');
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
const districts = await json('rpg/data/city-districts-v36.json');
const mapIdSet = new Set(mapRows.map(map => map.mapId));
for (const map of mapRows) map.mapExits = map.mapExits.map(exit => ({ ...exit, targetExists: mapIdSet.has(exit.targetMapId) }));
const cityMaps = mapRows.filter(map => map.mapClass !== 'LITERARY_REALM');
const interiorCandidates = cityMaps.filter(map => /interior|room|office|shop|station|house/i.test(map.geography)).map(map => map.mapId);
const districtMapIds = new Set((districts.districts ?? []).flatMap(district => district.mapIds ?? []));
const playableDistricts = (districts.districts ?? []).filter(district => /PLAYABLE/.test(district.prototypeStatus ?? '')
  && district.mapIds?.length && district.mapIds.every(id => mapIdSet.has(id))
  && (district.connections ?? []).length > 0);
const registeredInteriorIds = new Set((districts.districts ?? []).flatMap(district => district.interiorMapIds ?? []));
const enterableInteriors = [...registeredInteriorIds].filter(id => {
  const map = maps.find(item => item.mapId === id);
  return Boolean(map?.metadata?.access && mapRows.find(row => row.mapId === id)?.mapExits.some(exit => exit.targetExists));
});
const usedAtlasGids = new Set();
const unresolvedAtlasGids = new Set();
for (const map of maps.filter(item => item.metadata?.mapClass !== 'LITERARY_REALM')) {
  for (const layer of map.layers?.filter(item => item.type === 'tilelayer') ?? []) for (const gid of layer.data ?? []) if (gid > 0) {
    if (declaredAtlasGids.has(gid)) usedAtlasGids.add(gid);
    else unresolvedAtlasGids.add(gid);
  }
  for (const object of map.layers?.find(item => item.name === 'Interactions')?.objects ?? []) {
    const gid = Number(props(object).assetTileId);
    if (Number.isInteger(gid) && gid > 0) {
      if (declaredAtlasGids.has(gid)) usedAtlasGids.add(gid);
      else unresolvedAtlasGids.add(gid);
    }
  }
}
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
const visualAssetExtensions = new Set(['.png', '.svg', '.jpg', '.jpeg', '.webp', '.gif']);
async function walkAssets(dir) {
  for (const entry of await readdir(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name).replaceAll('\\', '/');
    if (entry.isDirectory()) await walkAssets(relative);
    else if (visualAssetExtensions.has(path.extname(entry.name).toLowerCase())) assetFiles.push(relative);
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
for (const quest of discussion.quests ?? []) questRows.push([quest.id, 'opinion_or_perspective', '', quest.date ?? '', quest.titleKo ?? '',
  Object.keys(quest.hosts ?? {}).length, Object.keys(quest.hosts ?? {}).join('|'), (quest.sourceIds ?? []).join('|'), '', '']);
const meaningfulCityInteractions = maps.filter(map => map.metadata?.mapClass !== 'LITERARY_REALM').reduce((count, map) => count + (map.layers?.find(layer => layer.name === 'Interactions')?.objects ?? []).filter(object => {
  const properties = Object.fromEntries((object.properties ?? []).map(property => [property.name, property.value]));
  if (object.type === 'quest-object') return quests.some(quest => quest.id === properties.questId);
  if (object.type === 'inspectable') return typeof properties.storyTextKo === 'string' && properties.storyTextKo.trim().length >= 24;
  if (object.type === 'source') return typeof properties.sourceId === 'string' && properties.sourceId.length > 0;
  if (object.type === 'clue') return typeof properties.evidenceId === 'string' && properties.evidenceId.length > 0;
  return Boolean(properties.serviceId || properties.interactionId);
}).length, 0);
await writeFile(path.join(out, 'QUEST_AUDIT.csv'), csv(
  ['quest_id','baseline_type','chapter_id','available_date','title_ko','action_or_host_count','host_ids','source_ids','immutable_outcome_id','historical_outcome'], questRows), 'utf8');

const baseline = { auditedHead: commit, branch, generatedAt, workingTreeStatus: git('status', '--porcelain'),
  counts: { characterRecords: characters.length, fictionalCityCitizens: npcRows.filter(row => row[1] === 'FICTIONAL_CITY_CITIZEN').length,
    literaryCharacters: npcRows.filter(row => row[1] === 'LITERARY_REALM_CHARACTER').length,
    historicalReconstructions: npcRows.filter(row => row[1] === 'HISTORICAL_RECONSTRUCTION').length,
    mapRecords: maps.length, cityAndReconstructionMaps: cityMaps.length, questRecords: questRows.length,
    personalOrCaseQuestFiles: quests.length, opinionQuestRecords: (discussion.quests ?? []).length, assetFiles: assetFiles.length,
    registeredGameplayDistricts: (districts.districts ?? []).length,
    playableDistricts: playableDistricts.length,
    registeredInteriors: registeredInteriorIds.size,
    physicallyEnterableRegisteredInteriors: enterableInteriors.length,
    environmentAtlasTilesDeclared: declaredAtlasGids.size,
    environmentAtlasTilesMinimum: 60,
    distinctEnvironmentAtlasTilesUsed: usedAtlasGids.size,
    environmentTileUsageLedgerEntries: assetUsageLines.length - 1,
    unresolvedEnvironmentAtlasGids: [...unresolvedAtlasGids].sort((a, b) => a - b),
    currentCityNonExitInteractionObjects: cityMaps.reduce((sum, map) => sum + map.interactionObjects - map.mapExits.length, 0),
    currentCityMeaningfulInteractions: meaningfulCityInteractions,
    visualAssetsAudited: assetRows.length,
    distinctProvenanceAssetTypes: new Set((provenance.assets ?? []).map(asset => asset.type)).size,
    districtRegistryCoversAllCityMaps: [...districtMapIds].filter(id => mapIdSet.has(id)).length === cityMaps.length },
  rosterGaps: { scheduleUnderFour: characters.filter(person => person.kind === 'FICTIONAL' && !person.id.startsWith('literary_') && (person.schedule ?? []).length < 4).map(person => person.id),
    residentsWithTwoAuthoredActorRelations: characters.filter(person => person.kind === 'FICTIONAL' && !person.id.startsWith('literary_') && Object.keys(person.relations ?? {}).length >= 2).length,
    residentsWithExplicitNeedsProfile: characters.filter(person => person.kind === 'FICTIONAL' && !person.id.startsWith('literary_') && Boolean(person.needs)).length,
    residentsWithFourExplicitTodayGoals: characters.filter(person => person.kind === 'FICTIONAL' && !person.id.startsWith('literary_') && (person.todayGoals ?? []).length >= 4).length,
    residentsWithPersonalObjective: characters.filter(person => person.kind === 'FICTIONAL' && !person.id.startsWith('literary_') && Boolean(person.personalObjective)).length },
  questGaps: { threeStagePersonalQuestRecords: quests.filter(quest => quest.lifeChain?.stageCount >= 3 && quest.lifeChain.kind !== 'SOCIAL').length,
    uniqueAuthoredLifeChains: new Set(quests.map(quest => quest.lifeChain?.id).filter(Boolean)).size,
    threeStagePersonalQuestChains: new Set(quests.filter(quest => quest.lifeChain?.stageCount >= 3 && quest.lifeChain.kind !== 'SOCIAL').map(quest => quest.lifeChain.id)).size,
    threeStageSocialQuestRecords: quests.filter(quest => quest.socialChain?.stageCount === 3).length,
    uniqueThreeStageSocialChains: new Set(quests.filter(quest => quest.socialChain?.stageCount === 3).map(quest => quest.socialChain.id)).size },
  knownConstraints: [
    `${npcRows.filter(row => row[1] === 'FICTIONAL_CITY_CITIZEN').length} fictional city residents are catalogued; possession must be evidenced by the six route-specific batch tests, not inferred from file count.`,
    `${playableDistricts.length} playable districts are registered and connected; the V36 target is 6.`,
    `${enterableInteriors.length} registered interiors have access metadata and a physical exit; the V36 target is 8.`,
    `${meaningfulCityInteractions} city interactions resolve to a quest, authored inspection, cited source, clue, or service; the V36 threshold is 70.`,
    `${new Set(quests.filter(quest => quest.lifeChain?.stageCount >= 3).map(quest => quest.lifeChain.id)).size} complete resident life chains are registered, including ${new Set(quests.filter(quest => quest.socialChain?.stageCount === 3).map(quest => quest.socialChain.id)).size} three-stage social chains; targets are 30 life chains and 10 social chains.`,
    `${usedAtlasGids.size}/${declaredAtlasGids.size} declared environmental atlas tile GIDs are used in city maps; the V36 minimum is 60 distinct environment assets, and the ledger has ${assetUsageLines.length - 1} rows.`,
    'Map geography remains stylized and not georeferenced; cited records contextualize scenes but do not prove survey-grade in-game coordinates.',
    'One successful Vercel production generation verifies a single request only; it does not establish ongoing availability or cast-wide dialogue quality.',
  ] };
await writeFile(path.join(out, 'HEAD_AUDIT.json'), JSON.stringify(baseline, null, 2) + '\n', 'utf8');

const apiAudit = [
  '# API audit — current V36 checkpoint', '',
  `Audited HEAD: ${commit} (${branch})`, '',
  '- Deployment contract: Vercel same-origin functions; no Cloudflare worker or external client-side key.',
  '- Runtime routes: /api/rpg/health, /api/rpg/session/start, and /api/rpg/dialogue.',
  '- Secret configuration name: OPENAI_API_KEY (value intentionally not recorded); optional OPENAI_DIALOGUE_MODEL.',
  '- Dialogue uses a server-created, signed session and validated model response. NPC simulation must not call the LLM.',
  '- Regression coverage includes generated turns, missing-key fallback, provider 429/5xx/timeout, incomplete-output cause, invalid response rejection, session recovery, and authoritative-state protection.',
  '- Real in-game API acceptance is recorded separately in REAL_AI_IN_GAME_ACCEPTANCE.json; generated dialogue text and credentials are excluded from that evidence.',
  '- Live Vercel API status confirmed `OPENAI_API_KEY` configured, and the one-request in-game generation check returned a character answer in the UI. Evidence: `VERCEL_PRODUCTION_AI_SMOKE.json`. This is a single successful generation, not a full voice-quality or reliability evaluation.',
  '- A local `.env.local` smoke received the safe category `network_error`; it did not receive an HTTP response from the provider. The secret value and provider response body are never logged by the smoke.',
  '',
].join('\n');
await writeFile(path.join(out, 'API_AUDIT.md'), apiAudit, 'utf8');

console.log(JSON.stringify({ status: 'AUDITED', auditedHead: commit, output: path.relative(root, out).replaceAll('\\', '/'), counts: baseline.counts, constraints: baseline.knownConstraints }, null, 2));
