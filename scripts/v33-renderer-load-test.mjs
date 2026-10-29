import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCamera, createRenderer } from '../rpg/engine/renderer.js';

class FakeContext {
  drawCount = 0;
  imageSmoothingEnabled = true;
  globalCompositeOperation = 'source-over';
  setTransform() {}
  fillRect() {}
  drawImage() { this.drawCount++; }
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
