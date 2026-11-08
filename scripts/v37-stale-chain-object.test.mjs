import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveObjectQuest } from '../rpg/engine/quest-presentation.mjs';

const { quests } = JSON.parse(await readFile(new URL('../rpg/quests/resident-arcs-v36.json', import.meta.url), 'utf8'));
const marker = JSON.parse(await readFile(new URL('../rpg/quests/street-vendor-weather-1847.json', import.meta.url), 'utf8'));
const combined = [...quests, marker];
test('the completed Matryona weather marker opens her first unfinished stall-life stage', () => {
  const state = { player: { embodiment: 'street_vendor_matryona' }, quests: {
    STREET_VENDOR_WEATHER_1847: { status: 'resolved' },
  } };
  assert.equal(resolveObjectQuest('STREET_VENDOR_WEATHER_1847', state, combined).id,
    'MATRYONA_STREET_STALL_1847_STAGE_1');
});
test('the static Matryona weather marker advances to her next unresolved personal stage', () => {
  const state = { player: { embodiment: 'street_vendor_matryona' }, quests: {
    STREET_VENDOR_WEATHER_1847: { status: 'resolved' },
    MATRYONA_STREET_STALL_1847_STAGE_1: { status: 'resolved' },
    MATRYONA_STREET_STALL_1847_STAGE_2: { status: 'available' },
  } };
  assert.equal(resolveObjectQuest('STREET_VENDOR_WEATHER_1847', state, combined).id,
    'MATRYONA_STREET_STALL_1847_STAGE_2');
});
