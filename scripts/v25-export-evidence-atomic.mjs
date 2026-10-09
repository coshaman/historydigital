import { readFile, writeFile, mkdir } from 'node:fs/promises';
await mkdir('docs/v25/data', { recursive: true });
const manifest = JSON.parse(await readFile('data/v25-pilot-cases.json', 'utf8'));
const rows = [];
for (const caseData of manifest.cases) for (const source of caseData.sources) {
  const excerpts = caseData.excerpts.filter((excerpt) => excerpt.sourceId === source.sourceId);
  for (const excerpt of (excerpts.length ? excerpts : [{ excerptId: null, ru: null, ko: null }])) rows.push({
    caseId: caseData.caseId, sceneId: caseData.sceneId, itemId: `${caseData.caseId}:${source.sourceId}:${excerpt.excerptId || 'NO_EXCERPT'}`, sourceId: source.sourceId, excerptId: excerpt.excerptId, historicalIssueId: caseData.caseId, sourceRole: source.sourceType, author: source.titleRu, titleRu: source.titleRu, titleKo: source.titleKo, publication: source.publication, publicationDate: source.date, censorshipPermissionDate: 'NOT_STATED', datePrecision: 'as-source', sourceEarliestDate: source.date, sourceLatestDate: source.date, sceneEarliestDate: caseData.date, archiveOrEdition: source.publication, exactVolumeIssuePageOrFolio: source.locator, editionWitness: source.witness, firstPublicationOrLaterReprint: 'see source record', witnessTextStatus: excerpt.excerptId ? 'VERIFIED_EXCERPT' : 'METADATA_ONLY', stableSourceUrl: source.url, sourceImageUrl: null, evidenceImageCapability: source.imageStatus, rightsAndReuseStatus: source.rights, sourceArrivalBasis: 'reconstructed workflow; source page and date recorded', ruFull: excerpt.ru, koFull: excerpt.ko, historicalContext: caseData.question, runtimeVisible: Boolean(excerpt.excerptId), completenessStatus: excerpt.excerptId ? 'VERIFIED_EXCERPT' : 'METADATA_ONLY'
  });
}
await writeFile('docs/v25/data/FULL_SOURCE_WITNESSES.json', JSON.stringify(rows, null, 2));
const quote = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const columns = ['caseId', 'sceneId', 'itemId', 'sourceId', 'excerptId', 'historicalIssueId', 'sourceRole', 'author', 'titleRu', 'titleKo', 'publication', 'publicationDate', 'censorshipPermissionDate', 'datePrecision', 'sourceEarliestDate', 'sourceLatestDate', 'sceneEarliestDate', 'archiveOrEdition', 'exactVolumeIssuePageOrFolio', 'editionWitness', 'firstPublicationOrLaterReprint', 'witnessTextStatus', 'stableSourceUrl', 'sourceImageUrl', 'evidenceImageCapability', 'rightsAndReuseStatus', 'sourceArrivalBasis', 'ruFull', 'koFull', 'historicalContext', 'runtimeVisible', 'completenessStatus'];
await writeFile('docs/v25/data/FULL_SOURCE_WITNESSES.csv', [columns.join(','), ...rows.map((row) => columns.map((column) => quote(row[column])).join(','))].join('\r\n') + '\r\n');
console.log(JSON.stringify({ sourceWitnessRows: rows.length }));
