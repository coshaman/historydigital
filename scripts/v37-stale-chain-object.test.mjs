import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveObjectQuest } from '../rpg/engine/quest-presentation.mjs';

const { quests } = JSON.parse(await readFile(new URL('../rpg/quests/resident-arcs-v36.json', import.meta.url), 'utf8'));
test('a static Matryona stall marker advances to the next unresolved personal stage', () => {
  const state = { player: { embodiment: 'street_vendor_matryona' }, quests: {
    MATRYONA_STREET_STALL_1847_STAGE_1: { status: 'resolved' },
    MATRYONA_STREET_STALL_1847_STAGE_2: { status: 'available' },
  } };
  assert.equal(resolveObjectQuest('MATRYONA_STREET_STALL_1847_STAGE_1', state, quests).id,
    'MATRYONA_STREET_STALL_1847_STAGE_2');
});
