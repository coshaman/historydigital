import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCamera, createRenderer } from '../rpg/engine/renderer.js';

class FakeContext {
  drawCount = 0;
  drawCalls = [];
  imageSmoothingEnabled = true;
  globalCompositeOperation = 'source-over';
  setTransform() {}
  fillRect() {}
  drawImage(...args) { this.drawCount++; this.drawCalls.push(args); }
  createRadialGradient() { return { addColorStop() {} }; }
}

class FakeCanvas {
  width = 300;
  height = 150;
  clientWidth = 320;
  clientHeight = 200;
  context = new FakeContext();
  getContext() { return this.context; }
  getBoundingClientRect() { return { width: this.clientWidth, height: this.clientHeight }; }
}

test('camera enlarges the world, follows its actor, and clamps cleanly at map edges', () => {
  const desktop = calculateCamera({ viewportWidth: 1384, viewportHeight: 357, mapWidth: 30, mapHeight: 20, tileSize: 16, position: { x: 15, y: 10 } });
  const mobile = calculateCamera({ viewportWidth: 370, viewportHeight: 379, mapWidth: 30, mapHeight: 20, tileSize: 16, position: { x: 15, y: 10 } });
  assert.ok(desktop.scale > 1.8, 'desktop pixel tiles must be visibly larger than whole-map fit');
  assert.ok(desktop.mapWidthPixels > desktop.viewportWidth * 0.75, 'desktop map should use most of the playfield width');
  assert.ok(desktop.visibleTilesY < 12, 'camera should show a readable nearby section instead of shrinking the full map');
  assert.ok(Math.abs(desktop.actorScreenX - desktop.viewportWidth / 2) < desktop.scale * 16, 'interior actor remains within one tile of horizontal center');
  assert.ok(Math.abs(desktop.actorScreenY - desktop.viewportHeight / 2) < desktop.scale * 16, 'interior actor remains within one tile of vertical center');
  assert.ok(mobile.visibleTilesX < 20 && mobile.visibleTilesY < 20, 'mobile uses a scrollable camera window');

  const edge = calculateCamera({ viewportWidth: 1384, viewportHeight: 357, mapWidth: 30, mapHeight: 20, tileSize: 16, position: { x: 0, y: 0 } });
  assert.ok(edge.actorScreenX >= 0 && edge.actorScreenY >= 0, 'player stays visible at the northwest map edge');
  assert.ok(edge.actorScreenX < desktop.viewportWidth / 2 && edge.actorScreenY < desktop.viewportHeight / 2, 'camera clamps instead of revealing empty space beyond map edges');
});

test('canvas redraws after the asynchronous Petersburg tilesheet finishes loading', () => {
  const images = [];
  globalThis.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: true }) };
  globalThis.Image = class {
    complete = false;
    naturalWidth = 0;
    naturalHeight = 0;
    set src(value) { this.url = value; images.push(this); }
    finishLoading() { this.complete = true; this.naturalWidth = 256; this.naturalHeight = 256; this.onload?.(); }
  };
  globalThis.document = { createElement: () => new FakeCanvas() };
  globalThis.requestAnimationFrame = callback => { callback(0); return 1; };
  try {
    const canvas = new FakeCanvas();
    const renderer = createRenderer(canvas, { hostCards: [] });
    const map = { mapId: 'test', width: 1, height: 1, layers: [{ type: 'tilelayer', name: 'Ground', data: [1] }] };
    const state = { player: { position: { x: 0, y: 0 }, embodiment: null }, hosts: {}, quests: {} };
    renderer.draw(state, map, 1000, 0);
    assert.equal(canvas.context.drawCount, 0, 'the first frame waits for the tilesheet');
    images[0].finishLoading();
    assert.ok(canvas.context.drawCount > 0, 'tile image load must trigger a frame with map pixels');
    assert.equal(canvas.width, canvas.clientWidth, 'backing canvas is sized to its visible surface');
  } finally {
    delete globalThis.window;
    delete globalThis.Image;
    delete globalThis.document;
    delete globalThis.requestAnimationFrame;
  }
});

test('character rendering reads its image, frame dimensions, and direction rows from spriteAtlas', () => {
  const images = [];
  globalThis.window = { devicePixelRatio: 1, matchMedia: () => ({ matches: true }) };
  globalThis.Image = class {
    complete = true;
    naturalWidth = 256;
    naturalHeight = 256;
    set src(value) { this.url = String(value); images.push(this); }
  };
  globalThis.document = { createElement: () => new FakeCanvas() };
  globalThis.requestAnimationFrame = callback => { callback(0); return 1; };
  try {
    const canvas = new FakeCanvas();
    const card = { id: 'test-host', sprite: { file: 'legacy.png', frameWidth: 16, frameHeight: 24 }, spriteAtlas: { file: 'atlas.png', frameWidth: 8, frameHeight: 12, directions: 4, framesPerDirection: 2, directionRows: { down: 0, up: 1, left: 2, right: 3 } } };
    const renderer = createRenderer(canvas, { hostCards: [card] });
    const map = { mapId: 'test', width: 4, height: 4, layers: [] };
    const host = { id: card.id, mapId: 'test', position: { x: 2, y: 2 }, facing: 'right' };
    const state = { player: { position: { x: 2, y: 2 }, embodiment: null }, hosts: { [host.id]: host }, quests: {} };
    renderer.draw(state, map, 1000, 0);
    const atlasImage = images.find(image => image.url.endsWith('/atlas.png'));
    assert.ok(atlasImage, 'renderer loads the declared atlas asset');
    const spriteCall = canvas.context.drawCalls?.find(call => call[0] === atlasImage);
    assert.ok(spriteCall, 'renderer draws the declared atlas asset');
    assert.deepEqual(spriteCall.slice(1, 5), [0, 36, 8, 12], 'direction row and crop size use the atlas declaration');
  } finally {
    delete globalThis.window;
    delete globalThis.Image;
    delete globalThis.document;
    delete globalThis.requestAnimationFrame;
  }
});
