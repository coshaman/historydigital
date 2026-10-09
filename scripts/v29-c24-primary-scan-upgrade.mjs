import fs from 'node:fs/promises';

const path = 'data/v27-case-bundle.json';
const bundle = JSON.parse(await fs.readFile(path, 'utf8'));
const item = bundle.cases.find(entry => entry.caseId === 'C24');
if (!item) throw new Error('C24 missing');
const archiveUrl = 'https://statearchive.ru/722';
const scan128 = 'https://statearchive.ru/assets/images/2016/petrashevsky/img128a.jpg';
const scan129 = 'https://statearchive.ru/assets/images/2016/petrashevsky/img129.jpg';
const direct = (excerptId, locator, ru, ko, scanUrl) => ({
  excerptId,
  sourceId: 'OBJ-PETRASHEVSKY-1849',
  locator,
  ru,
  ko,
  context: '1849년 당시 작성된 ГА РФ архивный список의 스캔에서 확인한 최소 전사',
  evidence: 'DIRECT_PRIMARY_SCAN',
  quotationStatus: 'DIRECT',
  translationReview: 'REVIEWED_FROM_SCAN',
  materialStatus: 'PRIMARY_ARCHIVAL_SCAN',
  reason: 'The quoted characters are limited to text visibly present in the linked GARF scan; no modern narrative sentence is presented as the quotation.',
  scanUrl,
  sourcePageUrl: archiveUrl
});
const modern = (excerptId, locator, ru, ko) => ({
  excerptId,
  sourceId: 'OBJ-PETRASHEVSKY-1849',
  locator,
  ru,
  ko,
  context: 'ГА РФ 현대 안내 페이지의 문서·폴리오 식별 설명',
  evidence: 'MODERN_COMMENTARY_OR_ARCHIVE_DESCRIPTION',
  quotationStatus: 'NOT_A_DIRECT_QUOTATION',
  translationReview: 'REVIEWED',
  materialStatus: 'ARCHIVE_DESCRIPTION_ONLY',
  reason: 'This is a modern archive description and remains visibly labeled as such; it is not presented as 1849 wording.',
  sourcePageUrl: archiveUrl
});
item.sources = item.sources.map(source => source.sourceId === 'OBJ-PETRASHEVSKY-1849' ? {
  ...source,
  materialStatus: 'PRIMARY_SCAN_AND_MODERN_GUIDE',
  sceneRole: 'IN_WORLD',
  sourceRole: 'PRIMARY_ARCHIVAL_DOCUMENT_WITH_MODERN_GUIDE',
  displayCapability: 'PRIMARY_SCAN_AND_ARCHIVE_DESCRIPTION',
  scanUrl: scan128,
  scanUrls: [scan128, scan129],
  acquisitionBasis: 'ГАРФ official page identifies the file and links scans of folios 128-129; direct text is restricted to visibly transcribed scan text.'
} : source);
item.excerpts = [
  direct('V26-C24-X1', 'Ф.109 Оп.24 Д.214 ч.I, Лл.128-129, img128a.jpg header', 'Имена преступников осужденных насмертную казнь, находящихся в крепости с 1848-го года и конченных в 1849 года Декабря 22 дня за возмущение в столице.', '사형을 선고받고 요새에 수감되어 있던 범죄자들 가운데, 수도의 소요로 1849년 12월 22일 처분이 끝난 사람들의 이름.', scan128),
  modern('V26-C24-X2', 'ГА РФ 안내 페이지; document identification, lines 65-71', 'Дело «По розысканию Липранди и донесениям Антонелли о Буташевиче-Петрашевском и его товарищах: часть I-я».', '「리프란디의 수사 및 안토넬리의 보고에 관한 사건: 부타셰비치-페트라셰프스키와 동료들, 제1부」라는 사건철.',),
  direct('V26-C24-X3', 'Ф.109 Оп.24 Д.214 ч.I, Лл.128-129, img129.jpg, row transcription', 'Федор Михайлович Достоевский (26 лет)', '표도르 미하일로비치 도스토옙스키 (26세)', scan129),
  direct('V26-C24-X4', 'Ф.109 Оп.24 Д.214 ч.I, Лл.128-129, img128a.jpg, first-row name', 'Михаил Васильевич Петрашевский', '미하일 바실리예비치 페트라셰프스키', scan128),
  modern('V26-C24-X5', 'ГА РФ 안내 페이지; folio locator, lines 67-76', 'Копия с извлечений, сделанных из донесений Антонелли; Ф.109. Оп.24. Д.214. ч. I, л. 3-20, 44-54, 128-129.', '안토넬리 보고서에서 만든 발췌 사본; Ф.109 Оп.24 Д.214 제1부, 3–20·44–54·128–129쪽.',)
];
item.provenance = {
  sourceRecordIds: ['OBJ-PETRASHEVSKY-1849'],
  directExcerptCount: 3,
  modernArchiveDescriptionCount: 2,
  note: 'Three short direct transcriptions are restricted to the GARF scan header/name rows; the two contextual records remain explicitly modern archive descriptions.'
};
item.historicalAudit = { checkedAt: new Date().toISOString().slice(0, 10), sourceFirst: true, normalRun: true, scanReview: 'GARF img128a.jpg and img129.jpg visually checked' };
await fs.writeFile(path, JSON.stringify(bundle, null, 2) + '\n');
await fs.mkdir('docs/v29', { recursive: true });
await fs.writeFile('docs/v29/C24_PRIMARY_SCAN_AUDIT.md', `# C24 primary scan audit\n\n- Official archive page: ${archiveUrl}\n- File identified by the archive: Ф.109 Оп.24 Д.214 ч.I\n- Folios identified by the archive: 3–20, 44–54, 128–129\n- Scans reviewed: [folio 128a](${scan128}), [folio 129](${scan129})\n- Direct transcription policy: only the visible heading and legible name rows are transcribed. Modern explanatory prose remains ` + '`MODERN_COMMENTARY_OR_ARCHIVE_DESCRIPTION`' + `.\n- Direct records in runtime: V26-C24-X1, V26-C24-X3, V26-C24-X4.\n- This audit does not claim a full diplomatic transcription of the dossier.\n`);
console.log(JSON.stringify({ status: 'PASS', caseId: 'C24', directExcerptCount: 3, modernDescriptionCount: 2, scans: [scan128, scan129] }, null, 2));
