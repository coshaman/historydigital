import fs from 'node:fs';
import path from 'node:path';

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'narrative', 'MAIN_20MIN_DIALOGUE.json'), 'utf8'));
const failures = [];
const sources = data.sourceRegister || [];
const ranges = data.sourceContextRanges || {};
const required = ['V42-UVAROV-1833', 'V42-TABLE-OF-RANKS', 'V42-CHAADAEV-1836', 'V42-WESTERNIZER-PRIMARY', 'V42-SLAVOPHILE-PRIMARY', 'V42-GOGOL-1847', 'V42-BELINSKY-1847', 'V42-PETRASHEVSKY-SYNTHESIS-2021'];
for (const id of required) {
  const source = sources.find((item) => item.sourceId === id);
  if (!source) { failures.push(`${id}: source missing`); continue; }
  for (const field of ['date', 'edition', 'locator', 'originalRussian', 'koreanTranslation', 'classification', 'availableDate', 'url']) if (!source[field]) failures.push(`${id}: missing ${field}`);
  if (!['DIRECT', 'PARAPHRASE', 'DIRECT_SECONDARY'].includes(source.classification)) failures.push(`${id}: invalid classification`);
  if (!source.contextRangeId || !ranges[source.contextRangeId]) failures.push(`${id}: missing contextRangeId`);
}
for (const [id, range] of Object.entries(ranges)) {
  if (range.type !== 'CONTIGUOUS_WITNESS_RANGE') failures.push(`${id}: not contiguous witness range`);
  for (const field of ['sourceId', 'startLocator', 'endLocator', 'paragraphCount', 'ruRef', 'koRef', 'contextPurpose']) if (!range[field]) failures.push(`${id}: missing ${field}`);
  if (range.paragraphCount < 2) failures.push(`${id}: context must contain surrounding contiguous text (paragraphCount >= 2)`);
}
if (failures.length) {
  console.error(`V42 source context audit: FAIL (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else console.log('V42 source context audit: PASS');
