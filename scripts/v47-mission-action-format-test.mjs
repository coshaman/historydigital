import assert from 'node:assert/strict';
import test from 'node:test';
import { formatMissionActionKo } from '../rpg/engine/quest-guidance.mjs';

test('mission guidance shows a destination once and keeps travel instructions concise', () => {
  assert.equal(
    formatMissionActionKo({ actionKo: '표시된 출구로 이동하세요', placeKo: '책방 안쪽' }),
    '표시된 출구로 이동하세요 · 책방 안쪽',
  );
  assert.equal(
    formatMissionActionKo({ actionKo: '표시된 출구로 이동하세요 · 책방 안쪽', placeKo: '책방 안쪽' }),
    '표시된 출구로 이동하세요 · 책방 안쪽',
  );
  assert.equal(formatMissionActionKo({ actionKo: '「예약 장부」 곁에서 살펴보세요' }), '「예약 장부」 곁에서 살펴보세요');
});
