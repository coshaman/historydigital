import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const contentUrl = new URL('../narrative/ACT_III_LEARNING_EXAM.json', import.meta.url);
const sourcesUrl = new URL('../narrative/MAIN_20MIN_DIALOGUE.json', import.meta.url);
const extraSourcesUrl = new URL('../narrative/ACT_III_BRANCHING_SOURCES.json', import.meta.url);
const loreUrl = new URL('../narrative/AI_LORE_CARDS.json', import.meta.url);

async function loadContent() {
  return JSON.parse(await readFile(contentUrl, 'utf8'));
}

test('exam has a 10–15 uniquely sourced bank and each attempt remains five questions', async () => {
  const content = await loadContent();
  const sourceData = JSON.parse(await readFile(sourcesUrl, 'utf8'));
  const extraSources = JSON.parse(await readFile(extraSourcesUrl, 'utf8'));
  const lore = JSON.parse(await readFile(loreUrl, 'utf8'));
  const knownSources = new Set([...sourceData.sourceRegister.map((entry) => entry.sourceId), ...extraSources.map((entry) => entry.sourceId), ...lore.externalSources.map((entry) => entry.sourceId)]);
  assert.equal(content.questionCount, 5);
  assert.equal(content.passThreshold, 3);
  assert.ok(content.questions.length >= 10 && content.questions.length <= 15);
  assert.equal(content.questionBankCount, content.questions.length);
  assert.equal(new Set(content.questions.map((question) => question.id)).size, content.questions.length);
  for (const question of content.questions) {
    assert.ok(question.prompt.trim());
    assert.ok(question.learningUnitIds.length > 0, `${question.id} has a taught prerequisite`);
    assert.ok(question.sourceIds.length > 0, `${question.id} cites a source`);
    assert.ok(question.sourceIds.every((id) => knownSources.has(id)), `${question.id} uses known source IDs`);
    assert.ok(question.options.length >= 3);
    assert.equal(new Set(question.options.map((option) => option.id)).size, question.options.length);
    assert.ok(question.options.every((option) => option.text.trim()));
  }
  assert.deepEqual(Object.keys(content.answerKey).sort(), content.questions.map((question) => question.id).sort());
  for (const question of content.questions) {
    assert.equal(question.options.filter((option) => option.id === content.answerKey[question.id]).length, 1, `${question.id} has one valid keyed answer`);
  }
});

test('circle lesson and public preparation cover every examinable learning unit', async () => {
  const content = await loadContent();
  const unitIds = new Set(content.learningUnits.map((unit) => unit.id));
  assert.equal(unitIds.size, content.learningUnits.length);
  assert.ok(content.learningUnits.length >= 3);
  assert.ok(content.publicPrepUnitIds.length > 0);
  assert.ok(content.publicPrepUnitIds.every((id) => unitIds.has(id)));
  assert.ok(content.questions.every((question) => question.learningUnitIds.every((id) => unitIds.has(id))));
  const prepUnits = new Set(content.publicPrepUnitIds);
  assert.ok(content.questions.every((question) => question.learningUnitIds.some((id) => prepUnits.has(id))));
  for (const unit of content.learningUnits) {
    assert.ok(unit.title.trim() && unit.bodyKo.trim());
    assert.ok(unit.sourceIds.length > 0);
    assert.ok(unit.provenance?.startLocator && unit.provenance?.endLocator);
    assert.ok(unit.sourceIds.includes(unit.provenance.sourceId));
  }
});

test('learning data does not frame ideology, moral judgment, or literary interpretation as scored answers', async () => {
  const content = await loadContent();
  for (const question of content.questions) {
    assert.ok(['FACT', 'SOURCE_LITERACY', 'CHRONOLOGY'].includes(question.kind));
    assert.ok(question.answerRationale?.trim());
    assert.ok(question.rubric === undefined, 'no subjective rubric');
  }
});
