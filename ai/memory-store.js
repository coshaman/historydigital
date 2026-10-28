const ALLOWED_KINDS = new Set(['STANCE', 'PROMISE', 'QUESTION', 'RELATIONSHIP_MOMENT']);
const ALLOWED_SALIENCE = new Set(['LOW', 'MEDIUM', 'HIGH']);
const SALIENCE_WEIGHT = { LOW: 1, MEDIUM: 2, HIGH: 3 };

function cleanText(value, limit) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
}

function validateMemoryCandidate(candidate, { scene, turnIndex, playerInput } = {}) {
  if (!candidate || !scene || candidate.subjectId !== 'player' || candidate.sceneId !== scene.id) return null;
  if (!ALLOWED_KINDS.has(candidate.kind) || !ALLOWED_SALIENCE.has(candidate.salience)) return null;
  if (!Array.isArray(scene.cast) || !scene.cast.includes(candidate.characterId) || !['alexei', 'ekaterina', 'pavel'].includes(candidate.characterId)) return null;
  if (!Number.isInteger(turnIndex) || turnIndex < 1) return null;
  const statement = cleanText(playerInput, 180);
  if (!statement) return null;
  return {
    id: `MEM-${scene.id}-${turnIndex}-${candidate.characterId}-${candidate.kind}`,
    subjectId: 'player',
    characterId: candidate.characterId,
    sceneId: scene.id,
    kind: candidate.kind,
    summaryKo: `플레이어는 “${statement}”라고 말했다.`,
    salience: candidate.salience,
    createdTurn: turnIndex,
    source: 'PLAYER_INPUT_SNAPSHOT',
  };
}

function isValidRecord(record, sceneById) {
  if (!record || record.subjectId !== 'player' || !ALLOWED_KINDS.has(record.kind) || !ALLOWED_SALIENCE.has(record.salience)) return false;
  const scene = sceneById.get(record.sceneId);
  return Boolean(scene && scene.cast?.includes(record.characterId) && ['alexei', 'ekaterina', 'pavel'].includes(record.characterId)
    && Number.isInteger(record.createdTurn) && record.createdTurn > 0 && cleanText(record.summaryKo, 180));
}

function addMemoryCandidates(existing, candidates, context) {
  const sceneById = new Map([...(context.scenes ?? []).map(scene => [scene.id, scene]), [context.scene.id, context.scene]]);
  const records = (Array.isArray(existing) ? existing : []).filter(record => isValidRecord(record, sceneById)).map(record => ({ ...record, summaryKo: cleanText(record.summaryKo, 180) }));
  const keys = new Set(records.map(record => `${record.characterId}|${record.kind}|${record.summaryKo}`));
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const record = validateMemoryCandidate(candidate, context);
    if (!record) continue;
    const key = `${record.characterId}|${record.kind}|${record.summaryKo}`;
    if (keys.has(key)) continue;
    keys.add(key);
    records.push(record);
  }
  const limit = Number.isInteger(context.maxMemories) ? Math.max(1, Math.min(context.maxMemories, 40)) : 24;
  return records.sort((a, b) => SALIENCE_WEIGHT[b.salience] - SALIENCE_WEIGHT[a.salience] || b.createdTurn - a.createdTurn).slice(0, limit);
}

function serializeMemories(memories) {
  return JSON.stringify((Array.isArray(memories) ? memories : []).filter(record => record && record.subjectId === 'player').slice(-40));
}

function restoreMemories(serialized, { scenes = [], maxMemories = 24 } = {}) {
  let parsed;
  try { parsed = typeof serialized === 'string' ? JSON.parse(serialized) : serialized; } catch { return []; }
  if (!Array.isArray(parsed)) return [];
  const sceneById = new Map(scenes.map(scene => [scene.id, scene]));
  const valid = parsed.filter(record => isValidRecord(record, sceneById)).map(record => ({
    id: cleanText(record.id, 100), subjectId: 'player', characterId: record.characterId, sceneId: record.sceneId,
    kind: record.kind, summaryKo: cleanText(record.summaryKo, 180), salience: record.salience,
    createdTurn: record.createdTurn, source: 'PLAYER_INPUT_SNAPSHOT',
  })).filter(record => record.id);
  const limit = Number.isInteger(maxMemories) ? Math.max(1, Math.min(maxMemories, 40)) : 24;
  return valid.slice(-limit);
}

exports.addMemoryCandidates = addMemoryCandidates;
exports.restoreMemories = restoreMemories;
exports.serializeMemories = serializeMemories;
exports.validateMemoryCandidate = validateMemoryCandidate;
