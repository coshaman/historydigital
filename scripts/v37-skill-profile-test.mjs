import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const readJson = async url => JSON.parse(await readFile(url, 'utf8'));
const characterFiles = (await readdir(new URL('../rpg/characters/', import.meta.url))).filter(file => file.endsWith('.json'));
const cards = await Promise.all(characterFiles.map(file => readJson(new URL(`../rpg/characters/${file}`, import.meta.url))));
const residents = cards.filter(card => card.kind === 'FICTIONAL');
assert.ok(residents.length >= 36);
const skillNames = new Set();
for (const card of residents) {
  assert.equal(card.skillsValueStatus, 'FICTIONAL_CHARACTER_DESIGN', `${card.id} skill profile provenance`);
  assert.ok(card.skills && Object.keys(card.skills).length >= 2, `${card.id} needs distinct occupational capabilities`);
  for (const [skill, level] of Object.entries(card.skills)) {
    assert.match(skill, /^[a-z][A-Za-z0-9]{0,39}$/);
    assert.ok(Number.isInteger(level) && level >= 0 && level <= 5, `${card.id}.${skill} must be a 0–5 gameplay value`);
    skillNames.add(skill);
  }
}
assert.ok(skillNames.size >= 30, `resident professions need differentiated capabilities, found ${skillNames.size}`);

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const maps = Object.fromEntries(await Promise.all((await readdir(new URL('../rpg/maps/', import.meta.url)))
  .filter(file => file.endsWith('.json')).map(async file => {
    const map = await readJson(new URL(`../rpg/maps/${file}`, import.meta.url));
    return [map.mapId, map];
  })));
const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'courtyard' });
for (const card of residents) assert.deepEqual(state.hosts[card.id].skills, card.skills, `${card.id} skills are available to runtime`);
const reloaded = game.loadGame(game.saveGame(state), { maps, hostCards: cards });
for (const id of ['clerk_alexei', 'printer_ekaterina', 'street_musician_ivan']) {
  assert.deepEqual(reloaded.hosts[id].skills, state.hosts[id].skills, `${id} skills survive save/load`);
}
const workFatigueAfter = skillLevel => {
  const workerState = game.createInitialState({ maps, hostCards: cards, startMapId: 'courtyard' });
  for (const resident of Object.values(workerState.hosts)) resident.historicalAliveAndPresent = false;
  const worker = workerState.hosts.printer_ekaterina;
  worker.historicalAliveAndPresent = true;
  worker.mapId = 'printshop'; worker.position = { x: 11, y: 13 }; worker.needs.fatigue = 40;
  if (skillLevel === 0) for (const skill of Object.keys(worker.skills)) worker.skills[skill] = 0;
  worker.skills.proofReading = skillLevel;
  const result = game.advanceNpcWorld(workerState, 20, maps);
  return { fatigue: result.hosts.printer_ekaterina.needs.fatigue,
    workRecord: result.hosts.printer_ekaterina.workRecords.find(record => record.actionId === 'V36_PRINTER_MARK_PROOF') };
};
const skilledWork = workFatigueAfter(4), unskilledWork = workFatigueAfter(0);
assert.ok(skilledWork.fatigue < unskilledWork.fatigue, 'greater proof-reading skill reduces fatigue during its scheduled work');
assert.deepEqual([skilledWork.workRecord.skillId, skilledWork.workRecord.skillLevel], ['proofReading', 4],
  'completed work records the capability used');
assert.equal(skilledWork.workRecord.effectiveDurationMinutes, 20, 'skill does not change the authored work schedule duration');
assert.equal(unskilledWork.workRecord.effectiveDurationMinutes, 20, 'unskilled work keeps the authored schedule duration');
console.log(JSON.stringify({ status: 'PASS', fictionalResidents: residents.length, distinctSkills: skillNames.size,
  allRuntimeProfiles: true, saveLoadSamples: 3 }, null, 2));
