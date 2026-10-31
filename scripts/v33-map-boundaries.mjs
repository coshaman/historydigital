// Visual repair only: do not change collision, interactions, spawn points or routes.
// Reuses original project tiles within each map's existing reconstruction provenance.
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export function addVisibleBoundaries(map) {
  const arch = map.layers.find(l => l.name === 'Architecture').data;
  const decor = map.layers.find(l => l.name === 'StreetDetail')?.data ?? [];
  const collision = map.layers.find(l => l.name === 'Collision').data;
  const indoor = ['printshop', 'chancery', 'overcoat'].includes(map.mapId);
  for (let i = 0; i < collision.length; i++) {
    if (!collision[i] || arch[i] || decor[i]) continue;
    const x = i % map.width, y = Math.floor(i / map.width);
    const edge = x === 0 || y === 0 || x === map.width - 1 || y === map.height - 1;
    const doorSide = (map.mapId === 'nevsky' && y === 8) || (['printshop', 'chancery'].includes(map.mapId) && y === 16);
    // Walls/door jambs, indoor work surfaces, outdoor crates. These are fictional set dressing.
    arch[i] = edge || doorSide ? (indoor ? 8 : 7) : (indoor ? 25 : 27);
  }
  return map;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const file of await fs.readdir('rpg/maps')) {
    if (!file.endsWith('.json')) continue;
    const target = `rpg/maps/${file}`;
    const map = addVisibleBoundaries(JSON.parse(await fs.readFile(target, 'utf8')));
    await fs.writeFile(target, JSON.stringify(map, null, 2) + '\n');
  }
}
