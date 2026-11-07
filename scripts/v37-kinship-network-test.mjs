import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const game = globalThis.V33GameState;
const readJson = async url => JSON.parse(await readFile(url, 'utf8'));
const [graph, mapNames, cardNames] = await Promise.all([
  readJson(new URL('../data/v37_fictional_kinship_graph.json', import.meta.url)),
  readdir(new URL('../rpg/maps/', import.meta.url)),
  readdir(new URL('../rpg/characters/', import.meta.url)),
]);
const [maps, cards] = await Promise.all([
  Promise.all(mapNames.filter(name => name.endsWith('.json')).map(name => readJson(new URL(`../rpg/maps/${name}`, import.meta.url))))
    .then(rows => Object.fromEntries(rows.map(map => [map.mapId, map]))),
  Promise.all(cardNames.filter(name => name.endsWith('.json')).map(name => readJson(new URL(`../rpg/characters/${name}`, import.meta.url)))),
]);
const coreResidentIds = new Set(graph.edges.flatMap(edge => [edge.a, edge.b]));
const fictional = cards.filter(card => card.kind === 'FICTIONAL');
const cardById = new Map(cards.map(card => [card.id, card]));
assert.equal(graph.historicalClaim, false);
assert.equal(graph.status, 'FICTIONAL_CHARACTER_DESIGN');
assert.equal(fictional.length, 37, 'the runtime population includes the street musician');
assert.ok(graph.edges.length > 18, 'the family graph includes extended relatives beyond isolated pairs');
assert.equal(coreResidentIds.size, fictional.length, 'every fictional resident has a family edge');
assert.deepEqual([...coreResidentIds].sort(), fictional.map(card => card.id).sort(), 'kinship covers the full runtime population');
const kinshipDegree = new Map();
for (const edge of graph.edges) for (const id of [edge.a, edge.b]) kinshipDegree.set(id, (kinshipDegree.get(id) ?? 0) + 1);
assert.ok([...kinshipDegree.values()].some(degree => degree > 1), 'at least one resident has multiple autonomous family ties');
assert.equal(kinshipDegree.get('tenant_mikhail'), 2, 'Mikhail has both a sibling and an extended cousin tie');
assert.equal(kinshipDegree.get('laundress_mariya'), 2, 'Mariya has her sister and a cousin in the courtyard network');
assert.equal(kinshipDegree.get('street_musician_ivan'), 1, 'the previously omitted runtime resident now has a family relationship');

for (const edge of graph.edges) {
  const a = cardById.get(edge.a), b = cardById.get(edge.b);
  assert.ok(a && b, `${edge.id} endpoints exist`);
  const aRelation = a.kinshipRelations.find(item => item.targetHostId === b.id);
  const bRelation = b.kinshipRelations.find(item => item.targetHostId === a.id);
  assert.equal(aRelation?.kind, edge.kind);
  assert.equal(bRelation?.kind, edge.kind);
  assert.equal(aRelation?.graphEdgeId, edge.id);
  assert.equal(bRelation?.graphEdgeId, edge.id);
  assert.equal(aRelation?.status, 'FICTIONAL_CHARACTER_DESIGN');
  assert.equal(bRelation?.status, 'FICTIONAL_CHARACTER_DESIGN');
  if (edge.aRelationshipKo) assert.equal(aRelation.relationshipKo, edge.aRelationshipKo, `${edge.id}: authored Korean relation for ${edge.a}`);
  if (edge.bRelationshipKo) assert.equal(bRelation.relationshipKo, edge.bRelationshipKo, `${edge.id}: authored Korean relation for ${edge.b}`);
}

const state = game.createInitialState({ maps, hostCards: cards, startMapId: 'nevsky' });
for (const edge of graph.edges) {
  for (const [source, target] of [[edge.a, edge.b], [edge.b, edge.a]]) {
    const relation = state.hosts[source].relationshipEdges.find(row => row.kind === 'KINSHIP' && row.toHostId === target);
    assert.ok(relation, `${source} knows their authored family relation`);
    assert.deepEqual(relation.knownByHostIds, [source], 'family knowledge is scoped to the person who knows it');
    assert.equal(relation.status, 'FICTIONAL_CHARACTER_DESIGN');
    assert.equal(Object.hasOwn(relation, 'privateKnowledgeIds'), false, 'private knowledge is not copied onto relationship edges');
  }
}

const [family] = graph.edges.filter(edge => edge.a === 'clerk_alexei' && edge.b === 'minor_noble_andrei');
const alexei = state.hosts[family.a], andrei = state.hosts[family.b];
const sharedMap = alexei.allowedMaps.find(mapId => andrei.allowedMaps.includes(mapId) && maps[mapId]);
assert.ok(sharedMap, 'test pair has an accessible shared map');
for (const person of [alexei, andrei]) {
  person.mapId = sharedMap;
  person.position = { x: 6, y: 6 };
  person.schedule = [{ atMinute: 0, mapId: sharedMap, position: { x: 6, y: 6 }, activityKo: '자유 시간' }];
  person.needs.socialNeed = 100;
  person.needs.fatigue = 0;
  person.lastPersonalContactTaskId = null;
  person.activeGoal = null;
}
state.world.currentMapId = sharedMap;
state.world.clockMinutes = 600;
state.world.date = '1847-06-01';
const advanced = game.advanceNpcWorld(state, 1, maps);
const sim = advanced.ledger.findLast(row => row.eventType === 'NPC_SIMULATION');
const contact = sim?.personalContacts.find(row => [row.hostId, row.partnerHostId].includes(family.a)
  && [row.hostId, row.partnerHostId].includes(family.b));
assert.ok(contact, 'a socially isolated resident makes contact with family during world simulation');
assert.equal(contact.goalId, `KINSHIP:${contact.hostId}:${contact.partnerHostId}:DAY_0`);
assert.equal(contact.effect, 'social_need_relieved');
assert.equal(advanced.hosts[contact.hostId].relationshipMemory[contact.partnerHostId].meetingCount, 1);
assert.ok(advanced.hosts[contact.partnerHostId].relationshipMemory[contact.hostId], 'meeting memory is reciprocal');

const restored = game.loadGame(game.saveGame(advanced), { maps, hostCards: cards });
for (const id of [family.a, family.b]) {
  assert.deepEqual(restored.hosts[id].relationshipEdges, advanced.hosts[id].relationshipEdges);
  assert.deepEqual(restored.hosts[id].relationshipMemory, advanced.hosts[id].relationshipMemory);
}
for (const endpoint of [family.a, family.b]) {
  assert.ok(restored.hosts[endpoint].relationshipEdges.some(row => row.kind === 'KINSHIP'));
}

const extendedFamilyState = game.createInitialState({ maps, hostCards: cards, startMapId: 'courtyard' });
extendedFamilyState.world.currentMapId = 'courtyard';
extendedFamilyState.world.clockMinutes = 600;
extendedFamilyState.world.date = '1847-06-01';
for (const person of Object.values(extendedFamilyState.hosts)) person.historicalAliveAndPresent = false;
const cousin = extendedFamilyState.hosts.tenant_mikhail, relative = extendedFamilyState.hosts.laundress_mariya;
for (const [person, position] of [[cousin, { x: 11, y: 13 }], [relative, { x: 12, y: 13 }]]) {
  person.historicalAliveAndPresent = true;
  person.mapId = 'courtyard';
  person.position = position;
  person.schedule = [{ atMinute: 0, mapId: 'courtyard', position: { ...position }, activityKo: '안뜰에서 잠시 쉰다' }];
  person.needs.socialNeed = 100;
  person.needs.fatigue = 0;
  person.lastPersonalContactTaskId = null;
  person.activeGoal = null;
  person.personalGoals = [];
}
const extendedVisit = game.advanceNpcWorld(extendedFamilyState, 1, maps);
const extendedContact = extendedVisit.ledger.findLast(row => row.eventType === 'NPC_SIMULATION')?.personalContacts
  .find(row => [row.hostId, row.partnerHostId].includes(cousin.id) && [row.hostId, row.partnerHostId].includes(relative.id));
assert.ok(extendedContact, 'the expanded kinship edge drives an autonomous visit between working relatives');
assert.equal(extendedContact.effect, 'social_need_relieved');

console.log(JSON.stringify({ status: 'PASS', fictionalResidents: fictional.length, reciprocalKinshipEdges: graph.edges.length,
  scopedKnowledge: true, autonomousVisit: contact.goalId, extendedRelativeVisit: extendedContact.goalId,
  reciprocalMeetingMemory: true, saveLoad: true }, null, 2));
