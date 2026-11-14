import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { attachV47StoryObjects, v47StoryQuests } from '../rpg/data/v47-main-stories.mjs';
import { attachV47StoryBeatObjects, toV47StoryQuests } from '../rpg/data/v47-story-beats.mjs';
import { isActionableInteraction, objectIsPresent } from '../rpg/engine/world-presentation.mjs';

const readJson = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const [nevsky, printshop, bookshopLane, provenance, sourceRegister, usageCsv, readerIndex, sourcePackets, historicalSourceRegister] = await Promise.all([
  readJson('rpg/maps/nevsky.json'),
  readJson('rpg/maps/printshop.json'),
  readJson('rpg/maps/bookshop-lane.json'),
  readJson('rpg/assets/ASSET_PROVENANCE.json'),
  readJson('docs/v36/historical-map-source-register.json'),
  readFile(new URL('../rpg/assets/ASSET_USAGE_V36.csv', import.meta.url), 'utf8'),
  readJson('rpg/data/source-reader-index.json'),
  readJson('rpg/data/historical-source-packets.json'),
  readJson('rpg/data/source-register.json'),
]);

const timelineMap = structuredClone(printshop);
attachV47StoryObjects({ printshop: timelineMap });
const timelineObject = timelineMap.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === 9054);
assert.equal(timelineObject?.name, '연감 날짜 대조판', 'MAIN01 chronology is an inspectable object in the printshop');
assert.equal(timelineObject?.properties.find(property => property.name === 'v47PuzzleId')?.value, 'MAIN01_TIMELINE',
  'the mapped board opens the chronology puzzle interaction');

const storefrontSign = bookshopLane.layers.find(layer => layer.name === 'Interactions').objects.find(object => object.id === 4001);
const signAsset = provenance.assets.find(asset => asset.id === 'v47-authored-bookshop-cyrillic-sign');
assert.equal(storefrontSign?.properties?.find(property => property.name === 'displayAsset')?.value,
  '../assets/v47/bookshop-sign.svg', 'the bookshop lane displays a locally packaged Cyrillic storefront sign');
assert.deepEqual(['displayWidth', 'displayHeight'].map(name => storefrontSign?.properties?.find(property => property.name === name)?.value),
  [80, 30], 'the sign remains legible while fitting the narrow street facade');
assert.equal(signAsset?.path, 'rpg/assets/v47/bookshop-sign.svg', 'the sign has a checked-in provenance record');
assert.match(signAsset?.notes ?? '', /КНИЖНАЯ ЛАВКА.*not claimed as documented/i,
  'the Russian shop label is used as scene art without implying this exact historical shop is documented');
const signBytes = await readFile(new URL('../rpg/assets/v47/bookshop-sign.svg', import.meta.url));
assert.equal(createHash('sha256').update(signBytes).digest('hex').toUpperCase(), signAsset.sha256,
  'the storefront sign provenance hash matches the packaged vector asset');

const subscriberMap = structuredClone(printshop);
attachV47StoryBeatObjects({ printshop: subscriberMap }, toV47StoryQuests().filter(quest => quest.id === 'V47_MAIN01_A11'));
const subscriberLetterObject = subscriberMap.layers.find(layer => layer.name === 'Interactions').objects
  .find(object => object.properties?.some(property => property.name === 'sourceId'
    && property.value === 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848'));
assert.ok(subscriberLetterObject, 'MAIN01 A11 places the subscriber letter in the physical printshop');
assert.equal(subscriberLetterObject.type, 'source', 'the letter opens through the source reader');
assert.equal(objectIsPresent(subscriberLetterObject, { world: { date: '1848-11-28', chapterId: 'V33_1848_PUBLIC' } }), false,
  'the letter remains unavailable before its documented arrival');
assert.equal(objectIsPresent(subscriberLetterObject, { world: { date: '1848-11-29', chapterId: 'V33_1848_PUBLIC' } }), true,
  'the physical letter appears on its documented arrival date');

const talnikovReader = readerIndex.records.find(record => record.sourceId === 'V47-PANAEVA-TALNIKOV-CH1-1848');
const talnikovPacket = sourcePackets.records.find(record => record.sourceId === 'V47-PANAEVA-TALNIKOV-CH1-1848');
const almanacNoticePacket = sourcePackets.records.find(record => record.sourceId === 'V47-NEKRASOV-ALMANAC-CONTENTS-1848');
const almanacNoticeReader = readerIndex.records.find(record => record.sourceId === 'V47-NEKRASOV-ALMANAC-CONTENTS-1848');
const subscriberLetterPacket = sourcePackets.records.find(record => record.sourceId === 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848');
const subscriberLetterReader = readerIndex.records.find(record => record.sourceId === 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848');
assert.doesNotMatch(almanacNoticePacket?.contextKo ?? '', /단정하지 않습니다|실제와 다를 수 있습니다/,
  'the source reader context describes the notice directly without meta disclaimers');
assert.match(almanacNoticeReader?.contextKo ?? '', /잡지 호의 발행 허가.*아직 발행 전인 연감/,
  'the notice context makes clear which publication received permission');
assert.equal(subscriberLetterPacket?.paragraphs.length, 5, 'the complete subscriber letter keeps the greeting, dispute, response, request, and signatures');
assert.match(subscriberLetterReader?.pageLocator ?? '', /편지 전체.*두 서명.*RGALI.*RGB/,
  'the player can identify the continuous letter range and both authorized-copy locations');
assert.doesNotMatch(subscriberLetterReader?.pageLocator ?? '', /미열람|대조하지 못/,
  'research access status stays out of the reading surface');
assert.equal(talnikovPacket?.paragraphs.length, 13, 'the first chapter excerpt keeps its contiguous context');
assert.equal(talnikovPacket?.verificationStatus, '1848_ORIGINAL_SCAN_VISUALLY_COLLATED_ON_LEAVES_9_11; 13_CONTIGUOUS_PARAGRAPHS_CHECKED; MODERN_RUSSIAN_ORTHOGRAPHY',
  'the complete excerpt is collated against the original 1848 scan and its normalized orthography is explicit');
assert.ok(talnikovReader?.catalogLinks?.some(link => link.href === 'https://search.rsl.ru/ru/record/01008627015'),
  'the player can open the RSL record for the 1848 facsimile edition');
assert.ok(talnikovReader?.catalogLinks?.some(link => link.href === 'https://ci.nii.ac.jp/ncid/BB0860830X'),
  'the player can open the CiNii record linking to the HathiTrust holding');
const academiaReprint = historicalSourceRegister.sources.find(source => source.sourceId === 'V47-PANAEVA-ACADEMIA-REPRINT-1928');
assert.ok(academiaReprint?.url === 'https://imwerden.de/pdf/panaeva_semejstvo_talnikovykh_academia_1928_text.pdf',
  'the accessible 1928 reprint scan is linked as a separate textual witness');
assert.match(academiaReprint?.verificationStatus ?? '', /1928_REPRINT_OCR_TEXT_CHECKED; 1848_ORIGINAL_SCAN_CROSSCHECKED_SEPARATELY/,
  'the 1928 reprint and original 1848 scan are represented as separate witnesses');
assert.ok(talnikovReader?.catalogLinks?.some(link => link.sourceId === academiaReprint?.sourceId),
  'the player can inspect the 1928 reprint witness from the document reader');
assert.equal(talnikovReader?.readerLabelKo, '책 원문', 'the document header stays focused on the text');
assert.equal(talnikovReader?.textStatus, 'DIRECT', 'the Russian passage is checked against its original 1848 witness');
assert.match(talnikovPacket?.translationNoteKo ?? '', /1928년.*전사문.*1848년.*낱장 9–11.*대조/,
  'the source note distinguishes the 1928 reprint transcription from the visually collated 1848 leaves');
assert.equal(talnikovReader?.artworks?.filter(artwork => artwork.path.includes('talnikov-1848-leaf-')).length, 3,
  'the document reader shows all three contiguous source pages beside the excerpt');
assert.match(talnikovReader?.pageLocator ?? '', /스캔 낱장 9–11/,
  'the reader gives the precise Internet Archive scan leaf range');
for (const link of talnikovReader?.catalogLinks ?? []) {
  assert.ok(historicalSourceRegister.sources.some(source => source.sourceId === link.sourceId && source.url === link.href),
    `catalog link ${link.sourceId} resolves to a checked-in provenance record`);
}

const talnikovScene = toV47StoryQuests().find(quest => quest.id === 'V47_MAIN01_A03');
assert.ok(talnikovScene.dialogue?.length >= 4, 'the Talnikov scene opens with a contextual authored exchange');
assert.equal(new Set(talnikovScene.dialogue.map(line => line.speakerKo)).size, 4,
  'the Talnikov exchange gives all four present characters a voice');
assert.ok(talnikovScene.actions.every(action => action.subcopyKo?.trim()),
  'both Talnikov choices explain their immediate audience and practical direction');

const openingScene = toV47StoryQuests().find(quest => quest.id === 'V47_MAIN01_A01');
assert.equal(openingScene?.entry?.mapId, 'bookshop-interior', 'MAIN01 opens at the subscriber-facing bookshop scene');
assert.equal(openingScene?.date, '1848-02-12', 'the opening is available on the contemporary almanac notice date');
assert.ok(openingScene?.dialogue?.some(line => line.speakerKo === '레프' && /부록/.test(line.lineKo)),
  'Lev answers the subscriber asking about the promised supplement');
assert.ok(openingScene?.dialogue?.some(line => line.speakerKo === '다리야'),
  'the subscriber has a speaking role in the opening');
assert.match(openingScene?.dialogue?.find(line => line.speakerKo === '파벨')?.lineKo ?? '', /제가 다녀올까요/,
  'the dialogue leaves the courier decision to the player choices');
assert.ok(openingScene?.actions?.some(action => action.id === 'V47_A01_OPEN_SUBSCRIBER_LEDGER'),
  'the opening gives the player a physical ledger action');
const krylovAssessment = sourcePackets.records.find(record => record.sourceId === 'V47-KRYLOV-ASSESSMENT-1848-09-06');
assert.equal(krylovAssessment?.paragraphs.length, 3, 'the censorship assessment includes contiguous context');
assert.match(krylovAssessment?.range ?? '', /Wikisource lines 232–234.*RGIA ф\. 772, оп\. 1, ед\. хр\. 2157, л\. 11–14/s,
  'the continuous assessment excerpt carries its exact transcription and archival folio range');
assert.ok(readerIndex.records.some(record => record.sourceId === 'V47-KRYLOV-ASSESSMENT-1848-09-06'
  && record.accessibleToPlayerAt === '1848-09-18'), 'the assessment is unavailable before its report date');
const banReport = sourcePackets.records.find(record => record.sourceId === 'V47-MUSIN-PUSHKIN-REPORT-MARGIN-NOTE-1848-10-15');
assert.equal(banReport?.paragraphs.length, 1, 'the ban report includes its actual cited wording');
assert.match(banReport?.range ?? '', /Wikisource lines 239–240.*RGIA ф\. 772, оп\. 1, ед\. хр\. 2157, л\. 8–9/s,
  'the unsigned marginal note is tied to its exact folios and transcription range');
assert.match(banReport?.verificationStatus ?? '', /UNSIGNED_MARGIN_NOTE.*NOT_FORMAL_DECREE/,
  'the unsigned margin note is not mislabeled as the formal decree');
assert.ok(toV47StoryQuests().find(quest => quest.id === 'V47_MAIN01_A05')?.sourceIds.includes('V47-KRYLOV-ASSESSMENT-1848-09-06'),
  'the censorship assessment is attached to the related resubmission scene');
const panaevLetter = sourcePackets.records.find(record => record.sourceId === 'V47-PANAEV-LETTER-1848-08-20');
assert.match(panaevLetter?.range ?? '', /RGIA ф\. 772, оп\. 1, ед\. хр\. 2157, л\. 10.*Wikisource lines 227–231/s,
  'the continuous Panaev letter excerpt carries its exact transcription and archival folio range');
const subscriberLetter = sourcePackets.records.find(record => record.sourceId === 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848');
assert.match(subscriberLetter?.range ?? '', /salutation through joint signatures/i,
  'the subscriber letter range includes its complete continuous letter boundaries');
assert.match(subscriberLetter?.range ?? '', /RGALI.*ф\. 338.*ед\. хр\. 74.*RGB.*ф\. 195.*ед\. хр\. 16/i,
  'the subscriber letter range identifies both authorized archival copies');
assert.match(readerIndex.records.find(record => record.sourceId === 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848')?.pageLocator ?? '',
  /편지 전체.*RGALI.*ф\. 338.*RGB.*ф\. 195/,
  'the in-game reader gives Korean continuous bounds and both archive locators');
assert.doesNotMatch(readerIndex.records.find(record => record.sourceId === 'V47-NEKRASOV-SUBSCRIBER-LETTER-1848')?.pageLocator ?? '',
  /미열람|대조하지 못/, 'archive review status stays out of player-facing source metadata');
assert.ok(v47StoryQuests.find(quest => quest.id === 'V47_MAIN01_DISTRIBUTION_BAN')
  ?.sourceIds.includes('V47-MUSIN-PUSHKIN-REPORT-MARGIN-NOTE-1848-10-15'),
  'the unsigned note is attached to the ban-date scene');

const atlas = provenance.assets.find(asset => asset.id === 'petersburg-tiles');
const caricature = provenance.assets.find(asset => asset.id === 'v47-nekrasov-panaev-caricature');
const titlePage = provenance.assets.find(asset => asset.id === 'v47-illustrated-almanac-titlepage');
const titlePageBytes = await readFile(new URL('../rpg/assets/v47-illustrated-almanac-titlepage.jpg', import.meta.url));
const caricatureBytes = await readFile(new URL('../rpg/assets/v47-nekrasov-panaev-caricature.jpg', import.meta.url));
const talnikovPagePaths = [9, 10, 11].map(leaf => `../rpg/assets/v47-almanac/talnikov-1848-leaf-${String(leaf).padStart(3, '0')}.jpg`);
const talnikovPageBytes = await Promise.all(talnikovPagePaths.map(path => readFile(new URL(path, import.meta.url))));
const caricatureReader = readerIndex.records.find(record => record.sourceId === 'V47-NEKRASOV-ALMANAC-CONTENTS-1848');
const almanacNoticeArtworks = caricatureReader?.artworks?.filter(artwork => artwork.path.includes('sovremennik-1848-v7')) ?? [];
assert.equal(almanacNoticeArtworks.length, 3, 'the contemporary almanac notice is shown with its three contiguous original periodical pages');
assert.match(caricatureReader?.pageLocator ?? '', /215–217.*RA5-PT215–217/,
  'the notice gives the exact original periodical page range');
const caricatureSource = historicalSourceRegister.sources.find(source => source.sourceId === 'V47-ART-STEPANOV-NEKRASOV-PANAEV-1848');
const titlePageSource = historicalSourceRegister.sources.find(source => source.sourceId === 'V47-ART-ILLUSTRATED-ALMANAC-TITLEPAGE-1848');
const titlePageArtwork = caricatureReader?.artworks?.find(artwork => artwork.path === '/rpg/assets/v47-illustrated-almanac-titlepage.jpg');
const periodicalScanSource = historicalSourceRegister.sources.find(source => source.sourceId === 'V47-GOOGLE-SOVREMENNIK-V7-1848-SCAN');
assert.equal(periodicalScanSource?.url, 'https://books.google.com/books?id=yyoYAAAAYAAJ&hl=ru&pg=RA5-PT216',
  'the exact Google Books scan page for the notice is recorded');
assert.match(periodicalScanSource?.verificationStatus ?? '', /NOTICE_ON_PAGE_216_COLLATED/,
  'the almanac notice original page was visually inspected');
for (const [index, page] of almanacNoticeArtworks.entries()) {
  const asset = provenance.assets.find(item => item.path === page.path.slice(1));
  const pageBytes = await readFile(new URL(`../${page.path.slice(1)}`, import.meta.url));
  assert.ok(asset?.sourceIds.includes(periodicalScanSource?.sourceId), `periodical page ${index + 215} has primary-source provenance`);
  assert.equal(createHash('sha256').update(pageBytes).digest('hex').toUpperCase(), asset?.sha256,
    `periodical page ${index + 215} matches its recorded SHA-256`);
}
const talnikovArtwork = talnikovReader?.artworks?.filter(artwork => artwork.path.includes('talnikov-1848-leaf-')) ?? [];
const talnikovScanSource = historicalSourceRegister.sources.find(source => source.sourceId === 'V47-IA-ILLUSTRATED-ALMANAC-1848-SCAN');
assert.equal(createHash('sha256').update(titlePageBytes).digest('hex').toUpperCase(), titlePage?.sha256,
  'the shipped 1848 almanac title page matches its checked-in checksum');
assert.equal(titlePageArtwork?.availableToPlayerAt, '1848-02-12',
  'the actual title page appears only once its contemporary notice is in-world available');
assert.match(titlePageArtwork?.captionKo ?? '', /실제 책의 표제면/,
  'the source reader identifies the historical book cover accurately');
assert.ok(titlePageSource?.rights.includes('Public domain') && titlePage?.sourceIds.includes(titlePageSource.sourceId),
  'the title page has linked public-domain provenance');
assert.equal(titlePageSource?.url, 'https://commons.wikimedia.org/wiki/File:Almanac_illustrated.jpg',
  'the provenance points to the exact Commons file record');
assert.equal(talnikovScanSource?.url, 'https://archive.org/details/1848_20240901',
  'the exact original 1848 scan is linked from the source register');
assert.equal(talnikovArtwork.length, 3, 'all collated source pages appear in the in-game reader');
for (let index = 0; index < talnikovArtwork.length; index += 1) {
  const artwork = talnikovArtwork[index];
  const asset = provenance.assets.find(item => item.path === artwork.path.slice(1));
  assert.ok(asset?.sourceIds.includes(talnikovScanSource?.sourceId), `source page ${index + 9} has a primary-scan provenance record`);
  assert.equal(createHash('sha256').update(talnikovPageBytes[index]).digest('hex').toUpperCase(), asset?.sha256,
    `source page ${index + 9} matches its recorded SHA-256`);
  assert.equal(artwork.availableToPlayerAt, '1848-05-06', `source page ${index + 9} is released with the Talnikov scene`);
}
assert.equal(createHash('sha256').update(caricatureBytes).digest('hex').toUpperCase(), caricature?.sha256,
  'the shipped historical image matches its checked-in checksum');
assert.equal(caricatureReader?.artwork?.path, '/rpg/assets/v47-nekrasov-panaev-caricature.jpg',
  'the contemporary caricature is available inside the almanac source reader');
assert.equal(caricatureReader.artwork.availableToPlayerAt, '1848-02-12',
  'the artwork is gated until the contemporary notice is available in-world');
assert.match(caricatureReader.artwork.captionKo, /실제 판면이나 탈니코프 가족 삽화가 아니라/,
  'the image cannot be mistaken for an almanac page or the story illustration');
assert.ok(caricatureSource?.rights.includes('Public Domain Mark 1.0') && caricature?.sourceIds.includes(caricatureSource.sourceId),
  'the displayed period artwork has a checked rights record linked from the asset manifest');
assert.equal(caricatureSource.url, 'https://commons.wikimedia.org/wiki/File:Nekrasov%40Panaev.jpg',
  'the source register identifies the exact public-domain file page');
assert.equal(printshop.metadata?.canvasGutterColor, '#30231c',
  'the printshop canvas gutters continue the dark interior instead of showing a contrasting gray void');
const passageSourceId = 'V47-ART-SADOVNIKOV-PASSAGE-1848';
const passageSource = sourceRegister.sources.find(source => source.sourceId === passageSourceId);
assert.ok(passageSource, 'the 1848 Nevsky arcade artwork is recorded in the checked-in visual source register');
assert.ok(atlas?.sourceIds.includes(passageSourceId), 'the city tile atlas cites the 1848 artwork used as bounded scene reference');
assert.ok(passageSource.visualFeature.includes('arched shop bays') && passageSource.gameTransformation.includes('authored pixel tiles'),
  'source notes separate visible architecture from the invented pixel rendering');
assert.ok(passageSource.rights.includes('No museum image is copied or redistributed'), 'the museum scan is not silently republished');
const gostinySource = historicalSourceRegister.sources.find(source => source.sourceId === 'V47-ART-CHARLEMAGNE-GOSTINY-DVOR-1850S');
assert.ok(gostinySource?.rights.includes('Public Domain Mark 1.0'), 'the later street reference has a recorded public-domain status');
assert.ok(atlas?.sourceIds.includes(gostinySource.sourceId), 'street tile design can draw on the documented Gostiny Dvor streetscape');
assert.ok(gostinySource.visualFeature.includes('Gostiny Dvor') && gostinySource.gameTransformation.includes('pixel facade'),
  'the map provenance limits the borrowed reference to broad storefront rhythm');
const durandSource = historicalSourceRegister.sources.find(source => source.sourceId === 'V47-ART-DURAND-NEVSKY-1839');
assert.ok(durandSource?.rights.includes('Public Domain Mark 1.0'), 'the 1839 Nevsky reference has checked public-domain status');
assert.ok(atlas?.sourceIds.includes(durandSource?.sourceId), 'the Nevsky avenue palette and building mass cite an era-matched streetscape');
assert.ok(durandSource.visualFeature.includes('Politseisky Bridge') && durandSource.gameTransformation.includes('original pixel map'),
  'street design notes name the borrowed composition cues without claiming an exact reconstruction');

const declaredTiles = usageCsv.trim().split(/\r?\n/).slice(1).map(line => {
  const fields = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map(match => match[1].replaceAll('""', '"'));
  return { gid: Number(fields[0]), key: fields[1], sourceId: fields[5], sourceUrl: fields[6], note: fields[7] };
});
assert.equal(declaredTiles.length, 115, 'the city atlas has the street, printshop and floor assets');
assert.equal(new Set(declaredTiles.filter(tile => tile.gid >= 96).map(tile => tile.key)).size, 20,
  'each new street and printshop pixel asset has its own stable ledger key');
for (const gid of [96, 97, 98, 99, 100]) {
  const tile = declaredTiles.find(row => row.gid === gid);
  assert.equal(tile.sourceId, passageSourceId, `street tile ${gid} names its scene reference`);
  assert.ok(tile.note.includes('복제본은 배포하지') && tile.note.includes('게임 좌표'), `street tile ${gid} states the reference limits`);
}
for (const gid of [101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115]) {
  const tile = declaredTiles.find(row => row.gid === gid);
  assert.equal(tile.sourceId, '', `printshop tile ${gid} is not falsely presented as source-verified`);
  assert.match(tile.note, /UNVERIFIED_RECONSTRUCTION/);
}
for (const map of [nevsky, printshop]) {
  assert.equal(map.tilesets.find(set => set.image?.endsWith('petersburg-tiles.png'))?.tilecount, 115,
    `${map.mapId} declares the complete authored atlas`);
}
for (const gid of [96, 97, 98, 99, 100]) {
  assert.ok(nevsky.layers.find(layer => layer.name === 'Architecture').data.includes(gid), `Nevsky uses researched street tile ${gid}`);
}
for (const gid of [101, 102, 109, 110, 111]) {
  assert.ok(printshop.layers.filter(layer => ['Ground', 'Architecture', 'StreetDetail'].includes(layer.name))
    .some(layer => layer.data.includes(gid)),
    `the printshop uses authored working-space tile ${gid}`);
}
const floor = printshop.layers.find(layer => layer.name === 'Ground').data;
const wall = printshop.layers.find(layer => layer.name === 'Architecture').data;
const roomDetail = printshop.layers.find(layer => layer.name === 'StreetDetail').data;
assert.ok(wall.includes(112) && wall.includes(113), 'printshop walls break the repeated plank texture with varied plaster and tool-wall tiles');
assert.deepEqual([roomDetail[10 * printshop.width + 6], roomDetail[10 * printshop.width + 7],
  roomDetail[11 * printshop.width + 6], roomDetail[11 * printshop.width + 7]], [86, 87, 88, 89],
  'the four-piece press sits together on the lower work floor, not embedded in the upper wall');
assert.ok(roomDetail[10 * printshop.width + 13] === 114 && roomDetail[10 * printshop.width + 14] === 115,
  'loose proof sheets and ink tools visibly form a second work zone');
const collision = printshop.layers.find(layer => layer.name === 'Collision').data;
for (const [x, y] of [[6, 10], [7, 10], [6, 11], [7, 11], [13, 10], [14, 10]]) {
  assert.equal(collision[y * printshop.width + x], 0, `visual work props at ${x},${y} stay on walkable floor`);
}
for (const gid of [109, 110, 111]) assert.ok(floor.includes(gid), `the printshop floor uses distinct wear tile ${gid}`);
assert.equal(floor[11 * printshop.width + 8], 111, 'the hand press stands on its ink-worn patch');
assert.equal(floor[11 * printshop.width + 18], 110, 'the binding supplies sit over repaired floorboards');
assert.equal(floor[14 * printshop.width + 12], 109, 'worn planks mark the route from the room to the door');
const workshopTiles = [];
for (let y = 5; y <= 15; y++) for (let x = 2; x <= 21; x++) workshopTiles.push(floor[y * printshop.width + x]);
assert.ok(workshopTiles.filter(gid => gid === 5 || gid === 6).length > workshopTiles.length / 2,
  'the shop reads primarily as a wooden workroom floor, with wear and stains localized to work areas');
const printshopProps = printshop.layers.find(layer => layer.name === 'Interactions').objects;
const handpress = printshopProps.find(object => object.id === 4014);
const handpressAsset = provenance.assets.find(asset => asset.id === 'v47-authored-letterpress-handpress');
assert.equal(handpress?.properties?.find(property => property.name === 'displayAsset')?.value,
  '../assets/letterpress-handpress.svg', 'the handpress interaction draws its locally authored larger illustration');
assert.deepEqual([
  handpress?.properties?.find(property => property.name === 'displayWidth')?.value,
  handpress?.properties?.find(property => property.name === 'displayHeight')?.value,
], [64, 64], 'the handpress illustration spans four 16px tiles while keeping its original interaction target');
assert.equal(handpress?.properties?.find(property => property.name === 'displayOffsetY')?.value, 0,
  'the larger illustration sits below the map title marker on narrow screens');
assert.equal(handpressAsset?.path, 'rpg/assets/letterpress-handpress.svg', 'the handpress illustration has a checked-in local asset');
assert.match(handpressAsset?.notes ?? '', /AUTHORED.*NOT a historical object image/i,
  'the authored handpress art is not misrepresented as a photograph of a documented Russian shop');
for (const [x, y] of [[8, 11], [8, 10], [7, 11], [9, 11]]) {
  assert.equal(collision[y * printshop.width + x], 0, `handpress display around ${x},${y} remains on walkable floor`);
}
const compositorShelf = printshopProps.find(object => object.id === 4019);
const shelfAsset = provenance.assets.find(asset => asset.id === 'v47-authored-printshop-compositor-shelf');
assert.equal(compositorShelf?.properties?.find(property => property.name === 'displayAsset')?.value,
  '../assets/v47/printshop-compositor-shelf.svg', 'the printshop has a locally packaged compositor shelf');
assert.equal(compositorShelf?.type, undefined, 'the wall shelf remains scenery, not a false interaction target');
assert.equal(isActionableInteraction(compositorShelf, {
  player: { embodiment: 'printer_ekaterina' }, world: { currentMapId: 'printshop', chapterId: 'V33_1848_PUBLIC', date: '1848-03-21' },
}, printshop), false, 'the wall shelf does not show a misleading interaction marker');
assert.equal(shelfAsset?.path, 'rpg/assets/v47/printshop-compositor-shelf.svg', 'the shelf has a checked-in provenance record');
const shelfBytes = await readFile(new URL('../rpg/assets/v47/printshop-compositor-shelf.svg', import.meta.url));
assert.equal(createHash('sha256').update(shelfBytes).digest('hex').toUpperCase(), shelfAsset.sha256,
  'the compositor shelf provenance hash matches the packaged vector asset');
for (let y = 1; y <= 3; y++) for (let x = 14; x <= 18; x++) {
  assert.equal(collision[y * printshop.width + x], 1, `wall-mounted shelf art at ${x},${y} stays over existing blocked wall tiles`);
}
const almanacNoticeObject = printshopProps.find(object => object.id === 4017);
assert.equal(almanacNoticeObject?.properties?.find(property => property.name === 'sourceId')?.value,
  'V47-NEKRASOV-ALMANAC-CONTENTS-1848', 'the primary almanac notice is a physical source in the printshop');
assert.equal(almanacNoticeObject?.properties?.find(property => property.name === 'availableDate')?.value,
  '1848-02-12', 'the physical source cannot appear before the notice date');
const talnikovPhysicalBook = printshopProps.find(object => object.id === 4010);
assert.ok(Math.hypot(almanacNoticeObject.x - talnikovPhysicalBook.x, almanacNoticeObject.y - talnikovPhysicalBook.y) >= 96,
  'the almanac notice cannot steal the interaction focus from the nearby Talnikov book');
for (const [name, gid] of [
  ['조판용 활자함', 104], ['교정쇄 건조대', 105], ['연감 포장 끈과 종이', 103],
  ['손으로 누르는 인쇄기', 106], ['교정쇄 묶음', 107], ['제본된 연감', 108],
]) {
  assert.ok(printshopProps.some(object => object.name === name
    && object.properties?.some(property => property.name === 'assetTileId' && property.value === gid)),
  `players can inspect the physical ${name} prop`);
}
console.log('MAIN01 visual assets: historical reference, tile usage, map integration, and printshop objects passed.');
