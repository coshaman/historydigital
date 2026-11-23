import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const { resolveEnding } = globalThis.V33GameState;
const campaign = JSON.parse(await readFile('rpg/quests/campaign.json', 'utf8'));
const state = {
  endingId: null,
  learning: { phase: 'complete', examOutcome: 'passed' },
  quests: Object.fromEntries(campaign.arcs.flatMap(arc => arc.questIds).map(id => [id, { status: 'resolved' }])),
  world: { possessionHistory: ['clerk_alexei', 'printer_ekaterina', 'courier_pavel', 'bookseller_lev'].map(hostId => ({ hostId })) },
  hosts: Object.fromEntries(['clerk_alexei', 'printer_ekaterina', 'courier_pavel', 'bookseller_lev'].map(id => [id, { kind: 'CITIZEN' }])),
  ledger: [
    { eventType: 'SOURCE_READ', sourceIds: ['S1', 'S2', 'S3'] },
    { eventType: 'HISTORICAL_ACTION', questId: 'CIRCLE_INVESTIGATION_1849', actionId: 'REFUSE_NAMING' },
  ],
};

const premature = resolveEnding(state, 'DOSTOEVSKY_PETRASHEVSKY', campaign);
assert.equal(premature.ok, false, 'the investigation-stage action cannot unlock the final-letter ending');
assert.equal(premature.reason, 'route_evidence_missing');
const heldNotice = [
  { eventType: 'HISTORICAL_ACTION', questId: 'PUBLIC_DISCOURSE_1848', actionId: 'HOLD_NOTICE' },
  { eventType: 'HISTORICAL_ACTION', questId: 'CIRCLE_LETTER_1849_MAY', actionId: 'PRESERVE_LETTER' },
];
for (const proofAction of ['RETURN_MANUSCRIPT', 'HOLD_FOR_CORRECTION']) {
  const proof = { eventType: 'HISTORICAL_ACTION', questId: 'PRINTSHOP_PROOF_1847', actionId: proofAction };
  for (const [actionId, endingId] of [
    ['REFUSE_NAMING', 'DOSTOEVSKY_PETRASHEVSKY'],
    ['REGISTER_SEPARATE_OWNERSHIP', 'UVAROV'],
  ]) {
    const investigation = { eventType: 'HISTORICAL_ACTION', questId: 'CIRCLE_INVESTIGATION_1849', actionId };
    const result = resolveEnding({ ...state, ledger: [state.ledger[0], proof, ...heldNotice, investigation] }, endingId, campaign);
    assert.equal(result.ok, true, `${proofAction} / ${actionId} has a matching ending`);
    assert.equal(result.state.endingId, endingId);
  }
}
state.ledger.push({ eventType: 'HISTORICAL_ACTION', questId: 'CIRCLE_LETTER_1849_MAY', actionId: 'REFUSE_NAMING' });
const final = resolveEnding(state, 'DOSTOEVSKY_PETRASHEVSKY', campaign);
assert.equal(final.ok, true, 'the same action is accepted when it belongs to the final-letter quest');
assert.equal(final.state.endingId, 'DOSTOEVSKY_PETRASHEVSKY');
const questFiles = ['printshop-article', 'public-discourse-1848', 'circle-letter-1849-may', 'circle-investigation-1849'];
const endingQuests = await Promise.all(questFiles.map(file => readFile(`rpg/quests/${file}.json`, 'utf8').then(JSON.parse)));
const decisionSequences = endingQuests.reduce((sequences, quest) => sequences.flatMap(sequence => quest.actions.map(action => [
  ...sequence, { eventType: 'HISTORICAL_ACTION', questId: quest.id, actionId: action.id },
])), [[]]);
assert.equal(decisionSequences.length, 54);
for (const sequence of decisionSequences) {
  const completedCampaign = { ...state, ledger: [state.ledger[0], ...sequence] };
  assert.ok(campaign.endings.some(ending => resolveEnding(completedCampaign, ending.id, campaign).ok),
    `at least one ending has matching evidence: ${sequence.map(row => row.actionId).join(' / ')}`);
}
console.log(JSON.stringify({ status: 'PASS', decisionSequences: decisionSequences.length, unmatchedSequences: 0,
  duplicateActionIdRejectedAcrossQuests: true, finalLetterActionAccepted: true }));
