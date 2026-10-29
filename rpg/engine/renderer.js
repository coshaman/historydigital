export function createRenderer(canvas, assets) {
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const images = new Map();
  const mapCache = new Map();
  function getImage(url) {
    if (!images.has(url)) { const image = new Image(); image.onload = () => mapCache.clear(); image.src = url; images.set(url, image); }
    return images.get(url);
  }
  const tileImage = getImage(new URL('../assets/petersburg-tiles.png', import.meta.url));
  const hostCards = assets.hostCards;
  const tile = 16;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  function resize() {
    const rect = canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    ctx.imageSmoothingEnabled = false;
  }
  function mapCanvas(map) {
    if (mapCache.has(map.mapId)) return mapCache.get(map.mapId);
    if (!tileImage.complete || !tileImage.naturalWidth) return null;
    const surface = document.createElement('canvas'); surface.width = map.width * tile; surface.height = map.height * tile;
    const paint = surface.getContext('2d'); paint.imageSmoothingEnabled = false;
    for (const layer of map.layers.filter(item => item.type === 'tilelayer')) {
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        const gid = layer.data[y * map.width + x]; if (!gid) continue;
        const index = gid - 1, sx = (index % 16) * tile, sy = Math.floor(index / 16) * tile;
        paint.drawImage(tileImage, sx, sy, tile, tile, x * tile, y * tile, tile, tile);
      }
    }
    mapCache.set(map.mapId, surface);
    return surface;
  }
  function draw(state, map, time = 0, lastMoveAt = 0) {
    resize();
    const ratio = canvas.width / canvas.getBoundingClientRect().width;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const w = canvas.clientWidth, h = canvas.clientHeight, scale = Math.min(w / (map.width * tile), h / (map.height * tile));
    const ox = (w - map.width * tile * scale) / 2, oy = (h - map.height * tile * scale) / 2;
    ctx.fillStyle = '#62564b'; ctx.fillRect(0, 0, w, h);
    const background = mapCanvas(map);
    if (background) ctx.drawImage(background, ox, oy, background.width * scale, background.height * scale);
    if (map.metadata?.mapClass === 'LITERARY_REALM') {
      ctx.save();
      ctx.fillStyle = '#9a6b3822';
      ctx.fillRect(ox, oy, map.width * tile * scale, map.height * tile * scale);
      const edge = ctx.createRadialGradient(ox + map.width * tile * scale / 2, oy + map.height * tile * scale / 2, 30 * scale, ox + map.width * tile * scale / 2, oy + map.height * tile * scale / 2, Math.max(map.width * tile, map.height * tile) * scale * .72);
      edge.addColorStop(0, '#f3dfb000'); edge.addColorStop(1, '#2c181e66');
      ctx.fillStyle = edge; ctx.fillRect(ox, oy, map.width * tile * scale, map.height * tile * scale);
      ctx.restore();
    }
    const objectLayer = map.layers.find(item => item.name === 'Interactions');
    for (const object of objectLayer?.objects ?? []) {
      const p = Object.fromEntries((object.properties ?? []).map(v => [v.name, v.value]));
      const x = ox + object.x * scale, y = oy + object.y * scale;
      if (object.type === 'map-exit') { ctx.fillStyle = '#c49c62'; ctx.fillRect(x + 4 * scale, y + 3 * scale, 8 * scale, 12 * scale); ctx.fillStyle = '#382820'; ctx.fillRect(x + 6 * scale, y + 5 * scale, 5 * scale, 10 * scale); }
      else { ctx.fillStyle = object.type === 'quest-object' ? '#b78342' : '#d5c193'; ctx.fillRect(x + 4 * scale, y + 4 * scale, 8 * scale, 8 * scale); ctx.fillStyle = '#30231e'; ctx.fillRect(x + 6 * scale, y + 6 * scale, 4 * scale, 4 * scale); }
      if (state.player.embodiment && p.questId && state.quests[p.questId]?.status === 'open') { ctx.strokeStyle = '#f0d79e'; ctx.lineWidth = 1.5; ctx.strokeRect(x + 1, y + 1, 14 * scale, 14 * scale); }
    }
    for (const card of hostCards) {
      const host = state.hosts[card.id]; if (!host || host.mapId !== map.mapId) continue;
      const sprite = getImage(new URL(`../${card.sprite.file}`, import.meta.url));
      const active = state.player.embodiment === card.id;
      const frame = !reducedMotion && active && time - lastMoveAt < 360 ? Math.floor(time / 120) % 3 : 0;
      const dir = ({ down: 0, up: 1, left: 2, right: 3 })[host.facing] ?? 0, px = ox + host.position.x * tile * scale, py = oy + host.position.y * tile * scale;
      if (sprite.complete && sprite.naturalWidth) ctx.drawImage(sprite, frame * 16, dir * 24, 16, 24, px, py - 8 * scale, 16 * scale, 24 * scale);
      if (state.player.embodiment === card.id) { ctx.strokeStyle = '#f2d38b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(px + 8 * scale, py + 15 * scale, 8 * scale, 3 * scale, 0, 0, Math.PI * 2); ctx.stroke(); }
    }
    const actor = state.player.embodiment ? state.hosts[state.player.embodiment] : state.player;
    const px = ox + actor.position.x * tile * scale, py = oy + actor.position.y * tile * scale;
    if (!state.player.embodiment) { ctx.fillStyle = '#efe0b5'; ctx.fillRect(px + 7 * scale, py + 5 * scale, 3 * scale, 8 * scale); ctx.fillRect(px + 5 * scale, py + 3 * scale, 7 * scale, 3 * scale); }
    // Warm paper lanterns mark the active space without covering tile detail.
    const glow = ctx.createRadialGradient(px + 8 * scale, py + 8 * scale, 2, px + 8 * scale, py + 8 * scale, 46 * scale);
    glow.addColorStop(0, '#d4a35d18'); glow.addColorStop(1, '#d4a35d00'); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = glow; ctx.fillRect(ox, oy, map.width * tile * scale, map.height * tile * scale); ctx.globalCompositeOperation = 'source-over';
  }
  return { draw };
}
