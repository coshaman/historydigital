import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { createInitialState, moveActor, possessHost, releaseHost, transitionMap, performQuestAction, saveGame, loadGame, knowledgeForHost, recordSourceRead, recordEvidenceRead, advanceWorldTime, recordDialogueTurn, stateHash, describeHostMoney } = require('../rpg/engine/game-state.js');
const json = async relative => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
const loadMaps = async () => Object.fromEntries(await Promise.all((await readdir(path.join(root, 'rpg/maps'))).filter(file => file.endsWith('.json')).map(async file => [path.basename(file, '.json'), await json(`rpg/maps/${file}`)])));

test('Nevsky and printshop are connected Tiled maps with separate collision and interaction layers', async () => {
  const maps = Object.values(await loadMaps());
  for (const map of maps) {
    assert.equal(map.type, 'map');
    assert.equal(map.tilewidth, 16);
    assert.equal(map.tileheight, 16);
    assert.ok(map.layers.some(layer => layer.name === 'Ground' && layer.type === 'tilelayer'));
    assert.ok(map.layers.some(layer => layer.name === 'Collision' && layer.type === 'tilelayer'));
    const interactions = map.layers.find(layer => layer.name === 'Interactions');
    assert.equal(interactions?.type, 'objectgroup');
    assert.ok(interactions.objects.length >= 3, `${map.name} needs at least three real interactions`);
    assert.ok(map.tilesets[0].image.endsWith('.png'));
  }
  const exit = maps.flatMap(map => map.layers.find(layer => layer.name === 'Interactions').objects).find(object => object.type === 'map-exit');
  assert.ok(exit, 'maps must connect through a physical door object');
});

test('host cards represent four distinct playable circumstances and reference real pixel sheets', async () => {
  const files = await readdir(path.join(root, 'rpg/characters'));
  const cards = await Promise.all(files.filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  const historicalTownResidents = cards.filter(card => card.kind === 'FICTIONAL');
  const historicalReconstructions = cards.filter(card => card.kind === 'HISTORICAL_RECONSTRUCTION');
  assert.equal(historicalTownResidents.length, 6);
  assert.equal(historicalReconstructions.length, 1);
  assert.equal(cards.length, 10);
  assert.equal(new Set(cards.map(card => card.id)).size, 10);
  const assetManifest = await json('rpg/assets/ASSET_PROVENANCE.json');
  assert.ok(cards.every(card => assetManifest.assets.some(asset => asset.path === `rpg/${card.sprite.file}`)), 'every host sprite has checked-in provenance');
  assert.ok(new Set(historicalTownResidents.map(card => card.socialEstate)).size >= 4);
  for (const card of cards) {
    for (const key of ['id', 'kind', 'displayNameKo', 'displayNameRu', 'occupation', 'legalMobility', 'wealthBracket', 'privateKnowledgeIds', 'knownEvidenceIds', 'personalObjective', 'allowedMaps', 'sprite', 'sourceIds', 'canonConstraint']) assert.ok(card[key] !== undefined, `${card.id} lacks ${key}`);
    assert.ok(card.sprite.file.endsWith('.png'));
    assert.ok(card.sprite.frameWidth === 16 && card.sprite.frameHeight === 24);
    const image = await readFile(path.join(root, 'rpg', card.sprite.file));
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(image.readUInt32BE(16), 48);
    assert.equal(image.readUInt32BE(20), 96);
  }
  assert.match(historicalReconstructions[0].canonConstraint, /not a quotation/);
  assert.ok(historicalReconstructions[0].sourceIds.includes('OBJ-WS-NEKRASOV-EDITORIAL-1848'));
  const tiles = await readFile(path.join(root, 'rpg/assets/petersburg-tiles.png'));
  assert.equal(tiles.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(tiles.readUInt32BE(16), 256);
  assert.equal(tiles.readUInt32BE(20), 160);
});

test('every playable or reconstructed character has a provenance-linked 64px face portrait', async () => {
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  const manifest = await json('rpg/assets/ASSET_PROVENANCE.json');
  for (const card of cards) {
    assert.equal(card.portrait.width, 64, `${card.id} portrait width`);
    assert.equal(card.portrait.height, 64, `${card.id} portrait height`);
    const image = await readFile(path.join(root, 'rpg', card.portrait.file));
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(image.readUInt32BE(16), 64);
    assert.equal(image.readUInt32BE(20), 64);
    const record = manifest.assets.find(asset => asset.path === `rpg/${card.portrait.file}`);
    assert.ok(record, `${card.id} portrait provenance record`);
    assert.equal(record.historicalConfidence, card.portrait.historicalConfidence);
    assert.ok(record.notes?.length > 20, `${card.id} portrait reconstruction note`);
  }
});

test('unknown documented funds are described without rendering null as a coin amount', async () => {
  const nekrasov = await json('rpg/characters/nekrasov_reconstruction.json');
  assert.equal(describeHostMoney(nekrasov.money), '개인 자금은 선택한 자료에서 확인되지 않는다.');
  assert.equal(describeHostMoney({ amount: 27, unit: 'kopeks' }), '주머니에는 27코페이카가 있다.');
});

test('historical source excerpt is contiguous, RU/KO aligned and linked to a checked-in source record', async () => {
  const source = await json('rpg/data/khor-kalynych-source.json');
  const register = await json('rpg/data/source-register.json');
  assert.equal(source.paragraphs.length, 4);
  assert.ok(source.paragraphs.every(paragraph => paragraph.ru && paragraph.ko));
  assert.match(source.witness.range, /lines 123–129.*four consecutive paragraphs/);
  assert.ok(source.witness.stableRevisionUrl.includes('oldid=4722069'));
  assert.ok(source.witness.note.includes('not a facsimile'));
  assert.ok(register.sources.some(record => record.sourceId === source.sourceId && record.range === source.witness.range));
  assert.ok(register.sources.some(record => record.sourceId === 'OBJ-SOV-1847' && record.url === source.catalogUrl));
});

test('world movement respects tile collision and does not move the host while unpossessed', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  const state = createInitialState({ maps, hostCards: cards });
  const beforeHosts = structuredClone(state.hosts);
  const start = structuredClone(state.player.position);
  const collision = moveActor(state, 'up', maps.nevsky);
  assert.equal(collision.moved, false);
  assert.deepEqual(state.player.position, start);
  assert.deepEqual(state.hosts, beforeHosts);
  const walk = moveActor(state, 'right', maps.nevsky);
  assert.equal(walk.moved, true);
  assert.notDeepEqual(walk.state.player.position, start);
  assert.deepEqual(state.hosts, beforeHosts);
});

test('possession requires a nearby present body; release preserves both positions and private knowledge', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  let state = createInitialState({ maps, hostCards: cards });
  const nearbyId = state.hosts.courier_pavel.id;
  const farId = state.hosts.seamstress_anna.id;
  const denied = possessHost(state, farId, maps.nevsky);
  assert.equal(denied.ok, false);
  const entered = possessHost(state, nearbyId, maps.nevsky);
  assert.equal(entered.ok, true);
  state = entered.state;
  assert.equal(state.player.embodiment, nearbyId);
  const moved = moveActor(state, 'right', maps.nevsky);
  assert.equal(moved.moved, true);
  state = moved.state;
  const bodyPosition = structuredClone(state.hosts[nearbyId].position);
  const observerPosition = structuredClone(state.player.position);
  const released = releaseHost(state, maps.nevsky);
  assert.equal(released.ok, true);
  state = released.state;
  assert.equal(state.player.embodiment, null);
  assert.deepEqual(state.hosts[nearbyId].position, bodyPosition);
  assert.deepEqual(state.player.position, observerPosition);
  assert.deepEqual(knowledgeForHost(state, nearbyId), cards.find(card => card.id === nearbyId).privateKnowledgeIds);
  assert.deepEqual(knowledgeForHost(state, farId), cards.find(card => card.id === farId).privateKnowledgeIds);
});

test('crossing a map boundary requires the nearby physical exit and preserves the possessed host', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  let state = createInitialState({ maps, hostCards: cards });
  state.player.position = { x: 2, y: 16 };
  const far = transitionMap(state, 'nevsky-printshop-door', maps);
  assert.equal(far.ok, false);
  state = createInitialState({ maps, hostCards: cards });
  state.player.position = { x: 22, y: 9 };
  const crossed = transitionMap(state, 'nevsky-printshop-door', maps);
  assert.equal(crossed.ok, true);
  assert.equal(crossed.state.world.currentMapId, 'printshop');
  assert.equal(crossed.state.player.embodiment, null);
  assert.equal(crossed.state.hosts.printer_ekaterina.mapId, 'printshop');
  assert.equal(crossed.state.hosts.courier_pavel.mapId, 'nevsky');
});

test('a resident remains at their current host position instead of colliding or being possessed remotely', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  let state = createInitialState({ maps, hostCards: cards });
  state = possessHost(state, 'courier_pavel', maps.nevsky).state;
  state.player.position = { x: 22, y: 9 };
  state.hosts.courier_pavel.position = { x: 22, y: 9 };
  state = transitionMap(state, 'nevsky-printshop-door', maps).state;
  state = releaseHost(state, maps.printshop).state;
  assert.equal(state.hosts.courier_pavel.mapId, 'printshop');
  assert.equal(require('../rpg/engine/game-state.js').canOccupy(maps.nevsky, 10, 16, null, state.hosts), true);
  assert.equal(require('../rpg/engine/game-state.js').canOccupy(maps.printshop, 12, 14, null, state.hosts), false);
  assert.equal(possessHost(state, 'courier_pavel', maps.nevsky).ok, false);
  assert.equal(possessHost(state, 'courier_pavel', maps.printshop).ok, true, 'the host can be repossessed at their saved body location');
  const restored = loadGame(saveGame(state), { maps, hostCards: cards });
  assert.equal(restored.hosts.courier_pavel.mapId, 'printshop');
  assert.deepEqual(restored.hosts.courier_pavel.position, { x: 12, y: 14 });
});

test('a host arriving on a legal map exit remains a present body even without a static NPC spawn marker', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  const { canOccupy } = require('../rpg/engine/game-state.js');
  let state = createInitialState({ maps, hostCards: cards });
  state.world.currentMapId = 'nevsky';
  state.hosts.nekrasov_reconstruction.mapId = 'nevsky';
  state.hosts.nekrasov_reconstruction.position = { x: 22, y: 9 };
  state.player.position = { x: 22, y: 9 };
  const restored = loadGame(saveGame(state), { maps, hostCards: cards });
  assert.equal(canOccupy(maps.nevsky, 22, 9, null, restored.hosts), false, 'the arriving body blocks its tile');
  const entered = possessHost(restored, 'nekrasov_reconstruction', maps.nevsky);
  assert.equal(entered.ok, true, 'a present source-constrained host can be possessed at the arrival point');
});

test('reading an unlocked archive copy does not silently transfer it into the embodied host knowledge', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  const sourceId = 'OBJ-WS-PETRASHEVSKY-REPORT-1849';
  const state = createInitialState({ maps, hostCards: cards });
  state.world.chapterId = 'V33_1849_CIRCLE';
  state.world.date = '1849-04-22';
  state.world.currentMapId = 'chancery';
  state.player.position = { ...state.hosts.clerk_alexei.position };
  const embodied = possessHost(state, 'clerk_alexei', maps.chancery).state;
  const read = recordSourceRead(embodied, sourceId, maps, [sourceId], 'PLAYER_ARCHIVE');
  assert.equal(read.ok, true, 'the player may consult an unlocked source in the archive drawer');
  assert.ok(read.state.player.observedEvidenceIds.includes(sourceId), 'the player records their own research');
  assert.ok(!knowledgeForHost(read.state, 'clerk_alexei').includes(sourceId), 'opening the archive drawer does not count as reading the copy on the desk');
  assert.equal(read.state.ledger.at(-1).hostId, null, 'archive-only reading records no host as reader');
  const restored = loadGame(saveGame(read.state), { maps, hostCards: cards });
  assert.ok(!knowledgeForHost(restored, 'clerk_alexei').includes(sourceId), 'save/load preserves the knowledge boundary');
});

test('quest state changes only after a host-specific allowed physical action', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  const quest = await json('rpg/quests/printshop-article.json');
  let state = createInitialState({ maps, hostCards: cards, quests: [quest], startMapId: 'printshop' });
  const forged = performQuestAction(state, { questId: quest.id, hostId: 'clerk_alexei', actionId: 'AUTHORIZE_PRINT' });
  assert.equal(forged.ok, false);
  const wrongBody = performQuestAction(state, { questId: quest.id, hostId: 'clerk_alexei', actionId: 'RETURN_MANUSCRIPT' });
  assert.equal(wrongBody.ok, false);
  const noBody = performQuestAction(state, { questId: quest.id, hostId: 'printer_ekaterina', actionId: 'RETURN_MANUSCRIPT' });
  assert.equal(noBody.ok, false);
  state = possessHost(state, 'printer_ekaterina', maps.printshop).state;
  const changed = performQuestAction(state, { questId: quest.id, hostId: 'printer_ekaterina', actionId: 'RETURN_MANUSCRIPT', objectId: quest.entry.objectId }, { quests: [quest], maps });
  assert.equal(changed.ok, true);
  assert.equal(changed.state.quests[quest.id].status, 'resolved');
  assert.equal(changed.state.world.immutableOutcomes[quest.historicalOutcome.id], quest.historicalOutcome.value);
  assert.equal(changed.state.ledger.at(-1).hostId, 'printer_ekaterina');
});

test('every historical quest choice records its own follow-up and deterministic relationship or situation change', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  const quests = await Promise.all(['printshop-article', 'public-discourse-1848', 'circle-investigation-1849', 'circle-letter-1849-may'].map(name => json(`rpg/quests/${name}.json`)));
  const allFollowups = new Set();
  for (const quest of quests) {
    const followups = new Set();
    for (const action of quest.actions) {
      assert.ok(action.followupTitleKo && action.followupKo, `${quest.id}/${action.id} needs a distinct follow-up beat`);
      assert.ok(action.effects && (action.effects.situationKo || Object.keys(action.effects.relations ?? {}).length || action.effects.moneyDelta), `${quest.id}/${action.id} needs an authored state effect`);
      followups.add(action.followupTitleKo);
      const map = maps[quest.entry.mapId], target = map.layers.find(item => item.name === 'Interactions').objects.find(item => item.id === quest.entry.objectId);
      const position = { x: Math.floor(target.x / 16), y: Math.floor(target.y / 16) };
      let state = createInitialState({ maps, hostCards: cards, quests });
      state.world.chapterId = quest.chapterId;
      state.world.date = quest.date;
      state.world.currentMapId = quest.entry.mapId;
      const hostId = action.hostIds[0];
      state.hosts[hostId].mapId = quest.entry.mapId;
      state.hosts[hostId].position = { ...position };
      state.player.position = { ...position };
      if (action.requiredKnowledgeId) state.hosts[hostId].knownEvidenceIds.push(action.requiredKnowledgeId);
      state = possessHost(state, hostId, map).state;
      const changed = performQuestAction(state, { questId: quest.id, hostId, actionId: action.id, objectId: target.id }, { quests, maps });
      assert.equal(changed.ok, true, `${quest.id}/${action.id}`);
      assert.equal(changed.state.ledger.at(-1).effectsApplied.situationKo, action.effects.situationKo ?? null);
      for (const [relationId, statusKo] of Object.entries(action.effects.relations ?? {})) assert.equal(changed.state.hosts[hostId].relations[relationId], statusKo);
      for (const item of action.effects.inventoryRemove ?? []) assert.ok(!changed.state.hosts[hostId].inventory.includes(item));
      for (const item of action.effects.inventoryAdd ?? []) assert.ok(changed.state.hosts[hostId].inventory.includes(item));
      if (action.effects.moneyDelta) assert.equal(changed.state.hosts[hostId].money.amount, state.hosts[hostId].money.amount + action.effects.moneyDelta);
    }
    assert.equal(followups.size, quest.actions.length, `${quest.id} must branch into distinct authored aftermaths`);
    for (const title of followups) allFollowups.add(title);
  }
  assert.ok(allFollowups.size >= 8);
  const shippingQuest = quests.find(quest => quest.id === 'PUBLIC_DISCOURSE_1848');
  shippingQuest.actions.find(action => action.id === 'CARRY_NOTICE_ABROAD').effects.moneyDelta = -12;
  let state = createInitialState({ maps, hostCards: cards, quests });
  state.world.chapterId = shippingQuest.chapterId; state.world.date = shippingQuest.date; state.world.currentMapId = shippingQuest.entry.mapId;
  const target = maps.printshop.layers.find(layer => layer.name === 'Interactions').objects.find(item => item.id === shippingQuest.entry.objectId);
  const position = { x: Math.floor(target.x / 16), y: Math.floor(target.y / 16) };
  state.hosts.courier_pavel.mapId = 'printshop'; state.hosts.courier_pavel.position = { ...position }; state.hosts.courier_pavel.knownEvidenceIds.push('OBJ-WS-NEKRASOV-EDITORIAL-1848');
  state.player.position = { ...position }; state = possessHost(state, 'courier_pavel', maps.printshop).state;
  const unaffordable = performQuestAction(state, { questId: shippingQuest.id, hostId: 'courier_pavel', actionId: 'CARRY_NOTICE_ABROAD', objectId: target.id }, { quests, maps });
  assert.equal(unaffordable.ok, false);
  assert.equal(unaffordable.reason, 'invalid_or_unaffordable_effect');
  assert.equal(unaffordable.state.quests[shippingQuest.id].status, 'open');
});

test('reading a physical source records it for the current perspective only', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  const state = createInitialState({ maps, hostCards: cards });
  const missing = recordSourceRead(state, 'LIT-TURGENEV-KHOR-KALYNYCH-1847', { printshop: maps.printshop });
  assert.equal(missing.ok, false);
  const entered = possessHost(state, 'courier_pavel', maps.nevsky);
  const read = recordSourceRead(entered.state, 'LIT-TURGENEV-KHOR-KALYNYCH-1847', maps);
  assert.equal(read.ok, true);
  assert.ok(knowledgeForHost(read.state, 'courier_pavel').includes('LIT-TURGENEV-KHOR-KALYNYCH-1847'));
  assert.ok(!knowledgeForHost(read.state, 'printer_ekaterina').includes('LIT-TURGENEV-KHOR-KALYNYCH-1847'));
  assert.ok(read.state.ledger.at(-1).nextStateHash);
  const observedOnly = recordSourceRead(state, 'LIT-TURGENEV-KHOR-KALYNYCH-1847', maps);
  assert.equal(observedOnly.ok, true);
  assert.ok(observedOnly.state.player.observedEvidenceIds.includes('LIT-TURGENEV-KHOR-KALYNYCH-1847'));
  assert.ok(!knowledgeForHost(observedOnly.state, 'courier_pavel').includes('LIT-TURGENEV-KHOR-KALYNYCH-1847'));
});

test('fictional street clue is learned only by a present body that physically inspects it', async () => {
  const maps = await loadMaps();
  let state = createInitialState({ maps, hostCards: await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`))) });
  state = possessHost(state, 'courier_pavel', maps.nevsky).state;
  const far = recordEvidenceRead(state, 'PRINTSHOP_ROUTING_NOTE', maps);
  assert.equal(far.ok, false);
  state = moveActor(state, 'right', maps.nevsky).state;
  const read = recordEvidenceRead(state, 'PRINTSHOP_ROUTING_NOTE', maps);
  assert.equal(read.ok, true);
  assert.ok(knowledgeForHost(read.state, 'courier_pavel').includes('PRINTSHOP_ROUTING_NOTE'));
  assert.ok(!knowledgeForHost(read.state, 'printer_ekaterina').includes('PRINTSHOP_ROUTING_NOTE'));
  assert.ok(read.state.ledger.at(-1).evidenceId === 'PRINTSHOP_ROUTING_NOTE');
});

test('load rejects a re-checksummed save that leaks discovered evidence to another host', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  let state = createInitialState({ maps, hostCards: cards });
  state = recordSourceRead(possessHost(state, 'courier_pavel', maps.nevsky).state, 'LIT-TURGENEV-KHOR-KALYNYCH-1847', maps).state;
  const forged = JSON.parse(saveGame(state));
  forged.state.hosts.printer_ekaterina.knownEvidenceIds.push('LIT-TURGENEV-KHOR-KALYNYCH-1847');
  forged.checksum = stateHash(forged.state);
  assert.throws(() => loadGame(forged, { maps, hostCards: cards }), /leaked undiscovered source knowledge/);
});

test('save/load preserves split world, player, host knowledge and rejects malformed state', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  const state = createInitialState({ maps, hostCards: cards });
  const saved = saveGame(state);
  const restored = loadGame(saved, { maps, hostCards: cards });
  assert.deepEqual(restored, state);
  assert.throws(() => loadGame('{broken', { maps, hostCards: cards }));
});

test('Chancery and courtyard are door-connected maps with access tied to the embodied host', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  assert.deepEqual(Object.keys(maps).sort(), ['chancery', 'courtyard', 'dead-souls', 'nevsky', 'overcoat', 'printshop']);
  const doors = Object.values(maps).flatMap(map => map.layers.find(layer => layer.name === 'Interactions').objects.filter(object => object.type === 'map-exit').map(object => ({ map, object, props: Object.fromEntries(object.properties.map(property => [property.name, property.value])) })));
  assert.ok(doors.length >= 6);
  assert.ok(doors.every(door => maps[door.props.targetMapId]));
  assert.ok(doors.every(door => maps[door.props.targetMapId].layers.find(layer => layer.name === 'Interactions').objects.some(object => object.type === 'map-exit' && Object.fromEntries(object.properties.map(property => [property.name, property.value])).exitId === door.props.returnExitId)));
  let state = createInitialState({ maps, hostCards: cards });
  assert.equal(possessHost(state, 'clerk_alexei', maps.nevsky).ok, false, 'the clerk cannot be possessed from another map');
  const clerk = state.hosts.clerk_alexei;
  assert.equal(clerk.mapId, 'chancery');
  const restricted = doors.find(door => door.map.mapId === 'nevsky' && door.props.targetMapId === 'chancery');
  assert.ok(restricted);
  const tile = { x: Math.floor(restricted.object.x / 16), y: Math.floor(restricted.object.y / 16) };
  state = possessHost(state, 'courier_pavel', maps.nevsky).state;
  state.hosts.courier_pavel.position = { x: tile.x, y: tile.y + 1 };
  state.player.position = { ...state.hosts.courier_pavel.position };
  const denied = transitionMap(state, restricted.props.exitId, maps);
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, 'host_lacks_access');
  assert.equal(denied.state.world.currentMapId, 'nevsky');
});

test('one literary source can be read by two hosts without sharing their knowledge', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  let state = createInitialState({ maps, hostCards: cards });
  state = possessHost(state, 'courier_pavel', maps.nevsky).state;
  state = recordSourceRead(state, 'LIT-TURGENEV-KHOR-KALYNYCH-1847', maps).state;
  assert.ok(knowledgeForHost(state, 'courier_pavel').includes('LIT-TURGENEV-KHOR-KALYNYCH-1847'));
  assert.ok(!knowledgeForHost(state, 'printer_ekaterina').includes('LIT-TURGENEV-KHOR-KALYNYCH-1847'));
  state.player.embodiment = null;
  state.player.position = { x: 22, y: 9 };
  state = transitionMap(state, 'nevsky-printshop-door', maps).state;
  state = possessHost(state, 'printer_ekaterina', maps.printshop).state;
  state = recordSourceRead(state, 'LIT-TURGENEV-KHOR-KALYNYCH-1847', maps).state;
  assert.ok(knowledgeForHost(state, 'printer_ekaterina').includes('LIT-TURGENEV-KHOR-KALYNYCH-1847'));
  assert.ok(!knowledgeForHost(state, 'clerk_alexei').includes('LIT-TURGENEV-KHOR-KALYNYCH-1847'));
  assert.equal(state.ledger.filter(entry => entry.sourceId === 'LIT-TURGENEV-KHOR-KALYNYCH-1847').length, 2);
});

test('unembodied residents follow their local schedule while an embodied host stays under player control', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  let state = createInitialState({ maps, hostCards: cards });
  assert.equal(state.world.clockMinutes, 540);
  const scheduled = advanceWorldTime(state, 60, maps);
  assert.equal(scheduled.world.clockMinutes, 600);
  assert.deepEqual(scheduled.hosts.courier_pavel.position, { x: 23, y: 10 });
  assert.equal(scheduled.ledger.at(-1).eventType, 'SCHEDULE_MOVEMENT');
  state = possessHost(state, 'courier_pavel', maps.nevsky).state;
  const controlled = advanceWorldTime(state, 60, maps);
  assert.deepEqual(controlled.hosts.courier_pavel.position, { x: 10, y: 16 });
  assert.ok(controlled.world.clockMinutes > state.world.clockMinutes);
});

test('older version-one saves acquire the world clock and current schedule without losing state', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  const fresh = createInitialState({ maps, hostCards: cards });
  const legacy = structuredClone(fresh);
  delete legacy.world.clockMinutes;
  for (const host of Object.values(legacy.hosts)) {
    delete host.schedule;
    delete host.scheduleId;
    delete host.currentActivityKo;
  }
  const loaded = loadGame({ saveVersion: 1, checksum: stateHash(legacy), state: legacy }, { maps, hostCards: cards });
  assert.equal(loaded.world.clockMinutes, 540);
  assert.equal(loaded.hosts.courier_pavel.currentActivityKo, '네프스키 쪽 배달을 시작한다');
  assert.equal(loaded.hosts.courier_pavel.schedule.length, 2);
});

test('dialogue can be ledgered only for the embodied host and never mutates a quest or hidden score', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  let state = createInitialState({ maps, hostCards: cards });
  state = possessHost(state, 'courier_pavel', maps.nevsky).state;
  state.hosts.printer_ekaterina.mapId = 'nevsky';
  state.hosts.printer_ekaterina.position = { x: 10, y: 15 };
  const tooFar = recordDialogueTurn(state, { hostId: 'clerk_alexei', actorHostId: 'courier_pavel', sceneId: 'V33_TALK_CLERK_ALEXEI' }, maps);
  assert.equal(tooFar.ok, false);
  const recorded = recordDialogueTurn(state, { hostId: 'printer_ekaterina', actorHostId: 'courier_pavel', sceneId: 'V33_TALK_PRINTER_EKATERINA', intentClass: 'SOURCE_REQUEST' }, maps);
  assert.equal(recorded.ok, true);
  assert.equal(recorded.state.ledger.at(-1).eventType, 'DIALOGUE_TURN');
  assert.equal(recorded.state.ledger.at(-1).intentClass, 'SOURCE_REQUEST');
  assert.equal(recorded.state.ledger.at(-1).hostId, 'printer_ekaterina');
  assert.equal(recorded.state.ledger.at(-1).interlocutorHostId, 'courier_pavel');
  assert.equal(recordDialogueTurn(state, { hostId: 'courier_pavel', actorHostId: 'courier_pavel', sceneId: 'V33_TALK_COURIER_PAVEL' }, maps).reason, 'dialogue_partner_unavailable');
  assert.equal(recordDialogueTurn(state, { hostId: 'printer_ekaterina', actorHostId: 'courier_pavel', sceneId: 'V33_TALK_PRINTER_EKATERINA', intentClass: 'CHANGE_ENDING' }, maps).reason, 'invalid_intent_class');
  assert.deepEqual(recorded.state.quests, state.quests);
  assert.deepEqual(recorded.state.hosts.courier_pavel.money, state.hosts.courier_pavel.money);
  assert.deepEqual(recorded.state.hosts.courier_pavel.privateKnowledgeIds, state.hosts.courier_pavel.privateKnowledgeIds);
  assert.deepEqual(recorded.state.hosts.printer_ekaterina.privateKnowledgeIds, state.hosts.printer_ekaterina.privateKnowledgeIds);
  assert.equal(recorded.state.endingId, undefined);
  const restored = loadGame(saveGame(recorded.state), { maps, hostCards: cards });
  assert.equal(restored.ledger.at(-1).eventType, 'DIALOGUE_TURN');
  assert.equal(Object.hasOwn(restored.ledger.at(-1), 'playerText'), false);
});

test('Anna can carry her sewing errand into the printshop and use her own literacy to compare a source', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  const quest = await json('rpg/quests/printshop-article.json');
  const anna = cards.find(card => card.id === 'seamstress_anna');
  assert.ok(anna.allowedMaps.includes('printshop'));
  assert.equal(quest.actions.find(action => action.id === 'ASK_FOR_SOURCE').hostIds.includes('seamstress_anna'), true);
  let state = createInitialState({ maps, hostCards: cards, quests: [quest] });
  state.player.position = { x: 22, y: 8 };
  state.player.embodiment = anna.id;
  state.hosts[anna.id].mapId = 'nevsky';
  state.hosts[anna.id].position = { ...state.player.position };
  const crossed = transitionMap(state, 'nevsky-printshop-door', maps);
  assert.equal(crossed.ok, true, 'Anna can physically cross the public-facing printshop door for her sewing order');
  state = crossed.state;
  assert.equal(state.world.currentMapId, 'printshop');
  const source = recordSourceRead(state, 'LIT-TURGENEV-KHOR-KALYNYCH-1847', maps, ['LIT-TURGENEV-KHOR-KALYNYCH-1847']);
  assert.equal(source.ok, true);
  state = source.state;
  const target = maps.printshop.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === quest.entry.objectId);
  state.hosts[anna.id].position = { x: 11, y: 13 };
  state.player.position = { ...state.hosts[anna.id].position };
  const compared = performQuestAction(state, { questId: quest.id, hostId: anna.id, actionId: 'ASK_FOR_SOURCE', objectId: target.id }, { quests: [quest], maps });
  assert.equal(compared.ok, true, 'Anna can use her own reading knowledge at the physical proof object');
  assert.equal(compared.state.quests[quest.id].result, 'ASK_FOR_SOURCE');
  assert.deepEqual(compared.state.hosts[anna.id].privateKnowledgeIds, state.hosts[anna.id].privateKnowledgeIds);
});

test('campaign contains source-aligned 1847–1849 arcs with a separate literary realm and exactly five authored endings', async () => {
  const packet = await json('rpg/data/historical-source-packets.json');
  const literary = await json('rpg/data/khor-kalynych-source.json');
  const excerpts = [...packet.records, literary].flatMap(record => record.paragraphs);
  assert.ok(excerpts.length >= 12, 'at least twelve aligned original passages');
  assert.ok(excerpts.every(item => item.ru?.trim() && item.ko?.trim()), 'each excerpt has aligned RU and KO');
  assert.ok(packet.records.every(record => record.range && record.sourceUrl && record.contextKo));
  assert.ok(packet.records.every(record => record.paragraphs.every(item => !/[А-Яа-яЁё]/.test(item.ko))), 'Korean translations do not leave Russian fragments untranslated');
  assert.match(packet.records[0].range, /lines 117–119, three consecutive paragraphs/);
  assert.match(packet.records[1].range, /lines 182–190, eight consecutive paragraph blocks/);
  assert.match(packet.records[2].translationNoteKo, /조사기관의 주장/);
  const arcs = await json('rpg/quests/campaign.json');
  assert.deepEqual(arcs.arcs.map(arc => arc.id), ['V33_1847_PRINT', 'V33_1848_PUBLIC', 'V33_1849_CIRCLE']);
  assert.ok(arcs.arcs.every(arc => arc.sources.length >= 2 && arc.questIds.length));
  const mappedSources = new Set(Object.values(await loadMaps()).flatMap(map => map.layers.find(layer => layer.name === 'Interactions').objects.map(object => object.properties?.find(property => property.name === 'sourceId')?.value).filter(Boolean)));
  assert.ok(arcs.arcs.flatMap(arc => arc.sources).every(sourceId => mappedSources.has(sourceId)), 'every historical campaign source has a map object and can be read in play');
  assert.equal(arcs.literaryRealm.mapId, 'dead-souls');
  assert.equal(arcs.endings.length, 5);
  assert.deepEqual(arcs.endings.map(ending => ending.id).sort(), ['BELINSKY', 'DOSTOEVSKY_PETRASHEVSKY', 'HERZEN', 'KHOMYAKOV', 'UVAROV'].sort());
});

test('the project root launches the pixel RPG while the former Chancery route remains reachable', async () => {
  const [rootPage, oldGame] = await Promise.all([readFile(path.join(root, 'index.html'), 'utf8'), readFile(path.join(root, 'chancery.html'), 'utf8')]);
  assert.match(rootPage, /rpg\/main\.js/);
  assert.match(rootPage, /id="world"/);
  assert.match(oldGame, /evidenceBtn/);
  assert.match(oldGame, /main20-runtime\.js/);
});

test('literary realm is source-bound, enterable, and cannot rewind or alter the historical timeline', async () => {
  const map = await json('rpg/maps/dead-souls.json');
  const card = await json('rpg/characters/literary_chichikov.json');
  const source = await json('rpg/data/dead-souls-source.json');
  const { enterLiteraryRealm, leaveLiteraryRealm } = require('../rpg/engine/game-state.js');
  const maps = await loadMaps(); maps[map.mapId] = map;
  const cards = [...await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json') && !file.includes('literary')).map(file => json(`rpg/characters/${file}`))), card];
  const literaryQuest = await json('rpg/quests/literary-dead-souls.json');
  let state = createInitialState({ maps, hostCards: cards, quests: [literaryQuest], startMapId: 'nevsky' });
  assert.equal(state.world.immutableOutcomes.GOGOL_CHICHIKOV_HOTEL_REGISTER, undefined);
  assert.ok(state.world.literaryOutcomes.GOGOL_CHICHIKOV_HOTEL_REGISTER);
  const date = state.world.date;
  const entered = enterLiteraryRealm(state, map, card);
  assert.equal(entered.ok, true);
  state = entered.state;
  assert.equal(state.world.date, date);
  assert.equal(state.world.activeRealm.id, 'LITERARY_DEAD_SOULS');
  const possessed = possessHost(state, card.id, maps[map.mapId]);
  assert.equal(possessed.ok, true);
  state = possessed.state;
  assert.equal(state.world.immutableOutcomes.SOVREMENNIK_1847_ISSUE_PUBLICATION, undefined);
  const restoredLiterarySave = loadGame(saveGame(state), { maps, hostCards: cards, quests: [literaryQuest] });
  assert.equal(restoredLiterarySave.world.activeRealm.id, 'LITERARY_DEAD_SOULS');
  const boundaryMap = structuredClone(map);
  const literaryExit = { id: 99, name: 'historical world boundary test', type: 'map-exit', x: 160, y: 160, width: 16, height: 16, properties: [{ name: 'exitId', value: 'test-exit' }, { name: 'targetMapId', value: 'courtyard' }, { name: 'arrivalX', value: 4 }, { name: 'arrivalY', value: 4 }, { name: 'publicAccess', value: true }] };
  boundaryMap.layers.find(layer => layer.name === 'Interactions').objects.push(literaryExit);
  maps[map.mapId] = boundaryMap;
  const boundaryState = structuredClone(state);
  boundaryState.player.position = { x: Math.floor(literaryExit.x / 16), y: Math.floor(literaryExit.y / 16) };
  boundaryState.hosts[card.id].position = { ...boundaryState.player.position };
  assert.equal(transitionMap(boundaryState, 'test-exit', maps).reason, 'realm_boundary');
  const exited = leaveLiteraryRealm(state, maps);
  assert.equal(exited.ok, true);
  assert.equal(exited.state.world.date, date);
  assert.equal(exited.state.world.currentMapId, 'nevsky');
  assert.equal(exited.state.player.embodiment, null);
  assert.equal(source.sourceId, 'LIT-GOGOL-DEAD-SOULS-1842');
  assert.equal(map.metadata.mapClass, 'LITERARY_REALM');
});

test('The Overcoat reconstruction is a separate, source-bound realm with its own playable host and fixed literary outcome', async () => {
  const map = await json('rpg/maps/overcoat.json');
  const card = await json('rpg/characters/literary_akaky.json');
  const source = await json('rpg/data/overcoat-source.json');
  const quest = await json('rpg/quests/literary-overcoat.json');
  const campaign = await json('rpg/quests/campaign.json');
  const { enterLiteraryRealm, leaveLiteraryRealm, performQuestAction } = require('../rpg/engine/game-state.js');
  const maps = await loadMaps(); maps[map.mapId] = map;
  const cards = [...await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)))];
  const quests = [quest];
  let state = createInitialState({ maps, hostCards: cards, quests, startMapId: 'nevsky' });
  const historicalBefore = structuredClone(state.world.immutableOutcomes);
  const entered = enterLiteraryRealm(state, map, card);
  assert.equal(entered.ok, true);
  state = entered.state;
  assert.equal(state.world.activeRealm.id, 'LITERARY_OVERCOAT');
  assert.equal(state.world.currentMapId, 'overcoat');
  assert.equal(state.world.date, '1847-06-01', 'literary travel cannot rewind the historical campaign date');
  const possessed = possessHost(state, card.id, map);
  assert.equal(possessed.ok, true);
  state = possessed.state;
  const read = recordSourceRead(state, source.sourceId, maps);
  assert.equal(read.ok, true);
  state = read.state;
  for (let step = 0; step < 7; step += 1) {
    const moved = moveActor(state, 'right', map, maps);
    assert.equal(moved.moved, true, 'Akaky can walk to the coat interaction');
    state = moved.state;
  }
  const action = quest.actions[0];
  const completed = performQuestAction(state, { questId: quest.id, hostId: card.id, actionId: action.id, objectId: quest.entry.objectId }, { quests, maps });
  assert.equal(completed.ok, true);
  state = completed.state;
  assert.deepEqual(state.world.immutableOutcomes, historicalBefore, 'literary choices never mutate historical outcomes');
  assert.ok(state.world.literaryOutcomes.GOGOL_AKAKY_OVERCOAT, 'the novel outcome stays in its literary namespace');
  assert.equal(state.quests[quest.id].status, 'resolved');
  assert.equal(source.realmClass, 'LITERARY_REALM');
  assert.equal(source.author, 'Николай Васильевич Гоголь');
  assert.match(source.range, /consecutive/);
  const exited = leaveLiteraryRealm(state, maps);
  assert.equal(exited.ok, true);
  assert.equal(exited.state.world.currentMapId, 'nevsky');
  assert.equal(exited.state.world.date, '1847-06-01');
  assert.equal(campaign.literaryRealms.some(realm => realm.id === 'LITERARY_OVERCOAT'), true);
});

test('chapter and ending reducer preserve fixed historical outcomes and resolve mixed histories through a final authored decision', async () => {
  const maps = await loadMaps();
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  const campaign = await json('rpg/quests/campaign.json');
  const { advanceChapter, resolveEnding } = require('../rpg/engine/game-state.js');
  let state = createInitialState({ maps, hostCards: cards, quests: await Promise.all(['printshop-article','public-discourse-1848','circle-investigation-1849','circle-letter-1849-may'].map(name => json(`rpg/quests/${name}.json`))) });
  assert.equal(advanceChapter(state, 'V33_1848_PUBLIC', campaign).ok, false);
  state.quests.PRINTSHOP_PROOF_1847.status = 'resolved';
  const next = advanceChapter(state, 'V33_1848_PUBLIC', campaign, maps);
  assert.equal(next.ok, true);
  assert.equal(next.state.world.date, '1848-01-01');
  state = next.state;
  state.world.date = '1849-05-05';
  state.world.possessionHistory = [{ hostId: 'printer_ekaterina' }, { hostId: 'clerk_alexei' }, { hostId: 'courier_pavel' }, { hostId: 'seamstress_anna' }];
  state.learning = { ...state.learning, phase: 'complete', circleLearning: 'attended', examOutcome: 'passed', examCorrectCount: 5, promotionStatus: 'promoted' };
  for (const quest of Object.values(state.quests)) quest.status = 'resolved';
  state.ledger.push({ questId: 'PUBLIC_DISCOURSE_1848', sourceIds: ['OBJ-WS-NEKRASOV-EDITORIAL-1848', 'OBJ-WS-NEKRASOV-1849-ISSUE-NOTICE', 'OBJ-WS-PETRASHEVSKY-REPORT-1849'] });
  for (const ending of campaign.endings) {
    const candidate = structuredClone(state);
    candidate.ledger.push({ actionId: ending.requiredActions[0] });
    const result = resolveEnding(candidate, ending.id, campaign);
    assert.equal(result.ok, true);
    assert.equal(result.state.endingId, ending.id);
  }
  assert.equal(resolveEnding(state, 'UNRESOLVED', campaign).ok, false);
});

test('future dated source packets remain locked until their chapter begins', async () => {
  const maps = await loadMaps();
  const state = createInitialState({ maps, hostCards: await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`))) });
  state.world.currentMapId = 'printshop';
  assert.equal(recordSourceRead(state, 'OBJ-WS-NEKRASOV-EDITORIAL-1848', maps).ok, false);
  state.world.chapterId = 'V33_1848_PUBLIC';
  assert.equal(recordSourceRead(state, 'OBJ-WS-NEKRASOV-EDITORIAL-1848', maps).ok, true);
  state.world.currentMapId = 'chancery';
  assert.equal(recordSourceRead(state, 'OBJ-WS-PETRASHEVSKY-REPORT-1849', maps, ['OBJ-WS-PETRASHEVSKY-REPORT-1849']).ok, false);
  state.world.chapterId = 'V33_1849_CIRCLE';
  assert.equal(recordSourceRead(state, 'OBJ-WS-PETRASHEVSKY-REPORT-1849', maps).ok, true);
});

test('the May 5 letter stays locked on April 22 until the authored campaign date advances', async () => {
  const maps = await loadMaps();
  const campaign = await json('rpg/quests/campaign.json');
  const quests = await Promise.all(['circle-investigation-1849','circle-letter-1849-may'].map(name => json(`rpg/quests/${name}.json`)));
  const cards = await Promise.all((await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`)));
  const { advanceCampaignDate } = require('../rpg/engine/game-state.js');
  const state = createInitialState({ maps, hostCards: cards, quests });
  state.world.chapterId = 'V33_1849_CIRCLE'; state.world.date = '1849-04-22'; state.world.currentMapId = 'chancery';
  assert.equal(recordSourceRead(state, 'OBJ-WS-PETRASHEVSKY-REPORT-1849', maps).ok, true);
  assert.equal(recordSourceRead(state, 'OBJ-WS-MIKHAIL-DOSTOEVSKY-LETTER-1849', maps, ['OBJ-WS-MIKHAIL-DOSTOEVSKY-LETTER-1849']).ok, false);
  assert.equal(performQuestAction(state, { questId: 'CIRCLE_LETTER_1849_MAY', hostId: 'clerk_alexei', actionId: 'PRESERVE_LETTER', objectId: 33 }, { quests, maps }).reason, 'quest_not_yet_available');
  assert.equal(advanceCampaignDate(state, '1849-05-05', campaign, quests).reason, 'campaign_stage_incomplete');
  state.quests.CIRCLE_INVESTIGATION_1849.status = 'resolved';
  const advanced = advanceCampaignDate(state, '1849-05-05', campaign, quests);
  assert.equal(advanced.ok, true);
  assert.equal(recordSourceRead(advanced.state, 'OBJ-WS-MIKHAIL-DOSTOEVSKY-LETTER-1849', maps).ok, true);
});
