import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { attachV47StoryObjects, v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { attachV47StoryBeatObjects, toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';
import runtime from '../rpg/engine/v47-main-stories.js';

const { registerStoryBeats } = runtime;
const require = createRequire(import.meta.url);
const game = require('../rpg/engine/game-state.js');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const [mapNames, characterNames] = await Promise.all([readdir('rpg/maps'), readdir('rpg/characters')]);
const [mapRows, hostCards] = await Promise.all([
  Promise.all(mapNames.filter(name => name.endsWith('.json')).map(name => readJson(`rpg/maps/${name}`))),
  Promise.all(characterNames.filter(name => name.endsWith('.json')).map(name => readJson(`rpg/characters/${name}`))),
]);
const maps = Object.fromEntries(mapRows.map(map => [map.mapId, map]));
const beats = toV47StoryQuests();
registerStoryBeats(beats);
attachV47StoryObjects(maps);
attachV47StoryBeatObjects(maps, beats);

const state = game.createInitialState({ maps, hostCards, quests: [...v47StoryQuests, ...beats], startMapId: 'printshop' });
state.world.chapterId = 'V33_1848_PUBLIC';
state.world.date = '1848-06-16';
state.world.clockMinutes = 540;
const participantId = 'watercarrier_luka';
const origin = { mapId: state.hosts[participantId].mapId, position: { ...state.hosts[participantId].position } };
assert.notEqual(origin.mapId, 'market-quay', 'the autonomous participant begins away from the event site');

const opened = game.advanceNpcWorld(state, 1, maps, { pausedHostIds: [state.player.embodiment].filter(Boolean) });
const event = opened.world.v47.events.V47_MAIN05_C01;
assert.ok(event, 'the dated cholera beat opens on the shared world clock');
assert.equal(opened.hosts[participantId].mapId, origin.mapId, 'opening the beat does not teleport its participant');

const travelled = game.advanceNpcWorld(opened, 180, maps, { pausedHostIds: [opened.player.embodiment].filter(Boolean) });
const moves = travelled.ledger.flatMap(row => row.moves ?? []).filter(row => row.hostId === participantId);
assert.ok(moves.length > 0, 'the participant moves through the ordinary NPC pathfinder');
assert.equal(travelled.hosts[participantId].activeGoal.type, 'V47_STORY_GATHERING', 'the story event, not the ordinary work schedule, sends its participant');
assert.ok(moves.some(row => row.toMapId === 'market-quay'), 'the event travel trace records an actual map transition to the market quay');
assert.ok(travelled.world.v47.events.V47_MAIN05_C01.npcAutonomy.assignedHostIds.includes(participantId),
  'the moving resident is an assigned participant in the physical event');

const printshopReading = game.createInitialState({ maps, hostCards, quests: [...v47StoryQuests, ...beats], startMapId: 'printshop' });
printshopReading.world.chapterId = 'V33_1848_PUBLIC';
printshopReading.world.date = '1848-05-18';
printshopReading.world.clockMinutes = 540;
for (const host of Object.values(printshopReading.hosts)) {
  if (host.presenceWindow) host.historicalAliveAndPresent = host.presenceWindow.startDate <= printshopReading.world.date
    && printshopReading.world.date <= host.presenceWindow.endDate;
}
const readingOpened = game.advanceNpcWorld(printshopReading, 1, maps);
const readingParticipant = readingOpened.world.v47.events.V47_MAIN01_A03.npcAutonomy.assignedHostIds[0];
const readingTravel = game.advanceNpcWorld(readingOpened, 1, maps);
assert.equal(readingTravel.hosts[readingParticipant].activeGoal.type, 'V47_STORY_GATHERING',
  `a dated MAIN01 reading takes priority over an unrelated daily routine: ${JSON.stringify({
    event: readingTravel.world.v47.events.V47_MAIN01_A03,
    host: readingTravel.hosts[readingParticipant],
  })}`);
assert.equal(readingTravel.hosts[readingParticipant].activeGoal.targetMapId, 'printshop',
  'the reading participant starts a physical route to the printshop scene');

const arrest = game.createInitialState({ maps, hostCards, quests: [...v47StoryQuests, ...beats], startMapId: 'communal-room' });
arrest.world.chapterId = 'V33_1849_CIRCLE';
arrest.world.date = '1849-05-05';
arrest.world.clockMinutes = 540;
for (const host of Object.values(arrest.hosts)) {
  if (host.presenceWindow) host.historicalAliveAndPresent = host.presenceWindow.startDate <= arrest.world.date
    && arrest.world.date <= host.presenceWindow.endDate;
}
const policeOrigin = { mapId: arrest.hosts.police_sergeant_ivan.mapId, position: { ...arrest.hosts.police_sergeant_ivan.position } };
const studentOrigin = { mapId: arrest.hosts.student_vasily.mapId, position: { ...arrest.hosts.student_vasily.position } };
const historicalDetaineeOrigins = Object.fromEntries(['petrashevsky_1849', 'dostoevsky_1849'].map(id => [id,
  { mapId: arrest.hosts[id].mapId, position: { ...arrest.hosts[id].position } }]));
const arrestOpened = game.advanceNpcWorld(arrest, 1, maps);
assert.deepEqual({ mapId: arrestOpened.hosts.police_sergeant_ivan.mapId, position: arrestOpened.hosts.police_sergeant_ivan.position },
  policeOrigin, 'the arrest event dispatches police from their actual starting point');
assert.deepEqual({ mapId: arrestOpened.hosts.student_vasily.mapId, position: arrestOpened.hosts.student_vasily.position },
  studentOrigin, 'the arrest event does not teleport its fictional witness into custody');
assert.ok(arrestOpened.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.assignedHostIds.includes('police_sergeant_ivan'),
  'the arrest dispatch is recorded as a moving world event');
assert.equal(arrestOpened.hosts.police_sergeant_ivan.v47TravelGoal.targetMapId, 'morskaya-intersection',
  'the police sergeant walks from the station to the actual street operation');
assert.equal(arrestOpened.hosts.junior_guard_sergey.v47TravelGoal?.targetMapId, 'morskaya-intersection',
  'the sergeant is accompanied by a second uniformed guard who physically joins the operation');
assert.equal(arrestOpened.hosts.dostoevsky_1849.v47Assignment.status, 'EN_ROUTE_TO_ARREST_ADDRESS',
  'Dostoevsky is brought to the address named in the arrest order before custody transfer');
assert.equal(arrestOpened.hosts.dostoevsky_1849.v47TravelGoal.targetMapId, 'morskaya-intersection');

const warnedArrest = game.createInitialState({ maps, hostCards, quests: [...v47StoryQuests, ...beats], startMapId: 'communal-room' });
warnedArrest.world.chapterId = 'V33_1849_CIRCLE';
warnedArrest.world.date = '1849-05-05';
warnedArrest.world.clockMinutes = 540;
for (const host of Object.values(warnedArrest.hosts)) {
  if (host.presenceWindow) host.historicalAliveAndPresent = host.presenceWindow.startDate <= warnedArrest.world.date
    && warnedArrest.world.date <= host.presenceWindow.endDate;
}
warnedArrest.world.v47.stories.MAIN03.consequences.push({ actionId: 'V47_P07_WARN_FICTIONAL', date: '1849-04-20' });
const warnedStudentOrigin = { mapId: warnedArrest.hosts.student_vasily.mapId,
  position: { ...warnedArrest.hosts.student_vasily.position } };
const warnedOpen = game.advanceNpcWorld(warnedArrest, 1, maps);
assert.deepEqual({ mapId: warnedOpen.hosts.student_vasily.mapId, position: warnedOpen.hosts.student_vasily.position },
  warnedStudentOrigin, 'a warned student starts the escape from their actual location');
assert.equal(warnedOpen.hosts.student_vasily.v47TravelGoal.targetMapId, 'communal-room',
  'the warned student receives a physical route to a hiding place');
assert.equal(warnedOpen.hosts.police_sergeant_ivan.v47TravelGoal.targetMapId, 'morskaya-intersection',
  'police search the last public location through the world map');
assert.equal(warnedOpen.hosts.dostoevsky_1849.v47Assignment.status, 'EN_ROUTE_TO_ARREST_ADDRESS',
  'warning a fictional witness cannot change the fixed historical arrest');
const warnedTravel = game.advanceNpcWorld(warnedOpen, 360, maps);
assert.equal(warnedTravel.hosts.student_vasily.mapId, 'communal-room', 'the student physically reaches the hiding place');
assert.ok(warnedTravel.ledger.flatMap(row => row.moves ?? []).some(row => row.hostId === 'student_vasily'),
  'the hide route is visible in the ordinary movement ledger');
assert.equal(warnedTravel.hosts.student_vasily.v47Questioning.status, 'HIDDEN_BEFORE_QUESTIONING',
  'arrival in the lodging records that the student is hidden from questioning');
assert.equal(warnedTravel.hosts.police_sergeant_ivan.mapId, 'morskaya-intersection',
  'the search party physically reaches the last public location');
assert.equal(warnedTravel.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.searchOutcome,
  'EMPTY_PUBLIC_LOCATION', 'the police search resolves as an empty search after the student reaches shelter');
assert.ok(warnedTravel.world.v47.worldChanges.some(row => row.actionId === 'NPC_SEARCH_FINDS_NO_WITNESS'),
  'the empty search is recorded for later quest and epilogue context');
assert.ok(['TRANSFERRED_AFTER_FIXED_ARREST', 'ARRIVED_AFTER_FIXED_ARREST'].includes(warnedTravel.hosts.dostoevsky_1849.v47Assignment.status),
  'the historical address route advances independently of the fictional witness escape');
assert.equal(warnedTravel.hosts.dostoevsky_1849.v47Assignment.arrestedDate, '1849-05-05');
for (const id of Object.keys(historicalDetaineeOrigins)) {
  assert.deepEqual({ mapId: arrestOpened.hosts[id].mapId, position: arrestOpened.hosts[id].position }, historicalDetaineeOrigins[id],
    `${id} is not teleported when the historically fixed arrest begins`);
  assert.equal(arrestOpened.hosts[id].v47Assignment.status,
    id === 'dostoevsky_1849' ? 'EN_ROUTE_TO_ARREST_ADDRESS' : 'TRANSFERRED_AFTER_FIXED_ARREST',
    `${id} follows the route authorized by the verified arrest order`);
  const routeDestination = id === 'dostoevsky_1849' ? 'morskaya-intersection' : 'police-station';
  assert.notEqual(game.npcMapRoute(arrestOpened.hosts[id].mapId, routeDestination, arrestOpened.hosts[id], maps,
    arrestOpened.world.clockMinutes, { allowClosedMapIds: ['police-station'], allowEventAccess: true,
      allowUnlistedMapIds: ['courtyard', 'workyard'] }), null,
    `${id} can reach their historically grounded route through the authored public transit maps`);
}
const firstDetaineeTravelMinute = game.advanceNpcWorld(arrestOpened, 1, maps);
for (const id of ['petrashevsky_1849']) {
  assert.equal(firstDetaineeTravelMinute.hosts[id].activeGoal?.type, 'V47_EVENT_RETURN',
    `${id} leaves the authored arrest scene for custody using the ordinary travel path`);
  assert.equal(firstDetaineeTravelMinute.hosts[id].activeGoal?.targetMapId, 'police-station',
    `${id}'s fixed arrest has a physical custody destination`);
}
const detaineesAtStation = game.advanceNpcWorld(firstDetaineeTravelMinute, 359, maps);
assert.equal(detaineesAtStation.hosts.police_sergeant_ivan.mapId, 'morskaya-intersection',
  'the sergeant physically reaches the operation street during the arrest');
for (const id of ['petrashevsky_1849']) {
  const movement = detaineesAtStation.ledger.flatMap(row => row.moves ?? []).filter(row => row.hostId === id);
  assert.ok(movement.length > 0, `${id} walks through the ordinary NPC pathfinder during the arrest transfer: ${JSON.stringify({ origin: historicalDetaineeOrigins[id], current: { mapId: detaineesAtStation.hosts[id].mapId, position: detaineesAtStation.hosts[id].position, activeGoal: detaineesAtStation.hosts[id].activeGoal, alive: detaineesAtStation.hosts[id].historicalAliveAndPresent }, assigned: detaineesAtStation.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.assignedHostIds, routes: movement })}`);
  assert.ok(movement.some(row => row.toMapId === 'police-station'), `${id} has a recorded physical arrival at the station: ${JSON.stringify({ movement, current: { mapId: detaineesAtStation.hosts[id].mapId, position: detaineesAtStation.hosts[id].position, goal: detaineesAtStation.hosts[id].activeGoal, travel: detaineesAtStation.hosts[id].v47TravelGoal }, event: detaineesAtStation.world.v47.events.MAIN03_PETRASHEVSKY_ARREST })}`);
  assert.equal(detaineesAtStation.hosts[id].mapId, 'police-station', `${id} reaches the arrest station on the map: ${JSON.stringify({ current: { mapId: detaineesAtStation.hosts[id].mapId, position: detaineesAtStation.hosts[id].position, goal: detaineesAtStation.hosts[id].activeGoal, travel: detaineesAtStation.hosts[id].v47TravelGoal }, routes: movement, arrivals: detaineesAtStation.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.arrivedHostIds, destination: detaineesAtStation.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.destinationMapByHost })}`);
  assert.equal(detaineesAtStation.hosts[id].v47Assignment.status, 'ARRIVED_AFTER_FIXED_ARREST',
    `${id}'s fixed historical transfer is acknowledged only after arriving`);
}
const dostoevskyAtAddress = game.advanceNpcWorld(arrestOpened, 720, maps);
assert.ok(['TRANSFERRED_AFTER_FIXED_ARREST', 'ARRIVED_AFTER_FIXED_ARREST'].includes(dostoevskyAtAddress.hosts.dostoevsky_1849.v47Assignment.status));
assert.equal(dostoevskyAtAddress.hosts.dostoevsky_1849.v47Assignment.arrestedDate, '1849-05-05');
assert.ok(dostoevskyAtAddress.hosts.police_sergeant_ivan.inventory.includes('봉인된 책과 서류 꾸러미'));
assert.ok(dostoevskyAtAddress.ledger.flatMap(row => row.moves ?? []).some(row => row.hostId === 'dostoevsky_1849'
  && row.toMapId === 'morskaya-intersection'), 'the documented address appears in Dostoevsky’s physical route');
const dostoevskyAtStation = game.advanceNpcWorld(dostoevskyAtAddress, 600, maps);
assert.equal(dostoevskyAtStation.hosts.dostoevsky_1849.mapId, 'police-station');
assert.equal(dostoevskyAtStation.hosts.dostoevsky_1849.v47Assignment.status, 'ARRIVED_AFTER_FIXED_ARREST');
const postArrestTransfer = runtime.advanceV47World(dostoevskyAtStation,
  { date: '1849-05-06', clockMinutes: dostoevskyAtStation.world.clockMinutes });
postArrestTransfer.world.date = '1849-05-06';
assert.equal(postArrestTransfer.hosts.dostoevsky_1849.v47Assignment.status, 'EN_ROUTE_TO_FORTRESS_AFTER_FIXED_ARREST',
  'after reaching the station, Dostoevsky receives the historically fixed transfer to the fortress');
assert.equal(postArrestTransfer.hosts.dostoevsky_1849.v47TravelGoal.targetMapId, 'fortress-cell');
const dostoevskyAtFortress = game.advanceNpcWorld(postArrestTransfer, 390, maps);
assert.equal(dostoevskyAtFortress.hosts.dostoevsky_1849.mapId, 'fortress-cell',
  `Dostoevsky physically walks from the station to the fortress cell after the fixed arrest: ${JSON.stringify({
    date: dostoevskyAtFortress.world.date, clock: dostoevskyAtFortress.world.clockMinutes,
    position: dostoevskyAtFortress.hosts.dostoevsky_1849.position,
    goal: dostoevskyAtFortress.hosts.dostoevsky_1849.activeGoal,
    travel: dostoevskyAtFortress.hosts.dostoevsky_1849.v47TravelGoal,
    schedule: dostoevskyAtFortress.hosts.dostoevsky_1849.scheduleId,
  })}`);
assert.ok(dostoevskyAtFortress.ledger.flatMap(row => row.moves ?? []).some(row => row.hostId === 'dostoevsky_1849'
  && row.toMapId === 'fortress-cell'), 'the transfer to the fortress is present in the movement ledger');
assert.equal(dostoevskyAtFortress.hosts.dostoevsky_1849.v47Assignment.status, 'IN_FORTRESS_AFTER_FIXED_ARREST',
  JSON.stringify({ position: dostoevskyAtFortress.hosts.dostoevsky_1849.position,
    travel: dostoevskyAtFortress.hosts.dostoevsky_1849.v47TravelGoal,
    assignment: dostoevskyAtFortress.hosts.dostoevsky_1849.v47Assignment }));
let studentAtStation = game.advanceNpcWorld(arrestOpened, 180, maps);
assert.equal(studentAtStation.hosts.student_vasily.mapId, 'police-station',
  `student route state: ${JSON.stringify({ mapId: studentAtStation.hosts.student_vasily.mapId,
    activeGoal: studentAtStation.hosts.student_vasily.activeGoal, position: studentAtStation.hosts.student_vasily.position,
    travel: studentAtStation.hosts.student_vasily.v47TravelGoal,
    destination: studentAtStation.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.destinationMapByHost,
    arrivals: studentAtStation.world.v47.events.MAIN03_PETRASHEVSKY_ARREST.npcAutonomy.arrivedHostIds,
    moves: studentAtStation.ledger.flatMap(row => row.moves ?? []).filter(move => move.hostId === 'student_vasily').length })}`);
assert.equal(studentAtStation.hosts.student_vasily.v47Questioning.status, 'HELD_FOR_QUESTIONING',
  'questioning begins only after the student reaches the physical station');
studentAtStation.world.date = '1849-05-06';
studentAtStation = runtime.advanceV47World(studentAtStation, { date: '1849-05-06', clockMinutes: studentAtStation.world.clockMinutes });
assert.equal(studentAtStation.hosts.student_vasily.v47Questioning.status, 'RELEASED_TO_FAMILY');
const studentReturned = game.advanceNpcWorld(studentAtStation, 180, maps);
assert.equal(studentReturned.hosts.student_vasily.mapId, 'communal-room',
  `released student route state: ${JSON.stringify({ mapId: studentReturned.hosts.student_vasily.mapId,
    questioning: studentReturned.hosts.student_vasily.v47Questioning,
    activeGoal: studentReturned.hosts.student_vasily.activeGoal, position: studentReturned.hosts.student_vasily.position,
    moves: studentReturned.ledger.flatMap(row => row.moves ?? []).filter(move => move.hostId === 'student_vasily').length })}`);
assert.equal(studentReturned.hosts.student_vasily.v47Questioning.status, 'RETURNED_TO_FAMILY');

const delivery = game.createInitialState({ maps, hostCards, quests: [...v47StoryQuests, ...beats], startMapId: 'market-quay' });
delivery.world.chapterId = 'V33_1848_PUBLIC';
delivery.world.date = '1848-06-16';
delivery.world.clockMinutes = 540;
delivery.world.currentMapId = 'market-quay';
delivery.player.embodiment = 'landlady_polina';
delivery.hosts.landlady_polina.mapId = 'market-quay';
const deliveryObject = maps['market-quay'].layers.flatMap(layer => layer.objects ?? []).find(object => object.id === 9080);
const deliveryAnchor = { x: Math.floor(deliveryObject.x / 16), y: Math.floor(deliveryObject.y / 16) };
const deliveryPlayerTile = [[deliveryAnchor.x - 1, deliveryAnchor.y], [deliveryAnchor.x + 1, deliveryAnchor.y],
  [deliveryAnchor.x, deliveryAnchor.y - 1], [deliveryAnchor.x, deliveryAnchor.y + 1]]
  .find(([x, y]) => game.canOccupy(maps['market-quay'], x, y));
delivery.player.position = { x: deliveryPlayerTile[0], y: deliveryPlayerTile[1] };
delivery.hosts.landlady_polina.position = { ...delivery.player.position };
delivery.quests.V47_MAIN05_C01.status = 'open';
const carrierOrigin = { mapId: delivery.hosts.watercarrier_luka.mapId,
  position: { ...delivery.hosts.watercarrier_luka.position } };
const deliveryChoice = game.performQuestAction(delivery, { questId: 'V47_MAIN05_C01', hostId: 'landlady_polina',
  actionId: 'V47_C01_SUPPLY_LODGING', objectId: deliveryObject.id }, { quests: [...v47StoryQuests, ...beats], maps });
assert.equal(deliveryChoice.ok, true, `the physical delivery choice is accepted: ${deliveryChoice.reason}`);
assert.deepEqual({ mapId: deliveryChoice.state.hosts.watercarrier_luka.mapId,
  position: deliveryChoice.state.hosts.watercarrier_luka.position }, carrierOrigin,
'a carrier chosen by another person begins from its actual location, without a map teleport');
assert.equal(deliveryChoice.state.hosts.watercarrier_luka.v47TravelGoal.status, 'EN_ROUTE');
const walkedDelivery = game.advanceNpcWorld(deliveryChoice.state, 180, maps, { pausedHostIds: [deliveryChoice.state.player.embodiment] });
assert.equal(walkedDelivery.hosts.watercarrier_luka.mapId, 'communal-room',
  `the water carrier reaches the lodging by ordinary map traversal: ${JSON.stringify({ travel: walkedDelivery.hosts.watercarrier_luka.v47TravelGoal,
    goal: walkedDelivery.hosts.watercarrier_luka.activeGoal, position: walkedDelivery.hosts.watercarrier_luka.position,
    route: walkedDelivery.hosts.watercarrier_luka.mapRoutePlan, moves: walkedDelivery.ledger.flatMap(row => row.moves ?? []).filter(move => move.hostId === 'watercarrier_luka').length })}`);
assert.ok(walkedDelivery.ledger.flatMap(row => row.moves ?? []).some(move => move.hostId === 'watercarrier_luka'
  && move.toMapId === 'communal-room'), 'the delivery route leaves a concrete resident movement trace');
assert.equal(walkedDelivery.hosts.watercarrier_luka.v47TravelGoal.status, 'ARRIVED',
  JSON.stringify({ travel: walkedDelivery.hosts.watercarrier_luka.v47TravelGoal,
    position: walkedDelivery.hosts.watercarrier_luka.position,
    blockers: Object.values(walkedDelivery.hosts).filter(host => host.mapId === 'communal-room'
      && host.position.x === walkedDelivery.hosts.watercarrier_luka.v47TravelGoal.destinationPosition?.x
      && host.position.y === walkedDelivery.hosts.watercarrier_luka.v47TravelGoal.destinationPosition?.y).map(host => host.id),
    activeGoal: walkedDelivery.hosts.watercarrier_luka.activeGoal }));

const transit = game.createInitialState({ maps, hostCards, quests: [...v47StoryQuests, ...beats], startMapId: 'courtyard' });
transit.world.chapterId = 'V33_1848_PUBLIC';
transit.world.date = '1848-05-18';
transit.world.clockMinutes = 600;
transit.world.currentMapId = 'courtyard';
transit.player.position = { x: 2, y: 2 };
const editor = transit.hosts.editor_sofia, transitMap = maps.courtyard;
const transitStart = Array.from({ length: transitMap.height }, (_, y) => Array.from({ length: transitMap.width }, (_, x) => ({ x, y })))
  .flat().find(tile => game.canOccupy(transitMap, tile.x, tile.y));
assert.ok(transitStart, 'the public transit courtyard has an available tile');
editor.mapId = 'courtyard';
editor.position = transitStart;
editor.v47TravelGoal = { status: 'EN_ROUTE', targetMapId: 'printshop', targetPosition: { x: 13, y: 10 },
  storyId: 'MAIN01', questId: 'V47_MAIN01_A03', actionId: 'V47_A03_HOST_READING', taskId: 'V47:TRANSIT_TEST', startedDate: transit.world.date };
const transitRestored = game.loadGame(game.saveGame(transit), { maps, hostCards, quests: [...v47StoryQuests, ...beats] });
assert.equal(transitRestored.hosts.editor_sofia.mapId, 'courtyard',
  'a source-authorized V47 traveler can save and reload while crossing a public transit map outside her ordinary destinations');
assert.equal(transitRestored.hosts.editor_sofia.v47TravelGoal.status, 'EN_ROUTE');
console.log('V47 autonomous event participant walks through the NPC pathfinder without a map teleport');
