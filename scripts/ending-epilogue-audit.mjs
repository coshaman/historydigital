import { readFile } from 'node:fs/promises';

const content = JSON.parse(await readFile(new URL('../data/content.json', import.meta.url)));
const failures = [];
for (const ending of content.endings) {
  const text = `${ending.epilogue ?? ending.reconstructed ?? ''}${content.epilogueAddenda?.[ending.id] ?? ''}`;
  if (text.length < 800 || text.length > 1200) failures.push(`${ending.id}: epilogue length ${text.length}, expected 800–1200`);
  if ((ending.hardGates?.length ?? 0) < 4) failures.push(`${ending.id}: fewer than 4 hard gates`);
  if ((ending.softConditions?.length ?? 0) < 2) failures.push(`${ending.id}: fewer than 2 soft conditions`);
  if ((ending.callbacks?.length ?? 0) < 5) failures.push(`${ending.id}: fewer than 5 callbacks`);
  if ((ending.contextCards?.length ?? 0) < 3) failures.push(`${ending.id}: fewer than 3 context cards`);
}
console.log(JSON.stringify({ endings: content.endings.length, lengths: content.endings.map(e => ({ id: e.id, length: `${e.epilogue ?? e.reconstructed ?? ''}${content.epilogueAddenda?.[e.id] ?? ''}`.length })), failures }, null, 2));
if (content.endings.length !== 5) failures.push(`ending count ${content.endings.length}, expected exactly 5`);
if (failures.length) process.exit(1);
console.log('ending-epilogue-audit: five 800–1200 character epilogues, gates, callbacks, and context cards — PASS');
