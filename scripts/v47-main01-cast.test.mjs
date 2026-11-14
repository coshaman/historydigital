import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { v47StoryBeats } from '../rpg/data/v47-story-beats.mjs';
import { v47RoleProfiles } from '../rpg/data/v47-character-roles.mjs';

const readJson = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

test('MAIN01 keeps the fictional salon patron distinct from the existing editor', async () => {
  const [salon, card, provenance] = await Promise.all([
    readJson('rpg/maps/sofiya-salon.json'),
    readJson('rpg/characters/sofiya_salon_1848.json'),
    readJson('rpg/assets/ASSET_PROVENANCE.json'),
  ]);
  const beat = v47StoryBeats.find(item => item.id === 'V47_MAIN01_A10');
  assert.equal(card.id, 'sofiya_salon_1848');
  assert.equal(card.kind, 'FICTIONAL');
  assert.notEqual(card.id, 'editor_sofia');
  assert.equal(card.start.mapId, 'sofiya-salon');
  assert.ok(card.allowedMaps.includes('sofiya-salon'));
  assert.ok(beat.metadata.playerHosts.includes('sofiya_salon_1848'));
  assert.ok(beat.actions.every(choice => choice.hostIds.includes('sofiya_salon_1848')));
  assert.equal(beat.mapId, 'sofiya-salon');
  assert.equal(salon.metadata.mapClass, 'FICTIONAL_STYLIZED_INTERIOR');
  assert.match(salon.metadata.geography, /허구/);
  assert.equal(v47RoleProfiles.sofiya_salon_1848.layer, 'FICTIONAL_1840S');
  assert.ok(salon.layers.find(layer => layer.name === 'Interactions').objects.some(object => object.type === 'map-exit'));
  const storyById = new Map(v47StoryBeats.map(item => [item.id, item]));
  assert.equal(storyById.get('V47_MAIN01_A05').metadata.playerHosts.includes('panaeva_1848'), false);
  assert.equal(storyById.get('V47_MAIN01_A05').dialogue?.some(line => line.speakerKo.includes('아브도티야')), false,
    'the absent author is not assigned dialogue in the office scene');
  assert.equal(storyById.get('V47_MAIN01_A10').actions[0].effects.v47WorldChange.moves.some(move => move.hostId === 'panaeva_1848'), false,
    'fictional salon choices do not assert that Panaeva visited the fictional house');
  for (const asset of provenance.assets.filter(item => item.intendedScene?.includes('sofiya-salon · MAIN01'))) {
    const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex').toUpperCase(), asset.sha256, `${asset.path} provenance checksum`);
  }
});

test('MAIN01 author voices are distinct and stay within the almanac work', async () => {
  const [panaeva, panaev] = await Promise.all([
    readJson('rpg/characters/panaeva_1848.json'),
    readJson('rpg/characters/panaev_1848.json'),
  ]);
  for (const profile of [panaeva, panaev]) {
    assert.ok(profile.voiceSamples.length >= 3);
    assert.doesNotMatch(JSON.stringify(profile.voiceSamples), /물은 어디서|깨끗한 천|환자 곁/);
    assert.match(profile.v47DialogueContext.voiceKo, /창작 말투/);
  }
  assert.notDeepEqual(panaeva.voiceSamples, panaev.voiceSamples);
  assert.match(panaeva.voiceSamples.join(' '), /인물|장면|이름/);
  assert.match(panaev.voiceSamples.join(' '), /인쇄|판매처|부수/);
});
