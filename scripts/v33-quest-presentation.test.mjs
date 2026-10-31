import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { questChoices, continuationQuest } from '../rpg/engine/quest-presentation.mjs';

const read = async file => JSON.parse(await fs.readFile(new URL(`../rpg/quests/${file}.json`, import.meta.url), 'utf8'));
const campaign = await read('campaign');
const quests = await Promise.all(['printshop-article', 'public-discourse-1848', 'circle-investigation-1849', 'circle-letter-1849-may', 'literary-overcoat'].map(read));

test('an unread source stays visible as a prerequisite rather than erasing every choice', () => {
  const proof = quests[0];
  const options = questChoices(proof, 'seamstress_anna');
  assert.equal(options.length, 1);
  assert.equal(options[0].action.id, 'ASK_FOR_SOURCE');
  assert.equal(options[0].missingSourceId, 'LIT-TURGENEV-KHOR-KALYNYCH-1847');
  assert.equal(questChoices(proof, 'seamstress_anna', [options[0].missingSourceId])[0].missingSourceId, null);
  assert.equal(questChoices(proof, 'printer_ekaterina').length, 3);
  assert.deepEqual(questChoices(proof, null), []);
  assert.deepEqual(questChoices(proof, 'tenant_mikhail'), []);
});

test('literary choices also explain their reading requirement without bypassing it', () => {
  const options = questChoices(quests[4], 'literary_akaky');
  assert.equal(options.length, 2);
  assert.ok(options.every(option => option.missingSourceId === 'LIT-GOGOL-OVERCOAT-1842'));
});

test('continuation survives unrelated journal events and reload, but requires completion', () => {
  const state = { world: { chapterId: 'V33_1847_PRINT', date: '1847-06-01' }, quests: { PRINTSHOP_PROOF_1847: { status: 'open' } }, ledger: [] };
  assert.equal(continuationQuest(state, campaign, quests), null);
  state.quests.PRINTSHOP_PROOF_1847.status = 'resolved';
  state.ledger.push({ eventType: 'SOURCE_READ' }, { eventType: 'DIALOGUE_TURN' });
  assert.equal(continuationQuest(JSON.parse(JSON.stringify(state)), campaign, quests).id, 'PRINTSHOP_PROOF_1847');
  state.world.activeRealm = { id: 'LITERARY_OVERCOAT' };
  assert.equal(continuationQuest(state, campaign, quests), null);
  state.world.activeRealm = null;
  state.endingId = 'UVAROV';
  assert.equal(continuationQuest(state, campaign, quests), null);
});

test('April report offers date progression, May letter still requires a physical action', () => {
  const state = { world: { chapterId: 'V33_1849_CIRCLE', date: '1849-04-22' }, quests: {
    CIRCLE_INVESTIGATION_1849: { status: 'resolved' }, CIRCLE_LETTER_1849_MAY: { status: 'open' },
  } };
  assert.equal(continuationQuest(state, campaign, quests).id, 'CIRCLE_INVESTIGATION_1849');
  state.world.date = '1849-05-05';
  assert.equal(continuationQuest(state, campaign, quests), null);
  state.quests.CIRCLE_LETTER_1849_MAY.status = 'resolved';
  assert.equal(continuationQuest(state, campaign, quests).id, 'CIRCLE_LETTER_1849_MAY');
  state.quests.CIRCLE_INVESTIGATION_1849.status = 'open';
  assert.equal(continuationQuest(state, campaign, quests), null, 'later completion never bypasses an earlier open quest');
});
