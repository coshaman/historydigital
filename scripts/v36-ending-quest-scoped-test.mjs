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
state.ledger.push({ eventType: 'HISTORICAL_ACTION', questId: 'CIRCLE_LETTER_1849_MAY', actionId: 'REFUSE_NAMING' });
const final = resolveEnding(state, 'DOSTOEVSKY_PETRASHEVSKY', campaign);
assert.equal(final.ok, true, 'the same action is accepted when it belongs to the final-letter quest');
assert.equal(final.state.endingId, 'DOSTOEVSKY_PETRASHEVSKY');
console.log(JSON.stringify({ status: 'PASS', duplicateActionIdRejectedAcrossQuests: true, finalLetterActionAccepted: true }));
