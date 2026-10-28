import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const scenarios = await readJson('../narrative/LATE_GAME_SCENARIOS.json');
const lore = await readJson('../narrative/AI_LORE_CARDS.json');
const exam = await readJson('../narrative/ACT_III_LEARNING_EXAM.json');
const sources = await readJson('../narrative/ACT_III_BRANCHING_SOURCES.json');
const dialogue = await readJson('../narrative/MAIN_20MIN_DIALOGUE.json');
const sourceById = new Map([...sources, ...dialogue.sourceRegister].map(item => [item.sourceId, item]));
const claimById = new Map(lore.claims.map(claim => [claim.id, claim]));

function dateValue(date) {
  const parts = String(date).split('-').map(Number);
  return parts[0] * 10000 + (parts[1] || 1) * 100 + (parts[2] || 1);
}

test('all late-game scene cards have stable IDs, source records and allowed claim lists', () => {
  const ids = scenarios.scenes.map(scene => scene.id);
  assert.deepEqual(ids, ['CIRCLE_01', 'BOOKSHOP_01', 'SUPPER_01', 'READING_01', 'EXAM_01']);
  for (const scene of scenarios.scenes) {
    assert.ok(scene.date);
    assert.ok(scene.allowedClaimIds.length > 0);
    for (const id of scene.allowedClaimIds) {
      assert.ok(claimById.has(id), `${scene.id}: ${id}`);
      assert.notEqual(claimById.get(id).npcUsable, false, `${scene.id}: untrusted narrator-only claim ${id}`);
    }
    for (const id of scene.sourceIds) assert.ok(sourceById.has(id) || lore.externalSources.some(source => source.sourceId === id), `${scene.id}: ${id}`);
  }
});

test('source claims and reading excerpts are available by scene date and keep provenance classes distinct', () => {
  for (const scene of scenarios.scenes) {
    for (const claimId of scene.allowedClaimIds) {
      const claim = claimById.get(claimId);
      if (claim.claimClass !== 'FICTIONAL_CONTEXT') assert.ok(claim.sourceIds.length > 0, claimId);
      assert.ok(['DOCUMENTED_FACT', 'SOURCE_BASED_INTERPRETATION', 'FICTIONAL_CONTEXT'].includes(claim.claimClass), claimId);
      for (const id of claim.sourceIds) {
        const source = sourceById.get(id) ?? lore.externalSources.find(item => item.sourceId === id);
        assert.ok(source, `${claimId}: missing ${id}`);
        const available = source.availabilityDate ?? source.availableDate;
        if (available && source.sourceClass !== 'SECONDARY_HISTORICAL_SYNTHESIS') assert.ok(dateValue(scene.date) >= dateValue(available), `${scene.id} predates ${id}`);
      }
    }
  }
  const reading = scenarios.scenes.find(scene => scene.id === 'READING_01');
  assert.ok(reading.excerpts.length > 0);
  for (const excerpt of reading.excerpts) {
    const source = sourceById.get(excerpt.sourceId);
    assert.ok(source?.originalRussian?.length);
    assert.ok(source?.koreanTranslation?.length);
    assert.ok(excerpt.locator && excerpt.sourceClass);
    assert.equal(excerpt.sourceClass, source.sourceClass);
    assert.deepEqual(excerpt.segmentIds, source.originalRussian.map(segment => segment.segmentId));
  }
});

test('modern Petrashevsky synthesis is dated to its 2021 publication and never enters period character dialogue', () => {
  const source = sourceById.get('V42-PETRASHEVSKY-SYNTHESIS-2021');
  const claim = claimById.get('CLAIM_FRIDAY_READING_SYNTHESIS');
  assert.equal(source.sourceClass, 'SECONDARY_HISTORICAL_SYNTHESIS');
  assert.equal(source.availableDate, '2021-01-21');
  assert.equal(claim.npcUsable, false);
  assert.equal(claim.availableDate, '2021-01-21');
});

test('bookshop inventory has three date-available items and excludes private/future circulation', () => {
  const shop = scenarios.scenes.find(scene => scene.id === 'BOOKSHOP_01');
  assert.ok(shop.items.length >= 3 && shop.items.length <= 5);
  for (const item of shop.items) {
    assert.ok(dateValue(shop.date) >= dateValue(item.availableDate), item.id);
    assert.ok(item.sourceIds.length > 0, item.id);
  }
  assert.equal(shop.items.some(item => /BELINSKY-1847|PRIVATE_LETTER/i.test(`${item.id} ${item.sourceIds.join(' ')}`)), false);
});

test('exam bank contains 10–15 source-backed questions, with a fixed five-question attempt and 3/5 threshold', () => {
  assert.ok(exam.questions.length >= 10 && exam.questions.length <= 15);
  assert.equal(exam.questionCount, 5);
  assert.equal(exam.passThreshold, 3);
  assert.equal(Object.keys(exam.answerKey).length, exam.questions.length);
  for (const question of exam.questions) {
    assert.ok(question.sourceIds.length > 0, question.id);
    assert.ok(question.learningUnitIds.length > 0, question.id);
    assert.ok(question.kind, question.id);
    assert.equal(question.options.filter(option => option.id === exam.answerKey[question.id]).length, 1, question.id);
  }
});

test('the public preparation material covers every exam question and claim source', () => {
  const taught = new Set(exam.learningUnits.map(unit => unit.id));
  const publicPrep = new Set(exam.publicPrepUnitIds);
  for (const question of exam.questions) {
    for (const id of question.learningUnitIds) {
      assert.ok(taught.has(id), `${question.id}: missing taught unit ${id}`);
      assert.ok(publicPrep.has(id), `${question.id}: not in public preparation`);
    }
    for (const id of question.sourceIds) assert.ok(sourceById.has(id) || lore.externalSources.some(source => source.sourceId === id), `${question.id}: unknown source ${id}`);
  }
});
