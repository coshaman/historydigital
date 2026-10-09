import { readFile, writeFile } from 'node:fs/promises';
const rows = JSON.parse(await readFile('docs/v25/data/FULL_SOURCE_WITNESSES.json', 'utf8'));
const columns = ['caseId', 'sceneId', 'sourceId', 'excerptId', 'sourceRole', 'titleRu', 'titleKo', 'publication', 'publicationDate', 'exactVolumeIssuePageOrFolio', 'editionWitness', 'witnessTextStatus', 'stableSourceUrl', 'sourceImageUrl', 'evidenceImageCapability', 'ruFull', 'koFull', 'completenessStatus'];
const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = [columns.join(','), ...rows.map((row) => columns.map((column) => {
  const value = Array.isArray(row[column]) ? row[column].join(' || ') : row[column];
  return quote(value);
}).join(','))].join('\r\n') + '\r\n';
await writeFile('docs/v25/data/FULL_SOURCE_WITNESSES.csv', csv);
console.log(`FULL_SOURCE_WITNESSES.csv rows=${rows.length}`);
