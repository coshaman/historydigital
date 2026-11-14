import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await readFile(path.join(root, 'data/event_catalog_45.json'), 'utf8'));
const csv = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
const allFiles = async (baseDir, relative = '') => {
  const rows = [];
  for (const entry of await readdir(path.join(root, baseDir, relative), { withFileTypes: true })) {
    const rel = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) rows.push(...await allFiles(baseDir, rel));
    else rows.push(path.posix.join(baseDir, rel));
  }
  return rows;
};
const scripts = await allFiles('scripts');
const artifacts = await allFiles('artifacts/v37').catch(() => []);
const artifactAliasesByEvent = {
  E13: ['market-price-dispute-choices-', 'market_price_dispute_browser_acceptance.json'],
};
const output = [[
  'event_id', 'title', 'source_status', 'engine_test_files', 'browser_script_files',
  'checked_in_browser_artifacts', 'full_trigger_to_followup_gate'
]];
for (const event of catalog) {
  const id = event.event_id;
  const matching = [];
  for (const file of scripts.filter(file => /\.mjs$/.test(file))) {
    const body = await readFile(path.join(root, file), 'utf8');
    if (body.includes(id)) matching.push(file);
  }
  const testFiles = matching.filter(file => /test|audit|replay/i.test(path.basename(file)));
  const browserFiles = matching.filter(file => /browser/i.test(path.basename(file)));
  const artifactNeedles = [id.toLowerCase(), ...(artifactAliasesByEvent[id] ?? []).map(value => value.toLowerCase())];
  const evidenceFiles = artifacts.filter(file => /\.(png|json)$/i.test(file)
    && artifactNeedles.some(needle => path.basename(file).toLowerCase().includes(needle)));
  output.push([
    id, event.title, event.validation_status ?? 'UNSPECIFIED',
    testFiles.join('|') || 'NONE_FOUND', browserFiles.join('|') || 'NONE_FOUND',
    evidenceFiles.join('|') || 'NONE_FOUND', 'NOT_ESTABLISHED_BY_FILE_PRESENCE'
  ]);
}
const target = path.join(root, 'docs/v37/45_EVENT_PLAYABILITY_MATRIX.csv');
await writeFile(target, `${output.map(row => row.map(csv).join(',')).join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ status: 'PASS', rows: catalog.length, output: path.relative(root, target),
  meaning: 'file discovery only; it does not claim each event was executed or source-verified' }));
