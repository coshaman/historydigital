const pages = [
  ['OBJ-WS-HERZEN-1847', 'Кто виноват? (Герцен)'],
  ['OBJ-WS-BELINSKY-1847', 'Письмо Н. В. Гоголю 15 июля 1847 г. (Белинский)'],
  ['OBJ-WS-GOGOL-1847', 'Письмо В. Г. Белинскому июль — август 1847 г. (Гоголь)']
];

function cleanWikitext(value) {
  return value
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, ' ')
    .replace(/\{\{[^{}]*\}\}/g, ' ')
    .replace(/\[\[([^|\]]*\|)?([^\]]+)\]\]/g, '$2')
    .replace(/\[https?:[^ ]+ ([^\]]+)\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/^=+.*?=+$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const candidates = [];
const seen = new Set();
const { readFile } = await import('node:fs/promises');
let existingExcerptTexts = new Set();
try {
  const manifest = JSON.parse(await readFile(new URL('../data/corpus-manifest.json', import.meta.url)));
  existingExcerptTexts = new Set((manifest.excerptUnits ?? []).map(unit => `${unit.sourceObjectId}:${unit.ru_excerpt}`));
} catch {}
for (const [sourceObjectId, page] of pages) {
  const url = new URL('https://ru.wikisource.org/w/api.php');
  url.search = new URLSearchParams({ action: 'parse', page, prop: 'wikitext', format: 'json' });
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${page}: HTTP ${response.status}`);
  const payload = await response.json();
  const text = cleanWikitext(payload.parse?.wikitext?.['*'] ?? '');
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const ru_excerpt = sentence.trim();
    const cleanCandidate = ru_excerpt.replace(/\s+([.,!?;:])/g, '$1');
    if (/[А-Яа-яЁё]/.test(cleanCandidate) && cleanCandidate.length >= 35 && cleanCandidate.length <= 360 && !/[{}<>|*_\[\]]/.test(cleanCandidate)) {
      const key = `${sourceObjectId}:${cleanCandidate}`;
      if (!seen.has(key) && !existingExcerptTexts.has(key)) {
        seen.add(key);
        candidates.push({ sourceObjectId, page, ru_excerpt: cleanCandidate });
      }
    }
  }
}

const output = candidates.slice(0, 220).map((candidate, index) => ({
  id: `EX-CANDIDATE-${String(index + 1).padStart(3, '0')}`,
  sourceObjectId: candidate.sourceObjectId,
  locator: `Wikisource sentence candidate ${index + 1}`,
  ru_excerpt: candidate.ru_excerpt,
  source_context_note: 'Raw sentence candidate harvested from the cited Wikisource transcription; Korean review is pending.',
  evidence_class: 'DIRECT',
  translation_status: 'translation_pending'
}));
if (process.argv.includes('--write')) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(new URL('../data/excerpt-candidates.json', import.meta.url), `${JSON.stringify(output, null, 2)}\n`);
}
console.log(JSON.stringify({ candidates: output.length, wroteFile: process.argv.includes('--write') }, null, 2));
