import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const batchArgIndex = process.argv.indexOf('--batch');
const batchNumber = Number(process.argv.find(arg => arg.startsWith('--batch='))?.split('=')[1] ?? process.argv[batchArgIndex + 1] ?? process.env.npm_config_batch);
if (!Number.isInteger(batchNumber) || batchNumber < 1 || batchNumber > 6) throw new Error('Pass --batch=1 through --batch=6');
const registry = JSON.parse(await fs.readFile(path.join(root, 'rpg/data/resident-relationships-v36.json'), 'utf8'));
const batch = registry.batches.find(row => row.id === batchNumber);
if (!batch || batch.residentIds.length !== registry.batchSize) throw new Error(`Relationship batch ${batchNumber} must contain six residents`);
const rows = new Map(batch.residentIds.map(id => [id, {}]));
for (const edge of batch.edges) {
  if (!rows.has(edge.a) || !rows.has(edge.b) || edge.a === edge.b) throw new Error(`Invalid relationship edge: ${edge.a} ↔ ${edge.b}`);
  rows.get(edge.a)[edge.b] = edge.aToB;
  rows.get(edge.b)[edge.a] = edge.bToA;
}
for (const id of batch.residentIds) {
  const file = path.join(root, `rpg/characters/${id}.json`);
  const card = JSON.parse(await fs.readFile(file, 'utf8'));
  if (card.kind !== 'FICTIONAL') throw new Error(`${id} is not marked fictional`);
  card.relations = { ...card.relations, ...rows.get(id) };
  card.relationsStatus = registry.status;
  await fs.writeFile(file, `${JSON.stringify(card, null, 2)}\n`);
}
console.log(JSON.stringify({ status: 'APPLIED', batch: batchNumber, residents: batch.residentIds, authoredReciprocalEdges: batch.edges.length }, null, 2));
