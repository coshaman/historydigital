const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');

const baseSchema = JSON.parse(readFileSync(resolve(__dirname, '../schemas/ai-scene-turn.schema.json'), 'utf8'));
const memoryKinds = new Set(['STANCE', 'PROMISE', 'QUESTION', 'RELATIONSHIP_MOMENT']);
const characters = new Set(['alexei', 'ekaterina', 'pavel']);

function schemaErrors(value, schema, path = '$') {
  const errors = [];
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [`${path}: expected object`];
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${path}.${key}: required`);
    for (const key of Object.keys(value)) {
      if (schema.additionalProperties === false && !Object.hasOwn(schema.properties ?? {}, key)) errors.push(`${path}.${key}: unknown property`);
      else if (schema.properties?.[key]) errors.push(...schemaErrors(value[key], schema.properties[key], `${path}.${key}`));
    }
    return errors;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) return [`${path}: expected array`];
    if (schema.minItems != null && value.length < schema.minItems) errors.push(`${path}: too few items`);
    if (schema.maxItems != null && value.length > schema.maxItems) errors.push(`${path}: too many items`);
    if (schema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) errors.push(`${path}: duplicate items`);
    value.forEach((item, index) => errors.push(...schemaErrors(item, schema.items ?? {}, `${path}[${index}]`)));
    return errors;
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') return [`${path}: expected string`];
    if (schema.minLength != null && value.length < schema.minLength) errors.push(`${path}: too short`);
    if (schema.maxLength != null && value.length > schema.maxLength) errors.push(`${path}: too long`);
    if (schema.const != null && value !== schema.const) errors.push(`${path}: invalid constant`);
    if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: unsupported value`);
  }
  return errors;
}

function schemaForScene(scene) {
  const schema = structuredClone(baseSchema);
  const sceneId = schema.properties.sceneId;
  sceneId.enum = [scene.id];
  const signalItems = schema.properties.semanticSignals.items;
  signalItems.enum = [...(scene.allowedSignals ?? [])];
  const claimItems = schema.properties.historicalClaimIds.items;
  claimItems.enum = [...(scene.allowedClaimIds ?? [])];
  const background = schema.properties.uiCue.properties.backgroundId;
  background.enum = [...(scene.allowedBackgroundIds ?? [])];
  const expressions = schema.properties.beats.items.properties.expressionId;
  expressions.enum = [...(scene.allowedExpressionIds ?? ['none'])];
  const actions = schema.properties.beats.items.properties.actionId;
  actions.enum = ['NONE', ...(scene.allowedActionIds ?? [])];
  return schema;
}

function validateTurn(value, scene) {
  if (!scene || typeof scene.id !== 'string') return { ok: false, errors: ['scene: missing validated scene card'] };
  const errors = schemaErrors(value, schemaForScene(scene));
  if (value?.sceneId !== scene.id) errors.push('$.sceneId: does not match active scene');
  for (const signal of value?.semanticSignals ?? []) if (!(scene.allowedSignals ?? []).includes(signal)) errors.push(`$.semanticSignals: disallowed ${signal}`);
  for (const claimId of value?.historicalClaimIds ?? []) if (!(scene.allowedClaimIds ?? []).includes(claimId)) errors.push(`$.historicalClaimIds: disallowed ${claimId}`);
  if ((value?.relationshipSignals?.length ?? 0) > 0 && !(scene.allowedSignals ?? []).includes('RELATIONSHIP_WARMTH')) errors.push('$.relationshipSignals: not permitted in this scene');
  for (const beat of value?.beats ?? []) {
    if (beat.speakerId !== 'NARRATION' && !(scene.cast ?? []).includes(beat.speakerId)) errors.push(`$.beats.speakerId: outside active scene cast`);
    if (beat.expressionId !== 'none' && !(scene.allowedExpressionIds ?? []).includes(beat.expressionId)) errors.push(`$.beats.expressionId: disallowed ${beat.expressionId}`);
    if (beat.actionId !== 'NONE' && !(scene.allowedActionIds ?? []).includes(beat.actionId)) errors.push(`$.beats.actionId: disallowed ${beat.actionId}`);
  }
  for (const candidate of value?.memoryCandidates ?? []) {
    if (!characters.has(candidate.characterId) || !memoryKinds.has(candidate.kind)) errors.push('$.memoryCandidates: invalid owner or kind');
    if (candidate.sceneId !== scene.id) errors.push('$.memoryCandidates.sceneId: must match active scene');
  }
  for (const character of value?.relationshipSignals ?? []) if (!characters.has(character.characterId) || !(scene.cast ?? []).includes(character.characterId)) errors.push('$.relationshipSignals: invalid character for active scene');
  return errors.length ? { ok: false, errors: [...new Set(errors)] } : { ok: true, value };
}

function responseFormatForScene(scene) {
  return { type: 'json_schema', name: 'ai_scene_turn_v1', strict: true, schema: schemaForScene(scene) };
}

exports.validateTurn = validateTurn;
exports.responseFormatForScene = responseFormatForScene;
