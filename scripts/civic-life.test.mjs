import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { purchaseCityProduct, publishNewspaperIssue, readNewspaperIssue, circulateNewspaperIssue, commitSuspiciousAct, resolvePoliceCustody } from '../rpg/engine/civic-life.mjs';

const require = createRequire(import.meta.url);
const { createInitialState, saveGame, loadGame } = require('../rpg/engine/game-state.js');
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const cards = readdirSync(new URL('../rpg/characters/', import.meta.url)).filter(name => name.endsWith('.json')).map(name => json(`../rpg/characters/${name}`));
const maps = Object.fromEntries(readdirSync(new URL('../rpg/maps/', import.meta.url)).filter(name => name.endsWith('.json')).map(name => [name.slice(0, -5), json(`../rpg/maps/${name}`)]));
const state = () => createInitialState({ maps, hostCards: cards, quests: [] });

test('city purchases debit the embodied host and newspaper publication consumes supplies after source review', () => {
  const initial = state();
  const purchase = purchaseCityProduct(initial, { hostId: 'bookseller_lev', productId: 'newsprint_sheet' });
  assert.equal(purchase.ok, true);
  assert.equal(purchase.state.hosts.bookseller_lev.money.amount, initial.hosts.bookseller_lev.money.amount - 3);
  assert.equal(purchase.state.hosts.bookseller_lev.inventory.includes('newsprint_sheet'), true);
  const broke = structuredClone(initial); broke.hosts.tenant_mikhail.money.amount = 1;
  assert.equal(purchaseCityProduct(broke, { hostId: 'tenant_mikhail', productId: 'printing_ink' }).reason, 'insufficient_funds');

  const newsroom = state();
  newsroom.world.currentMapId = 'printshop';
  newsroom.world.date = '1847-06-01';
  newsroom.player.embodiment = 'editor_sofia';
  newsroom.hosts.editor_sofia.mapId = 'printshop';
  newsroom.hosts.editor_sofia.knownEvidenceIds.push('LIT-TURGENEV-KHOR-KALYNYCH-1847');
  newsroom.hosts.editor_sofia.inventory.push('newsprint_sheet', 'printing_ink');
  const printed = publishNewspaperIssue(newsroom, { hostId: 'editor_sofia', storyId: 'LITERARY_RURAL_LIFE_1847' });
  assert.equal(printed.ok, true);
  assert.equal(printed.state.hosts.editor_sofia.inventory.includes('newsprint_sheet'), false);
  assert.equal(publishNewspaperIssue(printed.state, { hostId: 'editor_sofia', storyId: 'LITERARY_RURAL_LIFE_1847' }).reason, 'printing_supplies_missing');
});

test('a published issue is readable and can be sent on a paid postal route', () => {
  const newsroom = state();
  newsroom.world.currentMapId = 'printshop';
  newsroom.world.date = '1847-06-01';
  newsroom.player.embodiment = 'editor_sofia';
  newsroom.hosts.editor_sofia.mapId = 'printshop';
  newsroom.hosts.editor_sofia.knownEvidenceIds.push('LIT-TURGENEV-KHOR-KALYNYCH-1847');
  newsroom.hosts.editor_sofia.inventory.push('newsprint_sheet', 'printing_ink');
  const { state: printed, issue } = publishNewspaperIssue(newsroom, { hostId: 'editor_sofia', storyId: 'LITERARY_RURAL_LIFE_1847' });
  const read = readNewspaperIssue(printed, { hostId: 'reader_darya', issueId: issue.id });
  assert.equal(read.reason, 'issue_not_owned');
  const readerState = structuredClone(printed);
  readerState.hosts.reader_darya.inventory.push(`newspaper_issue:${issue.id}`);
  const readOwned = readNewspaperIssue(readerState, { hostId: 'reader_darya', issueId: issue.id });
  assert.equal(readOwned.ok, true);
  assert.ok(readOwned.state.hosts.reader_darya.knownEvidenceIds.includes(issue.sourceId));
  const postal = structuredClone(readOwned.state);
  postal.hosts.editor_sofia.inventory.push('envelope_bundle');
  const sent = circulateNewspaperIssue(postal, { hostId: 'editor_sofia', issueId: issue.id, route: 'postal' });
  assert.equal(sent.ok, true);
  assert.equal(sent.state.hosts.editor_sofia.money.amount, postal.hosts.editor_sofia.money.amount - 4);
  assert.equal(sent.state.hosts.editor_sofia.inventory.includes(`newspaper_issue:${issue.id}`), false);
  assert.deepEqual(sent.state.player.civic.circulatedIssues.at(-1).route, 'postal');
});

test('witnessed suspicious acts lead to custody, resolve through a clear choice and survive save/load', () => {
  const initial = state();
  initial.player.embodiment = 'clerk_alexei';
  const arrested = commitSuspiciousAct(initial, { hostId: 'clerk_alexei', actId: 'TAKE_UNPAID_NEWSPAPER', witnessIds: ['bookseller_lev'], maps });
  assert.equal(arrested.ok, true);
  assert.equal(arrested.arrested, true);
  assert.equal(arrested.state.world.currentMapId, 'police-station');
  assert.equal(arrested.state.player.civic.custody.active, true);
  const released = resolvePoliceCustody(arrested.state, { resolution: 'give_statement' });
  assert.equal(released.ok, true);
  assert.equal(released.state.player.civic.custody.active, false);
  assert.equal(released.state.hosts.clerk_alexei.inventory.includes('newspaper_1847_01'), false);
  const restored = loadGame(saveGame(released.state), { maps, hostCards: cards, quests: [] });
  assert.equal(restored.player.civic.custody.active, false);
  assert.ok(restored.hosts.clerk_alexei.allowedMaps.includes('police-station'));
});
