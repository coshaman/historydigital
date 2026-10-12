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

function makePrefixEventNodes(graph) {
  const nodes = [];
  const visit = (prefix, predecessorNodeId) => {
    const hub = graph.hubs[prefix.length];
    const branches = graph.branches.filter(branch => branch.hubId === hub.id);
    for (const branch of branches) {
      const requiredPrefix = [...prefix, branch.choiceId];
      const id = `NODE-${requiredPrefix.join('--')}`;
      nodes.push({ id, requiredPrefix, hubId: hub.id, predecessorNodeId, date: hub.date, location: 'Office', dialogue: [{ speaker: 'pavel', text: 'We should keep this separate.' }], sourceIds: ['SRC-1'], visibleCallbacks: [branch.callbackKey], immediateNextAction: 'Continue to the next record.' });
      if (requiredPrefix.length < graph.hubs.length) visit(requiredPrefix, id);
    }
  };
  visit([], null);
  return nodes;
}

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

test('resolves one authored event by the exact ordered choice prefix', () => {
  const graph = makeGraph();
  graph.eventNodes = [
    { id: 'NODE-A', requiredPrefix: ['B1-1', 'B2-2'] },
    { id: 'NODE-B', requiredPrefix: ['B1-2', 'B2-2'] }
  ];
  assert.equal(branchGraph.resolvePrefixEventNode(graph, ['B1-2', 'B2-2']).id, 'NODE-B');
});

test('rejects ambiguous, absent, and out-of-order authored event prefixes', () => {
  const graph = makeGraph();
  graph.eventNodes = [
    { id: 'NODE-A', requiredPrefix: ['B1-1', 'B2-2'] },
    { id: 'NODE-DUPLICATE', requiredPrefix: ['B1-1', 'B2-2'] }
  ];
  assert.throws(() => branchGraph.resolvePrefixEventNode(graph, ['B1-1', 'B2-2']), /ambiguous/i);
  graph.eventNodes.pop();
  assert.throws(() => branchGraph.resolvePrefixEventNode(graph, ['B1-3', 'B2-1']), /no authored event/i);
  assert.throws(() => branchGraph.resolvePrefixEventNode(graph, ['B2-2', 'B1-1']), /out of order/i);
});

test('requires exactly one valid, source-linked event node for all 120 route prefixes', () => {
  const graph = makeGraph();
  graph.eventNodes = makePrefixEventNodes(graph);
  assert.equal(graph.eventNodes.length, 120);
  assert.deepEqual(validateBranchGraph(graph, ['SRC-1']), { valid: true, errors: [] });

  graph.eventNodes.pop();
  assert.match(validateBranchGraph(graph, ['SRC-1']).errors.join('\n'), /missing.*prefix|prefix.*coverage/i);
});

test('rejects route event nodes with invalid predecessor, hub, source, or absent dialogue', () => {
  const graph = makeGraph();
  graph.eventNodes = makePrefixEventNodes(graph);
  graph.eventNodes[0].predecessorNodeId = 'MISSING-PREDECESSOR';
  graph.eventNodes[1].hubId = 'MISSING-HUB';
  graph.eventNodes[2].sourceIds = ['MISSING-SOURCE'];
  graph.eventNodes[3].dialogue = [];
  const errors = validateBranchGraph(graph, ['SRC-1']).errors.join('\n');
  assert.match(errors, /predecessor/i);
  assert.match(errors, /hub/i);
  assert.match(errors, /source/i);
  assert.match(errors, /dialogue/i);
});

test('rejects route event nodes that disclose sources before their publication availability date', () => {
  const graph = makeGraph();
  graph.eventNodes = makePrefixEventNodes(graph);
  graph.eventNodes[0].sourceIds = ['SRC-FUTURE'];
  const sources = [{ sourceId: 'SRC-1' }, { sourceId: 'SRC-FUTURE', availabilityDate: '1849-01-01' }];
  assert.match(validateBranchGraph(graph, sources).errors.join('\n'), /SRC-FUTURE.*before|before.*SRC-FUTURE/i);
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
  assert.deepEqual(projectGraph.sequence, ['E02', 'V42-C07-GOGOL-1847', 'E04', 'V42-C07-BELINSKY-1847', 'H1-CIRCLE', 'H2-EXAM', 'H3-READING', 'H4-NEWS', 'E07']);
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

test('all 81 complete routes resolve four source-linked prefix-specific scene beats', () => {
  const sourceRecords = [...(main20.sourceRegister ?? []), ...addedSources, ...censorshipCase.items];
  const sourceIds = new Set(sourceRecords.map(source => source.sourceId));
  assert.equal(projectGraph.eventNodes?.length, 120, 'the route must check in all 120 event nodes');
  const perDepth = [1, 2, 3, 4].map(depth => projectGraph.eventNodes.filter(node => node.requiredPrefix.length === depth).length);
  assert.deepEqual(perDepth, [3, 9, 27, 81]);
  assert.deepEqual(validateBranchGraph(projectGraph, sourceRecords), { valid: true, errors: [] });
  for (let depth = 1; depth <= 4; depth += 1) {
    const scenes = projectGraph.eventNodes.filter(node => node.requiredPrefix.length === depth);
    assert.equal(new Set(scenes.map(node => JSON.stringify(node.dialogue))).size, [3, 9, 27, 81][depth - 1], `every depth-${depth} prefix needs distinguishable dialogue`);
  }
  const vectors = enumerateRouteVectors(projectGraph);
  const signatures = new Set();
  for (const vector of vectors) {
    const nodeIds = [];
    const dialogueBeats = [];
    for (let depth = 1; depth <= 4; depth += 1) {
      const node = branchGraph.resolvePrefixEventNode(projectGraph, vector.choiceIds.slice(0, depth));
      nodeIds.push(node.id);
      dialogueBeats.push(node.dialogue.map(line => `${line.speaker}:${line.text}`).join('\n'));
      assert.ok(node.sourceIds.every(id => sourceIds.has(id)), `${node.id} must resolve every source`);
      assert.ok(node.dialogue.length >= 1, `${node.id} must show its route-specific scene beat`);
    }
    assert.equal(new Set(nodeIds).size, 4);
    signatures.add(nodeIds.join('|'));
    assert.equal(dialogueBeats.every(Boolean), true);
  }
  assert.equal(signatures.size, 81);
});

test('E02 and E04 remain in the active chronological player route', async () => {
  assert.ok(main20.v44MainSceneIds?.includes('E02'), 'E02 must not be silently archived from the active route');
  const activeIds = [...main20.v44MainSceneIds, 'E04'];
  for (const id of ['E02', 'E04', 'E07']) assert.ok(activeIds.includes(id), `${id} is not active`);
  assert.deepEqual(projectGraph.sequence.slice(0, 5), ['E02', 'V42-C07-GOGOL-1847', 'E04', 'V42-C07-BELINSKY-1847', 'H1-CIRCLE']);
  assert.ok(projectGraph.hubs.find(hub => hub.id === 'H1-CIRCLE').date > projectGraph.anchors.find(anchor => anchor.id === 'E04').date);
  const runtime = await readFile(new URL('../main20-runtime.js', import.meta.url), 'utf8');
  assert.match(runtime, /current\.id === 'E04' && !state\.c07IdeologyComplete/);
  assert.match(runtime, /current\.id === 'E02' && !state\.c07PreE04Complete/);
  assert.match(runtime, /c07BeatIndex = c07BeforeE04 \? 0 : 1/);
  assert.match(runtime, /state\.sceneIndex = data\.scenes\.findIndex\(\(item\) => item\.id === 'E04'\)/);
});

test('private circle notes are not known by Alexei unless the player shares them', () => {
  const route = projectGraph;
  const leak = route.pairwiseInteractions.find(line => line.currentChoiceId === 'NEWS-FILE' && line.afterChoiceId === 'CIRCLE-KEEP-NOTES');
  assert.doesNotMatch(leak.line.text, /수첩|메모|적었|기록했/);
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
  assert.match(source, /resolvePrefixEventNode\(branchGraph, state\.routeChoices\)/);
  assert.match(source, /renderBranchPaper\(eventNode\.title, eventNode\.date, eventNode\.sourceIds, eventNode\.description\)/);
  assert.match(source, /const eventLines = eventNode\.dialogue/);
  assert.deepEqual(route.eventSourceIdsByChoice['BOOK-DISCUSS'], ['EXT-TURGENEV-ERMOLAI-MILLER-1847', 'EXT-TURGENEV-KONTORA-1847', 'EXT-TURGENEV-KARATAEV-1847', 'EXT-NEKRASOV-NIGHT-STREET-1847', 'EXT-TURGENEV-OVSYANIKOV-1847', 'EXT-BELINSKY-CONTEMPORARY-NOTES-1847', 'EXT-HERZEN-DILETTANTISM-1843', 'EXT-HERZEN-GRANOVSKY-LECTURES-1843', 'EXT-HERZEN-GRANOVSKY-SECOND-LETTER-1844', 'EXT-KAVELIN-LEGAL-LIFE-ANCIENT-RUSSIA-1847', 'EXT-KAVELIN-REPLY-MOSKVITYANIN-1847', 'EXT-KHOMYAKOV-RUSSIAN-ART-SCHOOL-1847', 'EXT-HERZEN-PUBLIC-LECTURES-ROULIER-1845', 'EXT-BELINSKY-GOGOL-REVIEW-1847', 'EXT-NEKRASOV-NEW-POET-1847']);
  assert.ok(route.eventSourceIdsByChoice['BOOK-PRIVATE'].includes('EXT-DOSTOEVSKY-POOR-FOLK-1846'));
  assert.ok(route.eventSourceIdsByChoice['BOOK-PRIVATE'].includes('EXT-DOSTOEVSKY-NINE-LETTERS-1847'));
  assert.ok(route.eventSourceIdsByChoice['BOOK-QUESTION'].includes('EXT-PANAEV-RELATIVES-1847'));
  assert.ok(route.eventSourceIdsByChoice['BOOK-QUESTION'].includes('EXT-BRANT-ANTON-GOREMYKA-REVIEW-1847'));
  assert.ok(route.branches.find(branch => branch.choiceId === 'NEWS-REPORT')?.eventSourceIds?.includes('EXT-NEKRASOV-EDITORIAL-ANON-1848'));
});

test('each later hub resolves a distinct authored line for all prior hub-choice combinations', () => {
  assert.ok(Array.isArray(projectGraph.pairwiseInteractions), 'route has no pairwise event dialogue');
  let pairCount = 0;
  for (const laterHub of projectGraph.hubs.slice(1)) {
    const earlierHubs = projectGraph.hubs.slice(0, projectGraph.hubs.indexOf(laterHub));
    for (const current of projectGraph.branches.filter(branch => branch.hubId === laterHub.id)) {
      for (const earlierHub of earlierHubs) {
        const earlierBranches = projectGraph.branches.filter(branch => branch.hubId === earlierHub.id);
        const texts = earlierBranches.map(earlier => resolveBranchEvent(projectGraph, laterHub.id, current.choiceId, {
          routeChoices: projectGraph.hubs.slice(0, projectGraph.hubs.indexOf(laterHub)).map(hub => hub.id === earlierHub.id ? earlier.choiceId : projectGraph.branches.find(branch => branch.hubId === hub.id).choiceId)
        }).interactionLines?.find(line => line.choiceId === earlier.choiceId)?.text);
        assert.ok(texts.every(Boolean), `${earlierHub.id} -> ${laterHub.id}/${current.choiceId} has an unresolved event response`);
        assert.equal(new Set(texts).size, earlierBranches.length, `${laterHub.id}/${current.choiceId} collapses earlier ${earlierHub.id} choices into identical dialogue`);
        pairCount += texts.length;
      }
    }
  }
  assert.equal(pairCount, 54);
});

test('rejects malformed, duplicated, unreachable, or out-of-route pairwise dialogue', () => {
  const graph = structuredClone(projectGraph);
  graph.pairwiseInteractions = [...graph.pairwiseInteractions, { ...graph.pairwiseInteractions[0] }];
  graph.pairwiseInteractions.push({ currentChoiceId: 'MISSING-CHOICE', afterChoiceId: 'CIRCLE-ATTEND', line: { speaker: 'pavel', text: '...' } });
  graph.pairwiseInteractions.push({ currentChoiceId: 'BOOK-DISCUSS', afterChoiceId: 'CIRCLE-ATTEND', line: { speaker: '', text: '' } });
  assert.match(validateBranchGraph(graph, [...addedSources.map(source => source.sourceId), ...(main20.sourceRegister ?? []).map(source => source.sourceId)]).errors.join('\n'), /pairwise interaction/i);
});
