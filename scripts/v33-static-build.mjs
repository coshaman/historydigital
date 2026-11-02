import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd(), output = path.join(root, 'dist-v33');
const required = ['index.html', 'chancery.html', 'rpg/main.js', 'rpg/rpg.css', 'rpg/engine/game-state.js', 'rpg/engine/learning-life.mjs', 'rpg/engine/civic-life.mjs', 'rpg/engine/dialogue-response.mjs', 'rpg/data/learning-exam.json', 'rpg/data/learning-sources.json', 'rpg/data/life-simulation.json', 'rpg/data/historical-comparisons.json', 'rpg/maps/nevsky.json', 'rpg/maps/printshop.json', 'rpg/maps/chancery.json', 'rpg/maps/courtyard.json', 'rpg/maps/police-station.json', 'rpg/characters/editor_sofia.json', 'rpg/characters/police_sergeant_ivan.json', 'rpg/assets/petersburg-tiles.png', 'rpg/assets/chichikov.png', 'rpg/assets/nekrasov.png'];
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(output, { recursive: true });
await fs.copyFile(path.join(root, 'index.html'), path.join(output, 'index.html'));
await fs.copyFile(path.join(root, 'chancery.html'), path.join(output, 'chancery.html'));
await fs.cp(path.join(root, 'rpg'), path.join(output, 'rpg'), { recursive: true });
await fs.writeFile(path.join(output, 'rpg/ai/config.js'), '// AI requests use the same-origin Vercel Function at /api/rpg/.\n');
for (const file of required) {
  const stat = await fs.stat(path.join(output, file)).catch(() => null);
  if (!stat?.isFile() || stat.size === 0) throw new Error(`Missing static RPG artifact: ${file}`);
}
const html = await fs.readFile(path.join(output, 'index.html'), 'utf8');
if (!/rpg\/main\.js/.test(html) || /<(?:script|img|link)\b[^>]*\b(?:src|href)="https?:\/\//i.test(html)) throw new Error('Root entry must load executable and visual assets locally.');
const files = [];
async function inventory(directory, prefix = '') {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name), absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await inventory(absolute, relative); else files.push(relative);
  }
}
await inventory(output);
const manifest = { schemaVersion: 'V33_STATIC_BUILD_V1', entry: 'index.html', preservedEntry: 'chancery.html', basePathSafe: true, aiRuntime: 'VERCEL_FUNCTION_RUNTIME', fileCount: files.length, files };
await fs.writeFile(path.join(output, 'build-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', artifact: 'dist-v33/', entry: manifest.entry, preservedEntry: manifest.preservedEntry, fileCount: files.length }, null, 2));
