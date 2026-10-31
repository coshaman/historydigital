// Direct renderer inspection, not browser/UI or traversal evidence.
// Usage: node scripts/v33-render-map-artifacts.mjs <path-to-@napi-rs/canvas>
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRenderer } from '../rpg/engine/renderer.js';

const require = createRequire(import.meta.url);
const { createCanvas, Image } = require(process.argv[2] || '@napi-rs/canvas');
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'artifacts/v33/RENDER_LAYER_AUDIT');
await fs.mkdir(output, { recursive: true });
const json = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const maps = Object.fromEntries(await Promise.all((await fs.readdir(path.join(root, 'rpg/maps'))).filter(f => f.endsWith('.json')).map(async f => [path.basename(f, '.json'), await json(`rpg/maps/${f}`)])));
const cards = await Promise.all((await fs.readdir(path.join(root, 'rpg/characters'))).filter(f => f.endsWith('.json')).map(f => json(`rpg/characters/${f}`)));
const quests = await Promise.all(['printshop-article', 'public-discourse-1848', 'circle-investigation-1849', 'circle-letter-1849-may', 'literary-dead-souls', 'literary-overcoat'].map(id => json(`rpg/quests/${id}.json`)));
const { createInitialState } = require('../rpg/engine/game-state.js');
globalThis.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: true }) };
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.requestAnimationFrame = () => 1;
const pendingImages = [];
globalThis.Image = class extends Image {
  set src(url) {
    const callback = this.onload;
    pendingImages.push(new Promise((resolve, reject) => {
      this.onload = () => { callback?.(); resolve(); };
      this.onerror = reject;
    }));
    super.src = readFileSync(fileURLToPath(url));
  }
};

// Reproduce only the previous layer-filter bug in an adjacent temporary module,
// preserving relative asset resolution and every other renderer operation.
const rendererPath = path.join(root, 'rpg/engine/renderer.js');
const beforePath = path.join(root, 'rpg/engine/.renderer-layer-before.mjs');
const source = await fs.readFile(rendererPath, 'utf8');
const corrected = "item.type === 'tilelayer' && item.name !== 'Collision' && item.visible !== false";
if (!source.includes(corrected)) throw new Error('Renderer filter changed; update the comparison harness explicitly.');
await fs.writeFile(beforePath, source.replace(corrected, "item.type === 'tilelayer'"));
const reports = [];
try {
  const before = (await import(pathToFileURL(beforePath).href)).createRenderer;
  for (const [id, map] of Object.entries(maps)) {
    const state = createInitialState({ maps, hostCards: cards, quests });
    state.world.currentMapId = id;
    if (map.metadata.realmId) state.world.activeRealm = { id: map.metadata.realmId };
    const collision = map.layers.find(l => l.name === 'Collision');
    const candidates = collision.data.flatMap((blocked, i) => blocked ? [] : [{ x: i % map.width, y: Math.floor(i / map.width) }]);
    const distance = p => Math.abs(p.x - map.width / 2) + Math.abs(p.y - map.height * .4);
    candidates.sort((a, b) => distance(a) - distance(b));
    state.player.position = candidates[0];
    for (const [width, height] of [[1384, 480], [370, 360]]) {
      const pair = createCanvas(width, height * 2), ctx = pair.getContext('2d');
      for (const [index, factory] of [before, createRenderer].entries()) {
        const canvas = createCanvas(width, height);
        canvas.clientWidth = width; canvas.clientHeight = height;
        canvas.getBoundingClientRect = () => ({ width, height });
        const renderer = factory(canvas, { hostCards: cards, quests });
        renderer.draw(state, map, 1000, 0);
        await Promise.all(pendingImages);
        renderer.draw(state, map, 1000, 0);
        ctx.drawImage(canvas, 0, height * index);
        ctx.fillStyle = '#16120f'; ctx.fillRect(8, height * index + 8, 180, 28);
        ctx.fillStyle = '#ead9b8'; ctx.font = '16px sans-serif';
        ctx.fillText(index ? 'AFTER: visual layers' : 'BEFORE: collision drawn', 16, height * index + 28);
      }
      const file = `${id}-${width}.png`;
      await fs.writeFile(path.join(output, file), pair.toBuffer('image/png'));
      reports.push({ mapId: id, position: state.player.position, width, height, file, collisionCells: collision.data.filter(Boolean).length });
    }
  }
} finally {
  await fs.unlink(beforePath);
}
await fs.writeFile(path.join(output, 'manifest.json'), JSON.stringify({ evidence: 'Direct native Canvas rendering using real map data and renderer; no browser layout or traversal verified.', comparisons: reports }, null, 2));
console.log(`Rendered ${reports.length} before/after map comparisons to ${output}`);
