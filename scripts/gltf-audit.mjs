import { readFile } from 'node:fs/promises';

const file = new URL('../assets/route-reconstruction.gltf', import.meta.url);
const gltf = JSON.parse(await readFile(file, 'utf8'));
const failures = [];
if (gltf.asset?.version !== '2.0') failures.push('asset.version is not 2.0');
if (!gltf.asset?.generator?.includes('reconstructed route')) failures.push('generator provenance missing');
if (!gltf.asset?.extras?.sources?.length) failures.push('asset source metadata missing');
const buffers = gltf.buffers ?? [];
for (const [index, buffer] of buffers.entries()) {
  if (!buffer.uri?.startsWith('data:')) { failures.push(`buffer ${index}: external URI not self-contained`); continue; }
  const payload = buffer.uri.slice(buffer.uri.indexOf(',') + 1);
  const actual = Buffer.from(payload, 'base64').byteLength;
  if (actual !== buffer.byteLength) failures.push(`buffer ${index}: byteLength ${buffer.byteLength} != decoded ${actual}`);
}
for (const [index, view] of (gltf.bufferViews ?? []).entries()) {
  const buffer = buffers[view.buffer];
  if (!buffer || (view.byteOffset ?? 0) + view.byteLength > buffer.byteLength) failures.push(`bufferView ${index}: outside buffer`);
}
for (const [index, accessor] of (gltf.accessors ?? []).entries()) {
  const view = gltf.bufferViews?.[accessor.bufferView];
  if (!view || accessor.count <= 0) failures.push(`accessor ${index}: invalid view or count`);
}
if ((gltf.nodes ?? []).length < 5) failures.push('fewer than five landmark nodes');
for (const node of gltf.nodes ?? []) if (!node.extras?.sources?.length || !node.extras?.confidence) failures.push(`${node.name}: missing node evidence metadata`);
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`gltf-audit: self-contained glTF 2.0, ${gltf.nodes.length} evidence-tagged landmark nodes — PASS`);
