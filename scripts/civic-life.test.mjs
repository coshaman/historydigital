import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { purchaseCityProduct, publishNewspaperIssue, shareSourceWithEditor, readNewspaperIssue, circulateNewspaperIssue, commitSuspiciousAct, resolvePoliceCustody, newspaperAssignment } from '../rpg/engine/civic-life.mjs';

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

test('press assignments guide source, supply, print and reader delivery; a shared street copy reaches multiple readers', () => {
  const newsroom = state();
  newsroom.world.date = '1847-06-01';
  newsroom.world.currentMapId = 'printshop';
  newsroom.player.embodiment = 'editor_sofia';
  newsroom.hosts.editor_sofia.mapId = 'printshop';
  assert.match(newspaperAssignment(newsroom, 'editor_sofia', maps).actionKo, /자료 읽기/);
  newsroom.hosts.editor_sofia.knownEvidenceIds.push('LIT-TURGENEV-KHOR-KALYNYCH-1847');
  assert.match(newspaperAssignment(newsroom, 'editor_sofia', maps).actionKo, /종이와.*잉크/);
  newsroom.hosts.editor_sofia.inventory.push('newsprint_sheet', 'printing_ink');
  assert.match(newspaperAssignment(newsroom, 'editor_sofia', maps).actionKo, /호외 인쇄/);
  const { state: printed, issue } = publishNewspaperIssue(newsroom, { hostId: 'editor_sofia', storyId: 'LITERARY_RURAL_LIFE_1847' });
  assert.match(newspaperAssignment(printed, 'editor_sofia', maps).actionKo, /배포/);
  const street = circulateNewspaperIssue(printed, { hostId: 'editor_sofia', issueId: issue.id, route: 'street' }).state;
  street.world.currentMapId = 'nevsky';
  const firstReader = readNewspaperIssue(street, { hostId: 'reader_darya', issueId: issue.id });
  assert.equal(firstReader.ok, true);
  assert.ok(firstReader.state.hosts.reader_darya.knownEvidenceIds.includes(issue.sourceId));
  const secondReader = readNewspaperIssue(firstReader.state, { hostId: 'bookseller_lev', issueId: issue.id });
  assert.equal(secondReader.ok, true);
  assert.ok(secondReader.state.hosts.bookseller_lev.knownEvidenceIds.includes(issue.sourceId));
  assert.equal(readNewspaperIssue(secondReader.state, { hostId: 'reader_darya', issueId: issue.id }).alreadyRead, true);

  const handoff = state();
  handoff.world.currentMapId = 'printshop';
  handoff.world.date = '1847-06-01';
  handoff.player.embodiment = 'editor_sofia';
  handoff.player.observedEvidenceIds.push('LIT-TURGENEV-KHOR-KALYNYCH-1847');
  handoff.hosts.editor_sofia.mapId = 'printshop';
  assert.match(newspaperAssignment(handoff, 'editor_sofia', maps).actionKo, /자료 전달/);
  const shared = shareSourceWithEditor(handoff, { hostId: 'editor_sofia', sourceId: 'LIT-TURGENEV-KHOR-KALYNYCH-1847' });
  assert.equal(shared.ok, true);
  assert.ok(shared.state.hosts.editor_sofia.knownEvidenceIds.includes('LIT-TURGENEV-KHOR-KALYNYCH-1847'));

  const later = state();
  later.world.date = '1849-04-22';
  later.world.currentMapId = 'printshop';
  later.player.embodiment = 'editor_sofia';
  later.hosts.editor_sofia.mapId = 'printshop';
  later.player.civic.publishedIssues.push(
    { id: 'I1', storyId: 'LITERARY_RURAL_LIFE_1847' },
    { id: 'I2', storyId: 'DELIVERY_NOTICE_1848' },
  );
  later.player.civic.circulatedIssues.push({ issueId: 'I1', route: 'street' }, { issueId: 'I2', route: 'postal' });
  assert.equal(newspaperAssignment(later, 'editor_sofia', maps).placeKo, maps.chancery.metadata.displayNameKo);
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
