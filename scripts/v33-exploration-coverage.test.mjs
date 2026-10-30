import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeExplorationCoverage } from './v33-exploration-coverage.mjs';

test('elapsed waiting cannot qualify as goal-directed exploration', () => {
  const result = summarizeExplorationCoverage([{ type: 'wait', milliseconds: 180_000 }]);

  assert.equal(result.goalDirected, false);
  assert.equal(result.movementInputs, 0);
});

test('a route qualifies only after real movement, reading, perspective, map, and quest interactions', () => {
  const events = [
    { type: 'move', count: 28 },
    { type: 'inspect', count: 4 },
    { type: 'read_source', count: 2 },
    { type: 'possess', hostId: 'courier_pavel' },
    { type: 'possess', hostId: 'printer_ekaterina' },
    { type: 'map_transition' },
    { type: 'quest_choice' },
  ];

  const result = summarizeExplorationCoverage(events);

  assert.equal(result.goalDirected, true);
  assert.deepEqual(result.hostIds, ['courier_pavel', 'printer_ekaterina']);
  assert.equal(result.sourceReads, 2);
});

test('one-host or source-free play cannot qualify as cross-perspective exploration', () => {
  const result = summarizeExplorationCoverage([
    { type: 'move', count: 40 },
    { type: 'inspect', count: 8 },
    { type: 'read_source', count: 2 },
    { type: 'possess', hostId: 'courier_pavel' },
    { type: 'map_transition' },
    { type: 'quest_choice' },
  ]);

  assert.equal(result.goalDirected, false);
});

test('reading and switching hosts without purposeful movement cannot satisfy the exploration gate', () => {
  const result = summarizeExplorationCoverage([
    { type: 'read_source', count: 3 },
    { type: 'possess', hostId: 'courier_pavel' },
    { type: 'possess', hostId: 'printer_ekaterina' },
    { type: 'map_transition' },
    { type: 'quest_choice' },
  ]);

  assert.equal(result.goalDirected, false);
  assert.equal(result.movementInputs, 0);
});
