import assert from 'node:assert/strict';
import { beginHistoricalSession, exitHistoricalSession, recordHistoricalChoice } from '../rpg/engine/historical-session.mjs';

const campaign = { world: { date: '1847-06-01', currentMapId: 'nevsky', clockMinutes: 720 },
  player: { position: { x: 2, y: 3 }, embodiment: 'clerk_alexei' }, hosts: { clerk_alexei: { mapId: 'nevsky', position: { x: 2, y: 3 } } },
  ledger: [{ id: 'campaign' }] };
const before = JSON.stringify(campaign);
const event = { id: 'SENATE_SQUARE_1825', date: '1825-12-26', entryMapId: 'senate', entryPosition: { x: 2, y: 2 },
  actors: [{ id: 'cobbler', templateId: 'clerk_alexei', nameKo: '구두장이', mapId: 'senate', position: { x: 4, y: 2 }, possessable: true }] };
const cards = [{ id: 'clerk_alexei', displayNameKo: '알렉세이', sprite: { file: 'test.svg' }, allowedMaps: ['nevsky'] }];
const result = beginHistoricalSession(campaign, event, { senate: { mapId: 'senate', metadata: { date: event.date } } }, cards);
assert.equal(result.ok, true);
assert.equal(result.session.world.currentMapId, 'senate');
assert.equal(result.session.world.date, event.date);
assert.equal(result.session.player.embodiment, null);
assert.equal(result.session.historicalSession.eventId, event.id);
assert.equal(result.session.hosts['historical:SENATE_SQUARE_1825:cobbler'].mapId, 'senate');
assert.equal(result.cards.at(-1).id, 'historical:SENATE_SQUARE_1825:cobbler');
const chosen = recordHistoricalChoice(result.session, { id: 'clear_a_path', textKo: '사람들을 옆길로 안내했다' });
assert.equal(chosen.historicalSession.choices[0].id, 'clear_a_path');
assert.equal(JSON.stringify(exitHistoricalSession(result.session)), before);
assert.equal(JSON.stringify(campaign), before);
console.log('V38 historical session isolation passed');
