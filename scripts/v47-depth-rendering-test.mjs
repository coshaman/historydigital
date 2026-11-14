import assert from 'node:assert/strict';
import { drawGroundShadow, sortSceneByGroundDepth } from '../rpg/engine/depth-rendering.mjs';

const calls = [];
const ctx = {
  save() { calls.push(['save']); }, restore() { calls.push(['restore']); },
  beginPath() { calls.push(['beginPath']); }, fill() { calls.push(['fill']); },
  ellipse(...args) { calls.push(['ellipse', ...args]); },
  set globalAlpha(value) { calls.push(['alpha', value]); },
  set fillStyle(value) { calls.push(['fillStyle', value]); },
};

drawGroundShadow(ctx, { x: 20, baseY: 50, width: 16, scale: 2 });
assert.equal(calls.filter(call => call[0] === 'ellipse').length, 2, 'draws a soft cast lobe and a tight contact shadow');
assert.equal(calls.at(-1)[0], 'restore', 'restores canvas state after each shadow');
assert.ok(calls.some(call => call[0] === 'alpha' && call[1] < 0.15), 'cast shadow remains translucent');

const sorted = sortSceneByGroundDepth([
  { id: 'front-actor', kind: 'actor', groundY: 40, depthOrder: 1, stableOrder: 0 },
  { id: 'back-prop', kind: 'object', groundY: 24, depthOrder: 0, stableOrder: 1 },
  { id: 'same-depth-prop', kind: 'object', groundY: 40, depthOrder: 0, stableOrder: 2 },
]);
assert.deepEqual(sorted.map(entry => entry.id), ['back-prop', 'same-depth-prop', 'front-actor'],
  'props and characters layer by foot/base depth, with props behind actors at a shared baseline');
console.log('V47 depth rendering: soft cast/contact shadows and ground-depth ordering pass.');
