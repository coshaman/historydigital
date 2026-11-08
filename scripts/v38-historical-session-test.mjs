import assert from 'node:assert/strict';
import { beginHistoricalSession, exitHistoricalSession, recordHistoricalChoice } from '../rpg/engine/historical-session.mjs';

const campaign = { world: { date: '1847-06-01', currentMapId: 'nevsky', clockMinutes: 720 },
  player: { position: { x: 2, y: 3 }, embodiment: 'clerk_alexei' }, hosts: { clerk_alexei: { mapId: 'nevsky', position: { x: 2, y: 3 }, presenceWindow: { startDate: '1847-01-01', endDate: '1847-12-31' } } },
  ledger: [{ id: 'campaign' }] };
const before = JSON.stringify(campaign);
const event = { id: 'SENATE_SQUARE_1825', date: '1825-12-26', entryMapId: 'senate', entryPosition: { x: 2, y: 2 },
  actors: [{ id: 'cobbler', templateId: 'clerk_alexei', nameKo: '구두장이', mapId: 'senate', position: { x: 4, y: 2 }, possessable: true }] };
const cards = [{ id: 'clerk_alexei', displayNameKo: '알렉세이', sprite: { file: 'test.svg' }, allowedMaps: ['nevsky'], eraProfile: { allowedChapterIds: ['V33_1847_PRINT'] } }];
const result = beginHistoricalSession(campaign, event, { senate: { mapId: 'senate', metadata: { date: event.date } } }, cards);
assert.equal(result.ok, true);
assert.equal(result.session.world.currentMapId, 'senate');
assert.equal(result.session.world.date, event.date);
assert.equal(result.session.player.embodiment, null);
assert.equal(result.session.historicalSession.eventId, event.id);
assert.equal(result.session.hosts['historical:SENATE_SQUARE_1825:cobbler'].mapId, 'senate');
assert.equal(result.session.hosts['historical:SENATE_SQUARE_1825:cobbler'].presenceWindow, null, 'event roles must remain available on the event date, outside the campaign actor’s usual date window');
assert.equal(result.session.hosts['historical:SENATE_SQUARE_1825:cobbler'].eraProfile, null, 'event roles must not inherit campaign-era roster restrictions');
assert.equal(result.cards.at(-1).id, 'historical:SENATE_SQUARE_1825:cobbler');
assert.equal(result.cards.at(-1).eraProfile, null, 'a fictional event role does not inherit the template resident’s campaign-era filter');
const chosen = recordHistoricalChoice(result.session, { id: 'clear_a_path', textKo: '사람들을 옆길로 안내했다' });
assert.equal(chosen.historicalSession.choices[0].id, 'clear_a_path');
assert.equal(JSON.stringify(exitHistoricalSession(result.session)), before);
assert.equal(JSON.stringify(campaign), before);
console.log('V38 historical session isolation passed');
