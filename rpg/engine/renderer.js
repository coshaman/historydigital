import { objectIsPresent, interactionTile, isActionableInteraction, ambientBubbleFor } from './world-presentation.mjs';
import { atmosphereForMap, mapHasAtmosphere, weatherForDate } from './atmosphere.mjs';
import { drawPetersburgStreetLife } from './petersburg-street-life.mjs';
import { actorStepLift, drawElevatedSprite, drawGroundShadow, objectShadowElevation, sortSceneByGroundDepth } from './depth-rendering.mjs';

export function courtyardFireDamageMark(state, map) {
  const event = state?.world?.livingEventStates?.E27;
  if (map?.mapId !== 'courtyard' || event?.stage !== 'DAMAGE_SPREAD' || event.propertyDamage < 1) return null;
  const scene = event.scenePosition ?? { x: 15, y: 11 };
  return { x: Math.min(23, scene.x + 1), y: Math.max(0, scene.y - 2), severity: Math.min(2, event.propertyDamage) };
}

function drawE41Scene(ctx, state, map, ox, oy, scale, reducedMotion) {
  const event = state?.world?.livingEventStates?.E41;
  if (map?.mapId !== 'semenovsky-square' || event?.status !== 'ACTIVE') return;
  const px = x => ox + x * 16 * scale, py = y => oy + y * 16 * scale;
  const block = (x, y, dx, dy, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(px(x) + dx * scale, py(y) + dy * scale, w * scale, h * scale);
  };
  const person = (x, y, coat, shirt = '#d8d0ba', offset = 0) => {
    block(x, y, 6, offset, 4, 4, '#bd9878');
    block(x, y, 4, 4 + offset, 8, 7, coat);
    block(x, y, 6, 5 + offset, 4, 5, shirt);
    block(x, y, 4, 11 + offset, 3, 4, '#302923');
    block(x, y, 9, 11 + offset, 3, 4, '#302923');
  };
  ctx.save();
  // The letter describes three men already at the posts and a large crowd seen on the way in.
  // The assembled crowd and order reader are stage dressing; no unnamed face is given a biography.
  for (const [x, y, color] of [[3,5,'#4f4140'],[6,6,'#625143'],[9,5,'#37464a'],[12,6,'#61504a'],
    [18,5,'#3c4842'],[21,6,'#5c493e'],[4,12,'#514a40'],[7,13,'#394348'],[18,12,'#5b5048'],[21,13,'#44454a']]) {
    person(x, y, color, '#d0c4ad', reducedMotion ? 0 : ((x + y) % 3 === 0 ? 0 : 1));
  }
  // Three posts and the waiting row keep the documented three-at-a-time sequence legible.
  for (const x of [12, 13, 14]) {
    block(x, 8, 7, 0, 2, 18, '#503b2a');
    block(x, 8, 5, 0, 6, 2, '#755638');
    person(x + 0.5, 9.2, '#f0e8d7', '#f0e8d7');
  }
  person(16, 10, '#f0e8d7', '#f0e8d7');
  // An unnamed officer reads the order, as the letter says it was read aloud.
  person(18, 7, '#403d39', '#d8d0ba');
  block(18, 7, 11, -14, 7, 5, '#eadbb8');
  block(18, 7, 13, -13, 4, 0.8, '#9b7546');
  ctx.restore();
}

export function calculateCamera({ viewportWidth, viewportHeight, mapWidth, mapHeight, tileSize = 16, position, zoom = 2.25 }) {
  const mapWidthWorld = mapWidth * tileSize, mapHeightWorld = mapHeight * tileSize;
  const fitScale = Math.min(viewportWidth / mapWidthWorld, viewportHeight / mapHeightWorld);
  const scale = fitScale * zoom;
  const visibleWidth = viewportWidth / scale, visibleHeight = viewportHeight / scale;
  const centerX = (position.x + 0.5) * tileSize, centerY = (position.y + 0.5) * tileSize;
  const offsetX = mapWidthWorld <= visibleWidth
    ? (viewportWidth - mapWidthWorld * scale) / 2
    : -Math.max(0, Math.min(mapWidthWorld - visibleWidth, centerX - visibleWidth / 2)) * scale;
  const offsetY = mapHeightWorld <= visibleHeight
    ? (viewportHeight - mapHeightWorld * scale) / 2
    : -Math.max(0, Math.min(mapHeightWorld - visibleHeight, centerY - visibleHeight / 2)) * scale;
  return {
    scale,
    offsetX,
    offsetY,
    viewportWidth,
    viewportHeight,
    mapWidthPixels: mapWidthWorld * scale,
    mapHeightPixels: mapHeightWorld * scale,
    visibleTilesX: visibleWidth / tileSize,
    visibleTilesY: visibleHeight / tileSize,
    actorScreenX: offsetX + centerX * scale,
    actorScreenY: offsetY + centerY * scale,
  };
}

export function createRenderer(canvas, assets) {
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const images = new Map();
  const mapCache = new Map();
  let latestDrawArgs = null;
  let assetFrameQueued = false;
  function redrawAfterAssetLoad() {
    if (!latestDrawArgs || assetFrameQueued) return;
    assetFrameQueued = true;
    requestAnimationFrame(() => {
      assetFrameQueued = false;
      if (latestDrawArgs) draw(...latestDrawArgs);
    });
  }
  function getImage(url) {
    if (!images.has(url)) { const image = new Image(); image.onload = () => { mapCache.clear(); redrawAfterAssetLoad(); }; image.src = url; images.set(url, image); }
    return images.get(url);
  }
  const tileImage = getImage(new URL('../assets/petersburg-tiles.png', import.meta.url));
  const rainSprites = Array.from({ length: 5 }, (_, frame) =>
    getImage(new URL(`../assets/weather/rain_drop_${frame}.png`, import.meta.url)));
  const hostCards = assets.hostCards;
  const tile = 16;
  const motionPreference = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionPreference?.matches ?? false;
  motionPreference?.addEventListener?.('change', event => { reducedMotion = event.matches; redrawAfterAssetLoad(); });
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
    // Collision uses 1 as a boolean mask, not the cobblestone tile with gid 1.
    for (const layer of map.layers.filter(item => item.type === 'tilelayer' && item.name !== 'Collision' && item.visible !== false)) {
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
        const gid = layer.data[y * map.width + x]; if (!gid) continue;
        const index = gid - 1, sx = (index % 16) * tile, sy = Math.floor(index / 16) * tile;
        paint.drawImage(tileImage, sx, sy, tile, tile, x * tile, y * tile, tile, tile);
      }
    }
    mapCache.set(map.mapId, surface);
    return surface;
  }
  function draw(state, map, time = 0, lastMoveAt = 0, objective = null) {
    latestDrawArgs = [state, map, time, lastMoveAt, objective];
    resize();
    const ratio = canvas.width / canvas.getBoundingClientRect().width;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const actor = state.player.embodiment ? state.hosts[state.player.embodiment] : state.player;
    const camera = calculateCamera({ viewportWidth: w, viewportHeight: h, mapWidth: map.width, mapHeight: map.height,
      tileSize: tile, position: actor.position, zoom: Number(map.metadata?.cameraZoom) || 2.25 });
    const { scale, offsetX: ox, offsetY: oy } = camera;
    const weather = weatherForDate(state.world.date, Math.floor((state.world.clockMinutes ?? 0) / 1440));
    ctx.fillStyle = map.metadata?.canvasGutterColor ?? '#62564b'; ctx.fillRect(0, 0, w, h);
    const background = mapCanvas(map);
    if (background) ctx.drawImage(background, ox, oy, background.width * scale, background.height * scale);
    drawPetersburgStreetLife(ctx, map.mapId, ox, oy, scale, time, reducedMotion, map.width, weather);
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
    const visibleObjects = (objectLayer?.objects ?? []).filter(object => objectIsPresent(object, state, assets.quests));
    const visibleActors = [...hostCards].filter(card => {
      const host = state.hosts[card.id];
      return host && host.mapId === map.mapId && host.historicalAliveAndPresent !== false;
    });
    drawE41Scene(ctx, state, map, ox, oy, scale, reducedMotion);
    const procession = state.world.livingEventStates?.E45;
    if (procession?.status === 'ACTIVE' && procession.carriageMapId === map.mapId && procession.carriagePosition) {
      const carriage = getImage(new URL('../assets/carriage-blocking.svg', import.meta.url));
      if (carriage.complete && carriage.naturalWidth) {
        const x = ox + procession.carriagePosition.x * tile * scale;
        const y = oy + (procession.carriagePosition.y - 0.5) * tile * scale;
        ctx.drawImage(carriage, x, y, 32 * scale, 24 * scale);
      }
    }
    const fireDamage = courtyardFireDamageMark(state, map);
    if (fireDamage) {
      const x = ox + fireDamage.x * tile * scale, y = oy + fireDamage.y * tile * scale;
      ctx.save();
      ctx.fillStyle = 'rgba(25,15,11,.68)';
      ctx.fillRect(x + 2 * scale, y + 5 * scale, 12 * scale, 8 * scale);
      ctx.fillRect(x + 4 * scale, y + 2 * scale, 7 * scale, 4 * scale);
      ctx.fillRect(x + 1 * scale, y + 10 * scale, 4 * scale, 4 * scale);
      ctx.fillStyle = 'rgba(12,9,8,.55)';
      ctx.fillRect(x + 5 * scale, y + 4 * scale, 5 * scale, 8 * scale);
      ctx.fillStyle = '#72523a';
      ctx.fillRect(x + 7 * scale, y + 7 * scale, scale, 5 * scale);
      ctx.fillRect(x + 10 * scale, y + 9 * scale, scale, 3 * scale);
      if (fireDamage.severity > 1) {
        ctx.fillStyle = 'rgba(20,13,10,.5)';
        ctx.fillRect(x - 2 * scale, y + 11 * scale, 5 * scale, 4 * scale);
        ctx.fillRect(x + 12 * scale, y + 3 * scale, 4 * scale, 7 * scale);
      }
      ctx.restore();
    }
    const sceneEntries = sortSceneByGroundDepth([
      ...visibleObjects.map((object, index) => {
        const p = Object.fromEntries((object.properties ?? []).map(property => [property.name, property.value]));
        const height = Number(p.displayHeight) || tile;
        return { kind: 'object', object, properties: p, stableOrder: index, depthOrder: 0,
          groundY: object.y + (Number(p.displayOffsetY) || 0) + height };
      }),
      ...visibleActors.map((card, index) => ({ kind: 'actor', card, stableOrder: index, depthOrder: 1,
        groundY: state.hosts[card.id].position.y * tile + tile })),
    ]);
    for (const entry of sceneEntries) {
      if (entry.kind === 'object') {
        const { object, properties: p } = entry;
        const x = ox + object.x * scale, y = oy + object.y * scale;
        const index = interactionTile(object) - 1;
        const width = Number(p.displayWidth) || tile, height = Number(p.displayHeight) || tile;
        const imageX = x + (Number(p.displayOffsetX) || 0) * scale;
        const imageY = y + (Number(p.displayOffsetY) || 0) * scale;
        const baseY = oy + entry.groundY * scale;
        if (p.castShadow !== false) drawGroundShadow(ctx, {
          x: imageX, baseY, width, scale,
          strength: Number(p.shadowStrength) || 1,
          elevation: objectShadowElevation(height, tile, p.shadowElevation),
        });
        if (p.displayAsset) {
          const display = getImage(new URL(p.displayAsset, import.meta.url));
          if (display.complete && display.naturalWidth) ctx.drawImage(display, imageX, imageY, width * scale, height * scale);
        } else if (tileImage.complete && tileImage.naturalWidth) {
          ctx.drawImage(tileImage, index % 16 * tile, Math.floor(index / 16) * tile, tile, tile, x, y, tile * scale, tile * scale);
        }
        if (p.ambientEffect === 'samovar-steam') {
          ctx.save();
          for (let wisp = 0; wisp < 3; wisp += 1) {
            const phase = reducedMotion ? 0.45 : ((time / 1700 + wisp / 3) % 1);
            const rise = phase * 12 * scale;
            ctx.globalAlpha = (1 - phase) * 0.55;
            ctx.strokeStyle = '#f1e5cf'; ctx.lineWidth = Math.max(1.5, scale * 1.15);
            ctx.beginPath();
            ctx.moveTo(x + (8 + wisp * 5) * scale, y - 47 * scale - rise);
            ctx.bezierCurveTo(x + (4 + wisp * 5) * scale, y - 50 * scale - rise,
              x + (14 + wisp * 5) * scale, y - 54 * scale - rise,
              x + (9 + wisp * 5) * scale, y - 58 * scale - rise);
            ctx.stroke();
          }
          ctx.restore();
        }
        continue;
      }
      const { card } = entry;
      const host = state.hosts[card.id];
      const atlas = card.spriteAtlas ?? card.sprite;
      const sprite = getImage(new URL(`../${atlas.file}`, import.meta.url));
      const active = state.player.embodiment === card.id;
      const frameCount = atlas.framesPerDirection ?? 3, frameWidth = atlas.frameWidth ?? 16, frameHeight = atlas.frameHeight ?? 24;
      const frame = !reducedMotion && active && time - lastMoveAt < 360 ? Math.floor(time / 120) % frameCount : 0;
      const dir = atlas.directionRows?.[host.facing] ?? ({ down: 0, up: 1, left: 2, right: 3 })[host.facing] ?? 0;
      const px = ox + host.position.x * tile * scale, tileY = oy + host.position.y * tile * scale;
      const py = Math.max(tileY, oy + 8 * scale);
      drawGroundShadow(ctx, { x: px + 2 * scale, baseY: py + 15 * scale, width: 12, scale, strength: 1.05, elevation: 9 });
      const lift = actorStepLift({ time, lastMoveAt, active, reducedMotion });
      if (sprite.complete && sprite.naturalWidth) drawElevatedSprite(ctx, sprite,
        frame * frameWidth, dir * frameHeight, frameWidth, frameHeight,
        px, py - 8 * scale, frameWidth * scale, frameHeight * scale, scale, lift);
      if (active) { ctx.strokeStyle = '#f2d38b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(px + 8 * scale, py + 15 * scale, 8 * scale, 3 * scale, 0, 0, Math.PI * 2); ctx.stroke(); }
    }
    for (const object of visibleObjects) {
      if (!isActionableInteraction(object, state, map, assets.quests)) continue;
      const x = ox + object.x * scale, y = oy + object.y * scale;
      const pulse = reducedMotion ? .72 : .62 + (Math.sin(time / 520) + 1) * .12;
      ctx.save(); ctx.globalAlpha = pulse; ctx.strokeStyle = '#f0d79e'; ctx.lineWidth = Math.max(1.5, 1.5 * scale);
      ctx.strokeRect(x + scale, y + scale, 14 * scale, 14 * scale);
      ctx.fillStyle = '#f0d79e'; ctx.beginPath(); ctx.arc(x + 14 * scale, y + 2 * scale, Math.max(1.5, scale * 1.7), 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const ambient = ambientBubbleFor(state, hostCards, map, time, Boolean(objective?.dialogueActive), assets.ambientConversations ?? []);
    if (ambient) {
          const speakers = ambient.exchange ?? [{ hostId: ambient.hostId, lineKo: ambient.line, mood: 'calm' }];
          speakers.forEach(speaker => {
            const host = state.hosts[speaker.hostId];
            if (!host || host.mapId !== map.mapId) return;
            const x = ox + host.position.x * tile * scale, y = oy + host.position.y * tile * scale;
            const fontSize = Math.max(9, Math.min(11, 10 * scale));
            const chunks = speaker.lineKo.match(/.{1,13}/gu) ?? [speaker.lineKo], rows = chunks.slice(0, 2);
            ctx.save(); ctx.font = `${fontSize}px 'Noto Serif KR', serif`;
            const width = Math.min(138 * scale, Math.max(...rows.map(row => ctx.measureText(row).width)) + 14 * scale);
            const height = (rows.length * (fontSize + 2)) + 9 * scale;
            const bx = Math.max(ox, Math.min(x + 8 * scale - width / 2, ox + map.width * tile * scale - width));
            const by = Math.max(oy, y - height - 12 * scale);
            const border = ({ helpful: '#9da879', kind: '#c99b72', warm: '#c99b72', pleased: '#dbbd76', amused: '#b49ac5', tired: '#9b9a91', guarded: '#b07961' })[speaker.mood] ?? '#c49c62';
            ctx.fillStyle = 'rgba(29,22,17,.96)'; ctx.strokeStyle = border; ctx.lineWidth = Math.max(1, scale * .8);
            ctx.beginPath(); ctx.roundRect(bx, by, width, height, 4 * scale); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x + 7 * scale, by + height); ctx.lineTo(x + 12 * scale, by + height); ctx.lineTo(x + 8 * scale, by + height + 5 * scale); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#f0dfbd'; rows.forEach((row, index) => ctx.fillText(row, bx + 7 * scale, by + (index + 1) * (fontSize + 2)));
            ctx.restore();
          });
    }
    const px = ox + actor.position.x * tile * scale, py = oy + actor.position.y * tile * scale;
    if (!state.player.embodiment) { ctx.fillStyle = '#efe0b5'; ctx.fillRect(px + 7 * scale, py + 5 * scale, 3 * scale, 8 * scale); ctx.fillRect(px + 5 * scale, py + 3 * scale, 7 * scale, 3 * scale); }
    // Warm paper lanterns mark the active space without covering tile detail.
    const glow = ctx.createRadialGradient(px + 8 * scale, py + 8 * scale, 2, px + 8 * scale, py + 8 * scale, 46 * scale);
    const pulse = reducedMotion ? 0.5 : (Math.sin(time / 850) + 1) / 2;
    glow.addColorStop(0, `rgba(212,163,93,${0.055 + pulse * 0.025})`); glow.addColorStop(1, '#d4a35d00'); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = glow; ctx.fillRect(ox, oy, map.width * tile * scale, map.height * tile * scale); ctx.globalCompositeOperation = 'source-over';
    const atmosphere = atmosphereForMap(map.mapId, map.width * tile * scale, map.height * tile * scale, time, reducedMotion, weather);
    if (atmosphere) {
      ctx.save();
      ctx.beginPath(); ctx.rect(ox, oy, map.width * tile * scale, map.height * tile * scale); ctx.clip();
      if (atmosphere.kind === 'drizzle') {
        const hazeY = oy + map.height * tile * scale * (0.44 + (reducedMotion ? 0 : Math.sin(time / 2400) * 0.018));
        const haze = ctx.createLinearGradient(0, hazeY, 0, hazeY + map.height * tile * scale * 0.16);
        haze.addColorStop(0, 'rgba(182,198,202,0)'); haze.addColorStop(0.5, 'rgba(182,198,202,0.055)'); haze.addColorStop(1, 'rgba(182,198,202,0)');
        ctx.fillStyle = haze; ctx.fillRect(ox, hazeY, map.width * tile * scale, map.height * tile * scale * 0.16);
        ctx.lineWidth = 1;
        for (const [index, drop] of atmosphere.particles.entries()) {
          if (index % 3 === 0) {
            const spriteFrame = reducedMotion ? 0 : (Math.floor(time / 110) + index) % rainSprites.length;
            const rainSprite = rainSprites[spriteFrame];
            if (rainSprite?.complete && rainSprite.naturalWidth) {
              ctx.globalAlpha = drop.alpha;
              ctx.drawImage(rainSprite, ox + drop.x - 3, oy + drop.y - 2, 9, 11);
              ctx.globalAlpha = 1;
              continue;
            }
          }
          ctx.strokeStyle = `rgba(190,204,204,${drop.alpha})`;
          ctx.beginPath(); ctx.moveTo(ox + drop.x, oy + drop.y); ctx.lineTo(ox + drop.x - 1.5, oy + drop.y + drop.length); ctx.stroke();
        }
        for (const glint of atmosphere.pavingGlints ?? []) {
          ctx.strokeStyle = `rgba(222,214,188,${glint.alpha})`;
          ctx.beginPath();
          ctx.moveTo(ox + glint.x, oy + glint.y);
          ctx.lineTo(ox + glint.x + glint.width, oy + glint.y + 0.5);
          ctx.stroke();
        }
      } else if (atmosphere.kind === 'fog' || atmosphere.kind === 'overcast') {
        const haze = ctx.createLinearGradient(0, oy, 0, oy + map.height * tile * scale);
        haze.addColorStop(0, atmosphere.kind === 'fog' ? 'rgba(198,207,207,0.035)' : 'rgba(93,108,119,0.055)');
        haze.addColorStop(0.58, atmosphere.kind === 'fog' ? 'rgba(198,207,207,0.25)' : 'rgba(93,108,119,0.025)');
        haze.addColorStop(1, 'rgba(198,207,207,0.01)');
        ctx.fillStyle = haze; ctx.fillRect(ox, oy, map.width * tile * scale, map.height * tile * scale);
        for (const bank of atmosphere.fogBanks ?? []) {
          const left = ox + bank.x, top = oy + bank.y, width = bank.width, height = bank.height;
          const mist = ctx.createLinearGradient(0, top, 0, top + height);
          mist.addColorStop(0, 'rgba(211,218,213,0)');
          mist.addColorStop(0.48, `rgba(211,218,213,${bank.alpha})`);
          mist.addColorStop(1, 'rgba(211,218,213,0)');
          ctx.fillStyle = mist;
          ctx.fillRect(left, top, width, height);
        }
      } else if (atmosphere.kind === 'wind') {
        ctx.lineWidth = 1;
        for (const gust of atmosphere.particles) {
          ctx.strokeStyle = `rgba(205,210,202,${gust.alpha})`;
          ctx.beginPath(); ctx.moveTo(ox + gust.x, oy + gust.y); ctx.lineTo(ox + gust.x + gust.length, oy + gust.y - 1); ctx.stroke();
        }
      } else if (atmosphere.kind === 'snow') {
        ctx.fillStyle = 'rgba(177,196,209,0.045)';
        ctx.fillRect(ox, oy, map.width * tile * scale, map.height * tile * scale);
        for (const band of atmosphere.snowBands ?? []) {
          ctx.fillStyle = `rgba(231,235,229,${band.alpha ?? 0.32})`;
          ctx.fillRect(ox + band.x, oy + band.y, band.width, band.height);
        }
        for (const flake of atmosphere.particles) {
          ctx.fillStyle = `rgba(237,239,230,${flake.alpha})`;
          ctx.fillRect(ox + flake.x, oy + flake.y, flake.size, flake.size);
        }
      } else {
        for (const mote of atmosphere.particles) {
          ctx.fillStyle = `rgba(239,207,145,${mote.alpha})`;
          ctx.fillRect(ox + mote.x, oy + mote.y, mote.size, mote.size);
        }
      }
      ctx.restore();
    }
    if (objective?.pinned && objective.target?.mapId === map.mapId) {
      const target = objective.target, x = ox + (target.x + 0.5) * tile * scale;
      const y = oy + target.y * tile * scale - 9 * scale;
      if (x >= 2 && x <= w - 2 && y >= 2 && y <= h - 2) {
        const size = Math.max(5, 4 * scale), pulse = reducedMotion ? 0 : Math.sin(time / 360) * Math.min(2, scale);
        ctx.save(); ctx.translate(x, y - pulse); ctx.rotate(Math.PI / 4);
        ctx.fillStyle = '#ffe4a6'; ctx.strokeStyle = '#39251a'; ctx.lineWidth = Math.max(1, scale * .7);
        ctx.fillRect(-size / 2, -size / 2, size, size); ctx.strokeRect(-size / 2, -size / 2, size, size); ctx.restore();
      }
    }
  }
  return {
    draw,
    needsAmbientFrames: map => !reducedMotion && (mapHasAtmosphere(map.mapId)
      || map.layers.some(layer => layer.objects?.some(object => object.properties?.some(property =>
        property.name === 'ambientEffect' && property.value === 'samovar-steam')))),
  };
}
