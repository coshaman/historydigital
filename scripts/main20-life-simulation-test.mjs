import assert from 'node:assert/strict';
import test from 'node:test';
import '../main20-life-simulation.js';
import templates from '../narrative/ACT_III_LIFE_SIMULATION.json' with { type: 'json' };

const { buildLifeTimeline } = globalThis.Main20LifeSimulation || {};

function state({ examOutcome = 'passed', circleContact = 'attended', literatureAction = 'public-discussion', newsAction = 'filed', ekaterina = 0, endingId = 'UVAROV' } = {}) {
  return {
    examOutcome,
    examCorrectCount: examOutcome === 'passed' ? 4 : examOutcome === 'failed' ? 2 : null,
    promotionStatus: examOutcome === 'passed' ? 'promoted' : examOutcome === 'failed' ? 'not-promoted' : 'pending',
    branchState: { circleContact, literatureAction, newsAction, officialTrace: newsAction === 'filed' ? 2 : 1 },
    relationships: { ekaterina },
    endingId
  };
}

test('every simulated future has seven deterministic, explicitly fictional episodes', () => {
  const first = buildLifeTimeline(state(), templates);
  assert.equal(first.length, 7);
  assert.deepEqual(buildLifeTimeline(state(), templates), first);
  assert.equal(new Set(first.map((episode) => episode.id)).size, 7);
  assert.ok(first.every((episode) => episode.fictional === true && episode.textKo.trim() && episode.basis.length));
  assert.deepEqual(first.map((episode) => episode.year), [1850, 1852, 1855, 1858, 1862, 1868, 1874]);
});

test('exam, circle, work choices, and relationship state shape later episodes', () => {
  const passed = buildLifeTimeline(state(), templates);
  const failed = buildLifeTimeline(state({ examOutcome: 'failed', circleContact: 'declined', literatureAction: 'private-reading', newsAction: 'shared', ekaterina: 1 }), templates);
  assert.notEqual(passed[0].textKo, failed[0].textKo);
  assert.notEqual(passed[1].textKo, failed[1].textKo);
  assert.notEqual(passed[2].textKo, failed[2].textKo);
  assert.notEqual(passed[3].textKo, failed[3].textKo);
  assert.notEqual(passed[5].textKo, failed[5].textKo);
});

test('deferred and peer-help paths remain unscored and receive distinct fictional aftermath', () => {
  const deferred = buildLifeTimeline(state({ examOutcome: 'deferred' }), templates);
  const peer = buildLifeTimeline(state({ examOutcome: 'helped-peer' }), templates);
  assert.notEqual(deferred[0].textKo, peer[0].textKo);
  for (const route of [deferred, peer]) assert.ok(route.every((episode) => !episode.textKo.includes('점수는')));
});

test('timeline templates contain no unregistered historical claims or non-fiction episodes', () => {
  for (const period of templates.periods) {
    const episodes = [period.default, ...Object.values(period.variants || {})];
    for (const episode of episodes) {
      assert.equal(episode.fictional, true);
      assert.ok(episode.basis.length > 0);
      assert.equal(episode.historicalClaim, undefined);
    }
  }
});
