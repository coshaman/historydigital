import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const graph = await readJson(path.join(root, 'data/v37_fictional_kinship_graph.json'));
if (graph.schemaVersion !== 'V37_FICTIONAL_KINSHIP_GRAPH_1' || graph.status !== 'FICTIONAL_CHARACTER_DESIGN'
  || graph.historicalClaim !== false || !Array.isArray(graph.edges)) throw new Error('Invalid fictional kinship graph');
const files = (await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json'));
const cards = new Map();
for (const file of files) {
  const card = await readJson(path.join(root, 'rpg/characters', file));
  cards.set(card.id, { file, card });
}
const fictionalIds = new Set([...cards].filter(([, item]) => item.card.kind === 'FICTIONAL').map(([id]) => id));
const coverage = new Map();
for (const edge of graph.edges) {
  if (!edge.id || !fictionalIds.has(edge.a) || !fictionalIds.has(edge.b) || edge.a === edge.b
    || !['SIBLING', 'OTHER_KIN'].includes(edge.kind) || !edge.basisKo) throw new Error(`Invalid kinship edge: ${edge.id}`);
  for (const id of [edge.a, edge.b]) {
    coverage.set(id, [...(coverage.get(id) ?? []), edge.id]);
    if (coverage.get(id).length > 1) throw new Error(`Duplicate kinship assignment for ${id}`);
  }
}
const uncovered = [...fictionalIds].filter(id => !coverage.has(id));
if (uncovered.length) throw new Error(`Missing fictional family ties: ${uncovered.join(', ')}`);

for (const edge of graph.edges) {
  const a = cards.get(edge.a), b = cards.get(edge.b);
  const profiles = [
    [a, b, edge.aCallsB],
    [b, a, edge.bCallsA],
  ];
  for (const [owner, relative, kinLabel] of profiles) {
    if (!kinLabel) throw new Error(`Missing kin label in ${edge.id}`);
    const relation = { targetHostId: relative.card.id, kind: edge.kind,
      relationshipKo: `${relative.card.displayNameKo}는 내 ${kinLabel}다. ${edge.basisKo} (게임용 허구 설정).`,
      status: 'FICTIONAL_CHARACTER_DESIGN', graphEdgeId: edge.id };
    owner.card.kinshipRelations ??= [];
    const existing = owner.card.kinshipRelations.find(item => item.targetHostId === relative.card.id);
    if (existing && (existing.kind !== relation.kind || existing.graphEdgeId && existing.graphEdgeId !== edge.id)) {
      throw new Error(`Authored kinship conflict: ${owner.card.id} -> ${relative.card.id}`);
    }
    if (existing) {
      existing.status ??= relation.status;
      existing.graphEdgeId ??= edge.id;
    } else owner.card.kinshipRelations.push(relation);
    const priorSocialTie = owner.card.relations?.[relative.card.id];
    if (priorSocialTie === relation.relationshipKo) delete owner.card.relations[relative.card.id];
    else if (typeof priorSocialTie === 'string' && priorSocialTie.endsWith(` · ${kinLabel}`)) {
      owner.card.relations[relative.card.id] = priorSocialTie.slice(0, -(` · ${kinLabel}`).length);
    }
  }
}
for (const { file, card } of cards.values()) {
  await writeFile(path.join(root, 'rpg/characters', file), `${JSON.stringify(card, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify({ status: 'PASS', fictionalResidents: fictionalIds.size, authoredKinshipEdges: graph.edges.length,
  residentsWithFamily: coverage.size, historicalClaim: graph.historicalClaim,
  sharedHouseholdEdgesRemainSeparate: true }, null, 2));
