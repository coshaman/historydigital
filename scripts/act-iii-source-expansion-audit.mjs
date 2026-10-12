import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PRIMARY_CLASSES = new Set(['PRIMARY_DOCUMENT', 'PRIMARY_PUBLICATION', 'LITERARY_BORROWING']);
const REQUIRED = ['sourceId', 'sourceClass', 'witnessKey', 'authorOrIssuer', 'title', 'date', 'edition', 'holdingInstitution', 'locator', 'contextRange', 'translationStatus', 'availabilityDate', 'url', 'provenanceNote', 'sceneUsage'];

const canonicalUrl = value => {
  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    if (url.hostname.endsWith('wikisource.org') && url.pathname === '/w/index.php' && url.searchParams.has('title')) {
      const pageTitle = url.searchParams.get('title').replace(/\s+/g, '_');
      url.pathname = `/wiki/${pageTitle}`;
    }
    url.search = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().toLowerCase();
  } catch { return ''; }
};

const normalize = value => String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');

function flatten(value, out = []) {
  if (Array.isArray(value)) { for (const item of value) flatten(item, out); return out; }
  if (!value || typeof value !== 'object') return out;
  const id = value.sourceId ?? value.source_id ?? value.id;
  const url = value.url ?? value.stable_url ?? value.stableUrl ?? value.sourceUrl;
  const identityFields = [value.witnessKey, value.witness_key, value.title, value.title_ru, value.authorOrIssuer, value.author_or_issuer, value.date, value.edition, value.publication];
  if (id && url && identityFields.some(Boolean)) out.push(value);
  for (const [key, child] of Object.entries(value)) if (child && typeof child === 'object' && !['assets', 'images'].includes(key)) flatten(child, out);
  return out;
}

function baselineKeys(baselineFiles) {
  const sources = baselineFiles.flatMap(item => typeof item === 'string' ? flatten(item) : flatten(item));
  return {
    ids: new Set(sources.map(source => normalize(source.sourceId ?? source.source_id ?? source.id)).filter(Boolean)),
    urls: new Set(sources.map(source => canonicalUrl(source.url ?? source.stable_url ?? source.stableUrl ?? source.sourceUrl)).filter(Boolean)),
    witnesses: new Set(sources.map(source => normalize(source.witnessKey ?? source.witness_key ?? [source.authorOrIssuer ?? source.author_or_issuer, source.title ?? source.title_ru, source.date, source.edition ?? source.publication].filter(Boolean).join('|'))).filter(Boolean))
  };
}

function routeSourceIds(route) {
  const ids = new Set();
  const visit = value => {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object') return;
    for (const id of value.sourceIds ?? value.source_ids ?? []) ids.add(id);
    for (const id of value.eventSourceIds ?? value.event_source_ids ?? []) ids.add(id);
    for (const idsForChoice of Object.values(value.eventSourceIdsByChoice ?? {})) for (const id of idsForChoice ?? []) ids.add(id);
    if (value.sourceId) ids.add(value.sourceId);
    for (const [key, child] of Object.entries(value)) if (child && typeof child === 'object' && !['sources'].includes(key)) visit(child);
  };
  visit(route);
  return ids;
}

export function auditSourceExpansion({ baselineFiles = [], additions = [], route = {} }) {
  const errors = [];
  const baseline = baselineKeys(baselineFiles);
  const addedIds = new Set();
  const addedUrls = new Set();
  const addedWitnesses = new Set();
  const usedIds = routeSourceIds(route);

  for (const source of additions) {
    const id = normalize(source.sourceId);
    if (!id) { errors.push('record: missing sourceId'); continue; }
    if (addedIds.has(id) || baseline.ids.has(id)) errors.push(`${source.sourceId}: duplicate source ID`);
    addedIds.add(id);

    for (const field of REQUIRED) if (source[field] == null || source[field] === '' || (Array.isArray(source[field]) && !source[field].length)) errors.push(`${source.sourceId}: missing ${field}`);
    if (!PRIMARY_CLASSES.has(source.sourceClass)) errors.push(`${source.sourceId}: invalid source class ${source.sourceClass ?? '(missing)'}`);

    const url = canonicalUrl(source.url);
    if (!url) errors.push(`${source.sourceId}: invalid source URL`);
    if (baseline.urls.has(url) || addedUrls.has(url)) errors.push(`${source.sourceId}: duplicate source URL`);
    addedUrls.add(url);

    const witness = normalize(source.witnessKey);
    if (baseline.witnesses.has(witness) || addedWitnesses.has(witness)) errors.push(`${source.sourceId}: duplicate witness identity`);
    addedWitnesses.add(witness);

    const range = source.contextRange;
    if (!range || !Number.isInteger(range.paragraphStart) || !Number.isInteger(range.paragraphEnd) || range.paragraphEnd < range.paragraphStart || !range.speaker || !range.claim || !range.immediateIssue) errors.push(`${source.sourceId}: context range must be contiguous and identify speaker, claim, and immediate issue`);
    const ru = source.originalRussian;
    const ko = source.koreanTranslation;
    if (!Array.isArray(ru) || ru.length < 2 || ru.some((part, index) => !part.segmentId || !part.text?.trim() || part.order !== index + 1) || (range && ru.length !== range.paragraphEnd - range.paragraphStart + 1)) errors.push(`${source.sourceId}: original excerpt paragraphs must be a contiguous numbered sequence matching context range`);
    if (!Array.isArray(ko) || !Array.isArray(ru) || ko.length !== ru.length || ko.some((part, index) => !part.text?.trim() || part.segmentId !== ru[index]?.segmentId || part.order !== ru[index]?.order)) errors.push(`${source.sourceId}: translation segments do not align with original segments`);
    if (!/^\d{4}(-\d{2}(-\d{2})?)?$/.test(source.date ?? '')) errors.push(`${source.sourceId}: invalid source date`);
    if (!usedIds.has(source.sourceId)) errors.push(`${source.sourceId}: unused source; no active route usage`);
  }

  const uniqueCount = additions.filter(source => PRIMARY_CLASSES.has(source.sourceClass) && source.sourceId && !errors.some(error => error.startsWith(`${source.sourceId}:`))).length;
  return { uniqueCount, errors };
}

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return null; }
}

async function listJson(directory) {
  const found = [];
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); } catch { return found; }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await listJson(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) found.push(full);
  }
  return found;
}

export async function discoverBaselineFiles(root = ROOT) {
  const newContentPaths = new Set([
    path.resolve(root, 'narrative', 'ACT_III_BRANCHING_SOURCES.json'),
    path.resolve(root, 'narrative', 'E04_SCENE.json')
  ]);
  const files = [...await listJson(path.join(root, 'data')), ...await listJson(path.join(root, 'narrative'))].filter(file => !newContentPaths.has(path.resolve(file)));
  const parsed = await Promise.all(files.map(readJson));
  return parsed.flatMap(document => document ? flatten(document) : []);
}

async function main() {
  const additions = await readJson(path.join(ROOT, 'narrative', 'ACT_III_BRANCHING_SOURCES.json')) ?? [];
  const route = await readJson(path.join(ROOT, 'narrative', 'ACT_III_BRANCH_ROUTE.json')) ?? await readJson(path.join(ROOT, 'narrative', 'MAIN_20MIN_DIALOGUE.json')) ?? {};
  const result = auditSourceExpansion({ baselineFiles: await discoverBaselineFiles(), additions, route });
  console.log(`act-iii-source-audit: ${result.uniqueCount} net-new primary source records; ${result.errors.length} errors`);
  for (const error of result.errors) console.error(`- ${error}`);
  if (result.uniqueCount < 30) console.error(`- unique source count ${result.uniqueCount}, target >=30`);
  if (result.errors.length || result.uniqueCount < 30) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
