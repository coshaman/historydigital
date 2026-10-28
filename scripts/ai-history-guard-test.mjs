import assert from 'node:assert/strict';
import test from 'node:test';
import lore from '../narrative/AI_LORE_CARDS.json' with { type: 'json' };
import scenarios from '../narrative/LATE_GAME_SCENARIOS.json' with { type: 'json' };
import sources from '../narrative/ACT_III_BRANCHING_SOURCES.json' with { type: 'json' };
import dialogue from '../narrative/MAIN_20MIN_DIALOGUE.json' with { type: 'json' };

const sourceIds = new Set([...sources.map(source => source.sourceId), ...dialogue.sourceRegister.map(source => source.sourceId), ...lore.externalSources.map(source => source.sourceId)]);
const claims = new Map(lore.claims.map(claim => [claim.id, claim]));
const dateValue = value => { const [year, month = 1, day = 1] = String(value).split('-').map(Number); return year * 10000 + month * 100 + day; };

test('all injected claims resolve to usable sources available by the scene date', () => {
  for (const scene of scenarios.scenes) for (const claimId of scene.allowedClaimIds) {
    const claim = claims.get(claimId); assert.ok(claim, `${scene.id}:${claimId}`);
    assert.notEqual(claim.npcUsable, false, `${scene.id}:${claimId} is narrator-only`);
    if (claim.claimClass !== 'FICTIONAL_CONTEXT') assert.ok(dateValue(scene.date) >= dateValue(claim.availableDate), `${scene.id}:${claimId} is future-dated`);
    for (const sourceId of claim.sourceIds) assert.ok(sourceIds.has(sourceId), `${claimId}:${sourceId} has no checked-in source`);
  }
});

test('bookshop inventory excludes sources not publicly available by the scene date', () => {
  const scene = scenarios.scenes.find(item => item.id === 'BOOKSHOP_01');
  for (const item of scene.items) {
    assert.ok(dateValue(scene.date) >= dateValue(item.availableDate), `${item.id} is future-dated`);
    assert.ok(item.sourceIds.every(id => sourceIds.has(id)), `${item.id} has missing provenance`);
  }
  assert.equal(scene.items.some(item => /LETTER|PRIVATE/i.test(item.id)), false);
});
