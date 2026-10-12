import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import branchGraph from '../main20-branch-graph.js';
const { enumerateRouteVectors, resolveBranchEvent, resolveNextHub, resolveRouteNextStep, validateBranchGraph } = branchGraph;
const projectGraph = JSON.parse(await readFile(new URL('../narrative/ACT_III_BRANCH_ROUTE.json', import.meta.url), 'utf8'));
const main20 = JSON.parse(await readFile(new URL('../narrative/MAIN_20MIN_DIALOGUE.json', import.meta.url), 'utf8'));
const addedSources = JSON.parse(await readFile(new URL('../narrative/ACT_III_BRANCHING_SOURCES.json', import.meta.url), 'utf8'));
const censorshipCase = JSON.parse(await readFile(new URL('../data/censorship-case-1847-07.json', import.meta.url), 'utf8'));
const e04Scene = JSON.parse(await readFile(new URL('../narrative/E04_SCENE.json', import.meta.url), 'utf8'));

const makeGraph = () => {
  const dates = ['1842-02-03', '1843-03-12', '1847-01-08', '1848-04-20'];
  const hubs = Array.from({ length: 4 }, (_, index) => ({ id: `H${index + 1}`, date: dates[index], nextHubId: index < 3 ? `H${index + 2}` : 'END', branchIds: [1, 2, 3].map(n => `B${index + 1}-${n}`) }));
  const branches = hubs.flatMap(hub => [1, 2, 3].map(n => ({
    choiceId: `B${hub.id.slice(1)}-${n}`, hubId: hub.id, immediateEventId: `E${hub.id.slice(1)}-${n}`,
    nextHubReactionId: `R${hub.id.slice(1)}-${n}`, callbackKey: `CALLBACK-${hub.id}-${n}`, sourceIds: ['SRC-1'],
    immediateDirection: { action: 'Keep a private copy', audience: 'One colleague', record: 'Private', documentLeavesOffice: false, risk: 'Personal trust' },
    stateWrites: { relationship: n, exposure: n - 2 }
  })));
  return { schemaVersion: 1, hubs, branches, events: branches.map(branch => ({ id: branch.immediateEventId })), anchors: [{ id: 'E02', date: '1847-01-05', historical: true }, { id: 'E04', date: '1847-07-08', historical: true }, { id: 'E07', date: '1849-05-10', historical: true }], sequence: ['H1', 'H2', 'E02', 'H3', 'E04', 'H4', 'E07'], transitions: [], eventPredicates: { nextHubAcknowledgements: [{ reactionTexts: Object.fromEntries(branches.map(branch => [branch.nextHubReactionId, { speaker: 'alexei', text: 'A reaction.' }])) }] }, endingRoutes: ['ENDING-1', 'ENDING-2', 'ENDING-3', 'ENDING-4', 'ENDING-5'] };
};

test('accepts four three-option hubs and a complete minimal graph', () => {
  assert.deepEqual(validateBranchGraph(makeGraph(), ['SRC-1']), { valid: true, errors: [] });
});

test('rejects duplicate graph identifiers', () => {
  const graph = makeGraph();
  graph.events.push({ ...graph.events[0] });
  assert.match(validateBranchGraph(graph, ['SRC-1']).errors.join('\n'), /duplicate.*E1-1/i);
});

test('rejects missing targets, sources, immediate directions, and branch events', () => {
  const graph = makeGraph();
  graph.hubs[0].nextHubId = 'MISSING';
  graph.branches[0].sourceIds = ['NO-SOURCE'];
  graph.branches[1].immediateDirection = null;
  graph.branches[2].immediateEventId = 'NO-EVENT';
  const errors = validateBranchGraph(graph, ['SRC-1']).errors.join('\n');
  assert.match(errors, /MISSING/);
  assert.match(errors, /NO-SOURCE/);
  assert.match(errors, /immediateDirection/);
  assert.match(errors, /NO-EVENT/);
});

test('rejects incomplete choice disclosure, duplicate callbacks, and missing reactions', () => {
  const graph = makeGraph();
  graph.branches[0].immediateDirection.risk = '';
  graph.branches[1].callbackKey = graph.branches[0].callbackKey;
  graph.branches[2].nextHubReactionId = '';
  const errors = validateBranchGraph(graph, ['SRC-1']).errors.join('\n');
  assert.match(errors, /risk/);
  assert.match(errors, /duplicate callback/i);
  assert.match(errors, /nextHubReactionId/);
});

test('enumerates all 81 distinct four-choice vectors', () => {
  const vectors = enumerateRouteVectors(makeGraph());
  assert.equal(vectors.length, 81);
  assert.equal(new Set(vectors.map(vector => vector.choiceIds.join('|'))).size, 81);
});

test('resolves the immediate branch and preserves prior choices and immutable historical anchors', () => {
  const graph = makeGraph();
  const prior = { routeChoices: ['B1-2'], branchState: { trust: 3 }, historicalAnchors: graph.anchors };
  const result = resolveBranchEvent(graph, 'H2', 'B2-3', prior);
  assert.equal(result.eventId, 'E2-3');
  assert.deepEqual(result.nextState.routeChoices, ['B1-2', 'B2-3']);
  assert.notEqual(result.nextState.branchState, prior.branchState);
  assert.deepEqual(prior.routeChoices, ['B1-2']);
  assert.deepEqual(result.nextState.historicalAnchors, graph.anchors);
});

test('uses an explicit valid next-hub fallback when predicates do not match', () => {
  const graph = makeGraph();
  graph.transitions = [{ fromHubId: 'H1', when: { exposureAtLeast: 99 }, toHubId: 'MISSING' }, { fromHubId: 'H1', fallback: true, toHubId: 'H2' }];
  assert.equal(resolveNextHub(graph, 'H1', { exposure: 0 }), 'H2');
});

test('resolves the interleaved historical scene order without going backward in time', () => {
  const graph = makeGraph();
  assert.deepEqual(graph.sequence.map(step => resolveRouteNextStep(graph, step)), ['H2', 'E02', 'H3', 'E04', 'H4', 'E07', null]);
  graph.sequence = ['H1', 'H2', 'E02', 'H3', 'H4', 'E04', 'E07'];
  assert.match(validateBranchGraph(graph, ['SRC-1']).errors.join('\n'), /chronology reverses/);
});

test('project graph has 81 vectors and every option has its own event, reaction, callback and resolvable source', () => {
  const sourceIds = new Set([...(main20.sourceRegister ?? []).map(source => source.sourceId), ...addedSources.map(source => source.sourceId), ...censorshipCase.items.map(item => item.sourceId)]);
  const result = validateBranchGraph(projectGraph, [...sourceIds]);
  assert.deepEqual(result, { valid: true, errors: [] });
  assert.equal(enumerateRouteVectors(projectGraph).length, 81);
  assert.deepEqual(projectGraph.sequence, ['E02', 'E04', 'H1-CIRCLE', 'H2-EXAM', 'H3-READING', 'H4-NEWS', 'E07']);
  assert.ok(projectGraph.anchors.some(anchor => anchor.id === 'E04' && anchor.sourceIds.includes('EXT-SHEVCHENKO-DOC-282')));
  const activeE04 = e04Scene.excerpts.find(excerpt => excerpt.sourceId === 'EXT-SHEVCHENKO-DOC-282');
  assert.ok(activeE04?.ru.includes('Присутствовали:') && activeE04?.ru.includes('Слушали:'));
  assert.equal(activeE04?.ru.split('\n\n').length, 3);
  assert.equal(activeE04?.ko.split('\n\n').length, 3);
  assert.deepEqual(projectGraph.sequence.slice(0, -1).map((step, index) => resolveRouteNextStep(projectGraph, step)), projectGraph.sequence.slice(1));
  for (const hub of projectGraph.hubs) {
    const branches = projectGraph.branches.filter(branch => branch.hubId === hub.id);
    assert.equal(new Set(branches.map(branch => branch.immediateEventId)).size, 3);
    assert.equal(new Set(branches.map(branch => branch.nextHubReactionId)).size, 3);
    assert.equal(new Set(branches.map(branch => branch.callbackKey)).size, 3);
    for (const branch of branches) {
      for (const sourceId of [...branch.sourceIds, ...(projectGraph.choiceSourceIds?.[branch.choiceId] || [])]) {
        assert.ok(sourceIds.has(sourceId), `${branch.choiceId} missing ${sourceId}`);
        const source = [...(main20.sourceRegister || []), ...addedSources, ...censorshipCase.items].find(item => item.sourceId === sourceId);
        const available = source?.availableDate || source?.availabilityDate || source?.date;
        assert.ok(available && available <= hub.date, `${branch.choiceId} exposes ${sourceId} (${available || 'unknown'}) before ${hub.date}`);
      }
      for (const sourceId of branch.eventSourceIds || []) {
        assert.ok(sourceIds.has(sourceId), `${branch.choiceId} selected event missing ${sourceId}`);
        const source = [...(main20.sourceRegister || []), ...addedSources, ...censorshipCase.items].find(item => item.sourceId === sourceId);
        const available = source?.availableDate || source?.availabilityDate || source?.date;
        assert.ok(available && available <= hub.date, `${branch.choiceId} selected event exposes ${sourceId} (${available || 'unknown'}) before ${hub.date}`);
      }
      for (const sourceId of projectGraph.eventSourceIdsByChoice?.[branch.choiceId] || []) {
        assert.ok(sourceIds.has(sourceId), `${branch.choiceId} selected event missing ${sourceId}`);
        const source = [...(main20.sourceRegister || []), ...addedSources, ...censorshipCase.items].find(item => item.sourceId === sourceId);
        const available = source?.availableDate || source?.availabilityDate || source?.date;
        assert.ok(available && available <= hub.date, `${branch.choiceId} event exposes ${sourceId} (${available || 'unknown'}) before ${hub.date}`);
      }
      assert.ok(branch.speakerLines?.length, `${branch.choiceId} has no authored dialogue`);
      assert.ok(branch.event?.fictionalInterpretation, `${branch.choiceId} event must be marked as fictional interpretation`);
      assert.ok(projectGraph.eventPredicates.nextHubAcknowledgements.some(group => group.reactionTexts?.[branch.nextHubReactionId]), `${branch.choiceId} has no visible next-hub callback`);
    }
  }
  assert.ok(projectGraph.hubs.some(hub => hub.id === 'H4-NEWS' && hub.date.startsWith('1848-')), '1848 event family must be dated in 1848');
  assert.deepEqual(new Set(projectGraph.hubs.map(hub => hub.eventFamily)), new Set(['reading_circle', 'rank_history_exam', 'literature_in_company', 'periodical_circulation_response']));
  assert.ok(projectGraph.branches.filter(branch => branch.hubId === 'H4-NEWS').every(branch => branch.sourceIds.includes('OBJ-WS-SOVREMENNIK-1848')));
});

test('E02 and E04 remain in the active chronological player route', async () => {
  assert.ok(main20.v44MainSceneIds?.includes('E02'), 'E02 must not be silently archived from the active route');
  const activeIds = [...main20.v44MainSceneIds, 'E04'];
  for (const id of ['E02', 'E04', 'E07']) assert.ok(activeIds.includes(id), `${id} is not active`);
  assert.deepEqual(projectGraph.sequence.slice(0, 4), ['E02', 'E04', 'H1-CIRCLE', 'H2-EXAM']);
  assert.ok(projectGraph.hubs.find(hub => hub.id === 'H1-CIRCLE').date > projectGraph.anchors.find(anchor => anchor.id === 'E04').date);
  const runtime = await readFile(new URL('../main20-runtime.js', import.meta.url), 'utf8');
  assert.match(runtime, /current\.id === 'E04' && !state\.c07IdeologyComplete/);
});

test('every immediate branch choice carries auditable, non-terminal ending evidence into saved history', async () => {
  const route = JSON.parse(await readFile(new URL('../narrative/ACT_III_BRANCH_ROUTE.json', import.meta.url), 'utf8'));
  const source = await readFile(new URL('../main20-runtime.js', import.meta.url), 'utf8');
  const validEndings = new Set(route.endingRoutes);
  assert.equal(route.branches.length, 12);
  for (const branch of route.branches) {
    const affinity = route.choiceEndingAffinity?.[branch.choiceId];
    assert.ok(affinity && Object.keys(affinity).length > 0, `${branch.choiceId} should inform later ending compatibility`);
    assert.ok(Object.keys(affinity).every(id => validEndings.has(id)), `${branch.choiceId} uses an unknown ending`);
    assert.ok(Object.values(affinity).every(value => Number.isFinite(value) && value > 0 && value <= 2));
  }
  assert.match(source, /endingAffinity:\s*branchGraph\.choiceEndingAffinity\?\.\[branch\.choiceId\]/);
  assert.match(source, /const values = item\.endingAffinity \|\| choice\?\.endingAffinity \|\| \{\}/);
});

test('literature choice source is displayed before selection and again in its selected event', async () => {
  const route = JSON.parse(await readFile(new URL('../narrative/ACT_III_BRANCH_ROUTE.json', import.meta.url), 'utf8'));
  const additions = JSON.parse(await readFile(new URL('../narrative/ACT_III_BRANCHING_SOURCES.json', import.meta.url), 'utf8'));
  const source = await readFile(new URL('../main20-runtime.js', import.meta.url), 'utf8');
  const ids = new Set(additions.map(item => item.sourceId));
  for (const choiceId of ['BOOK-DISCUSS', 'BOOK-PRIVATE', 'BOOK-QUESTION']) {
    assert.ok((route.choiceSourceIds?.[choiceId] || []).length > 0, `${choiceId} has no linked reading`);
    for (const sourceId of route.choiceSourceIds[choiceId]) assert.ok(ids.has(sourceId), `missing ledger source ${sourceId}`);
  }
  for (const [choiceId, sourceIds] of Object.entries(route.eventSourceIdsByChoice)) {
    assert.ok(['BOOK-DISCUSS', 'BOOK-PRIVATE', 'BOOK-QUESTION'].includes(choiceId), `${choiceId} event-only source leaks into the pre-choice paper`);
    assert.ok(sourceIds.length > 0);
  }
  assert.match(source, /options\.flatMap\(\(branch\) => branchSourceIds\(branch\)\)/);
  assert.match(source, /function branchEventSourceIds\(branch\)/);
  assert.match(source, /renderBranchPaper\(branch\.event\.title,[^\n]*branchEventSourceIds\(branch\)/);
  assert.deepEqual(route.eventSourceIdsByChoice['BOOK-DISCUSS'], ['EXT-TURGENEV-ERMOLAI-MILLER-1847', 'EXT-TURGENEV-KONTORA-1847', 'EXT-TURGENEV-KARATAEV-1847', 'EXT-NEKRASOV-NIGHT-STREET-1847', 'EXT-TURGENEV-OVSYANIKOV-1847', 'EXT-BELINSKY-CONTEMPORARY-NOTES-1847']);
  assert.ok(route.eventSourceIdsByChoice['BOOK-PRIVATE'].includes('EXT-DOSTOEVSKY-POOR-FOLK-1846'));
  assert.ok(route.branches.find(branch => branch.choiceId === 'NEWS-REPORT')?.eventSourceIds?.includes('EXT-NEKRASOV-EDITORIAL-ANON-1848'));
});
