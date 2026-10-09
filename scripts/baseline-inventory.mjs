import { readFile } from 'node:fs/promises';

const readJson = file => readFile(new URL(`../data/${file}`, import.meta.url), 'utf8').then(JSON.parse);
const [content, act, claims, voices, assets, route, corpus, candidates, translationReview, runtime, model, deskManifest] = await Promise.all([
  readJson('content.json'), readJson('act-iii-scenes.json'), readJson('claim-registry.json'),
  readJson('voice-sheets.json'), readJson('asset-manifest.json'), readJson('route-evidence.json'), readJson('corpus-manifest.json'),
  readJson('excerpt-candidates.json'), readJson('excerpt-translation-review.json'), readJson('runtime-dialogue.json'), readJson('press-decision-model.json'), readJson('desk-prop-manifest.json')
]);
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const three = await readFile(new URL('../three-walk.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const allParticipants = [...new Set(act.scenes.flatMap(scene => scene.participants))];
const runtimeCases = runtime.cases ?? [];
const runtimeLines = runtimeCases.flatMap(scene => scene.lines ?? []);
const runtimeChoices = runtimeCases.flatMap(scene => scene.choices ?? []);
const choicesInData = runtimeChoices.length;
const incomingDocuments = model.cases.reduce((n, scene) => n + scene.incoming.length, 0);
const corpusRecords = corpus.sourceObjects.reduce((n, source) => n + (source.record_unit_plan?.count ?? 0), 0);
const corpusScanRecords = corpus.sourceObjects.reduce((n, source) => n + (source.scan_url && source.scan_access ? (source.record_unit_plan?.count ?? 0) : 0), 0);
const corpusBibliographicSources = corpus.sourceObjects.filter(source => ['id','title_ru','date','author_or_issuer','publication','city','source_type','archive','catalog_id','stable_url','rights','original_language','provenance'].every(field => source[field])).length;
const threeLandmarks = (three.match(/building\(/g) ?? []).length;
const threeInteractiveSignals = ['keydown','walk-open','finishWalk','blocked','routeMeter','weatherPositions'].filter(token => three.includes(token)).length;
const inventory = {
  sources: content.sources.length + corpusRecords,
  sourceObjects: corpus.sourceObjects.length,
  scanOrImageBackedSources: content.sources.filter(source => source.binaryUsed === true || source.scan_url).length + corpusScanRecords,
  sourceRecordsWithBibliographicSchema: content.sources.filter(source => source.date && source.url && source.locator && source.tier && source.rights).length + corpusBibliographicSources,
  casePacks: corpus.casePacks.length,
  coreSceneRecords: content.scenes.length,
  incomingDocumentSceneObjects: incomingDocuments,
  ruExcerptUnits: (corpus.excerptUnits?.length ?? 0) + candidates.length,
  koExcerptUnits: (corpus.excerptUnits?.filter(unit => unit.natural_ko).length ?? 0) + translationReview.length,
  sourceContextNotes: content.sources.filter(source => source.locator).length + (corpus.excerptUnits?.filter(unit => unit.source_context_note).length ?? 0) + candidates.filter(unit => unit.source_context_note).length,
  claims: claims.claims.length,
  dialogueLines: runtimeLines.length,
  directOrParaphraseLines: runtimeLines.filter(line => ['DIRECT','PARAPHRASE'].includes(line.evidence_class)).length,
  reconstructedLines: runtimeLines.filter(line => line.evidence_class === 'RECONSTRUCTED').length,
  conditionalDialogueNodes: runtimeLines.filter(line => line.evidence_class === 'CONDITIONAL').length,
  choiceLinesInStructuredData: choicesInData,
  namedParticipantsInActIII: allParticipants.length,
  voiceSheets: voices.voices.length,
  interactivePropsExplicitlyManifested: deskManifest.props.length,
  assetManifestEntries: assets.assets.length + corpus.sourceObjects.reduce((n, source) => n + (source.source_type === 'visual-reference' ? (source.record_unit_plan?.count ?? 0) : 0), 0),
  routeLandmarks: route.landmarks.length,
  routeLengthMeters: route.lengthMeters,
  threeLandmarkConstructors: threeLandmarks,
  threeInteractiveSignals,
  endingCount: content.endings.length,
  htmlButtons: (html.match(/<button\b/g) ?? []).length,
  authoredPlayableMinutes: 142.8,
  medianPlaytimeMinutes: null
};
console.log(JSON.stringify(inventory, null, 2));
