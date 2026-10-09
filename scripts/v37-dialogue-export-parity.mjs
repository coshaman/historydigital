import fs from 'node:fs';
import crypto from 'node:crypto';

const sourcePath = 'narrative/MAIN_20MIN_DIALOGUE.json';
const sourceBuffer = fs.readFileSync(sourcePath);
const data = JSON.parse(sourceBuffer.toString('utf8'));
const manifest = JSON.parse(fs.readFileSync('docs/v36/MAIN20_EXPORT_MANIFEST.json', 'utf8'));
const markdown = fs.readFileSync('docs/v36/MAIN_20MIN_DIALOGUE_ALL.md', 'utf8');
const tsv = fs.readFileSync('docs/v36/MAIN_20MIN_DIALOGUE_ALL.tsv', 'utf8').trimEnd().split('\n');
const expected = [];
for (const scene of data.scenes) {
  scene.intro.forEach(([speaker, text], index) => expected.push({ sceneId: scene.id, nodeId: `${scene.id}-INTRO-${index + 1}`, kind: 'intro', speaker, text }));
  for (const choice of scene.choices) expected.push({ sceneId: scene.id, nodeId: choice.id, kind: 'pre_read_choice', action: choice.action });
  for (const excerpt of scene.excerpts) expected.push({ sceneId: scene.id, nodeId: excerpt.excerptId, kind: 'substantive_excerpt', sourceId: excerpt.sourceId, text: excerpt.ru, translation: excerpt.ko });
  for (const choice of scene.postChoices) expected.push({ sceneId: scene.id, nodeId: choice.id, kind: 'post_read_choice', action: choice.action });
}
const fields = tsv[0]?.split('\t') || [];
const rows = tsv.slice(1).map((line) => Object.fromEntries(fields.map((field, index) => [field, line.split('\t')[index] || ''])));
const sourceSha256 = crypto.createHash('sha256').update(sourceBuffer).digest('hex');
const rowParity = expected.length === rows.length && expected.every((item, index) => {
  const actual = rows[index];
  return actual?.sceneId === item.sceneId && actual?.nodeId === item.nodeId && actual?.kind === item.kind &&
    (!item.action || actual.action === item.action) && (!item.sourceId || actual.sourceId === item.sourceId) &&
    (!item.text || actual.text === item.text.replaceAll('\t', ' ').replaceAll('\r', ' ').replaceAll('\n', '')) &&
    (!item.translation || actual.translation === item.translation.replaceAll('\t', ' ').replaceAll('\r', ' ').replaceAll('\n', ''));
});
const markdownCoverage = expected.every((item) => item.kind === 'intro' ? markdown.includes(item.text) : markdown.includes(item.nodeId));
const report = { schemaVersion: 'V37-DIALOGUE-EXPORT-PARITY-1', status: sourceSha256 === manifest.sourceSha256 && rows.length === manifest.dialogueRows && rowParity && markdownCoverage ? 'PASS' : 'FAIL', sourceSha256, markdown: 'docs/v36/MAIN_20MIN_DIALOGUE_ALL.md', tsv: 'docs/v36/MAIN_20MIN_DIALOGUE_ALL.tsv', expectedRows: expected.length, markdownCoverage, tsvRows: rows.length, rowParity, manifestRows: manifest.dialogueRows };
fs.mkdirSync('docs/v37', { recursive: true });
fs.writeFileSync('docs/v37/DIALOGUE_EXPORT_PARITY.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exit(1);
