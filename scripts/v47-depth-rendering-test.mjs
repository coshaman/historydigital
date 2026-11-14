import assert from 'node:assert/strict';
import { drawGroundShadow, drawElevatedSprite, actorStepLift, sortSceneByGroundDepth } from '../rpg/engine/depth-rendering.mjs';

const calls = [];
const ctx = {
  save() { calls.push(['save']); }, restore() { calls.push(['restore']); },
  beginPath() { calls.push(['beginPath']); }, fill() { calls.push(['fill']); },
  ellipse(...args) { calls.push(['ellipse', ...args]); },
  drawImage(...args) { calls.push(['drawImage', ...args]); },
  set shadowColor(value) { calls.push(['shadowColor', value]); },
  set shadowBlur(value) { calls.push(['shadowBlur', value]); },
  set shadowOffsetX(value) { calls.push(['shadowOffsetX', value]); },
  set shadowOffsetY(value) { calls.push(['shadowOffsetY', value]); },
  set globalAlpha(value) { calls.push(['alpha', value]); },
  set fillStyle(value) { calls.push(['fillStyle', value]); },
};

drawGroundShadow(ctx, { x: 20, baseY: 50, width: 16, scale: 2 });
assert.equal(calls.filter(call => call[0] === 'ellipse').length, 2, 'draws a soft cast lobe and a tight contact shadow');
assert.equal(calls.at(-1)[0], 'restore', 'restores canvas state after each shadow');
assert.ok(calls.some(call => call[0] === 'alpha' && call[1] < 0.15), 'cast shadow remains translucent');

const image = {};
drawElevatedSprite(ctx, image, 0, 0, 16, 24, 20, 30, 32, 48, 2, 1.5);
assert.ok(calls.some(call => call[0] === 'shadowOffsetY' && call[1] > 6), 'raised pixel figure casts a displaced ground shadow');
assert.ok(calls.some(call => call[0] === 'shadowBlur' && call[1] > 0), 'cast shadow softens with height');
assert.deepEqual(calls.findLast(call => call[0] === 'drawImage').slice(1), [image, 0, 0, 16, 24, 20, 27, 32, 48],
  'sprite rises from the same foot point while its shadow remains on the ground');
assert.ok(Math.abs(actorStepLift({ time: 90, lastMoveAt: 90, active: true, reducedMotion: false }) - 1.0097651817694757) < 0.001,
  'walking animation gives the active character a restrained step lift');
assert.equal(actorStepLift({ time: 90, lastMoveAt: 90, active: false, reducedMotion: false }), 0,
  'uncontrolled characters keep their authored foot placement');
assert.equal(actorStepLift({ time: 90, lastMoveAt: 90, active: true, reducedMotion: true }), 0,
  'reduced motion disables the step lift');

const sorted = sortSceneByGroundDepth([
  { id: 'front-actor', kind: 'actor', groundY: 40, depthOrder: 1, stableOrder: 0 },
  { id: 'back-prop', kind: 'object', groundY: 24, depthOrder: 0, stableOrder: 1 },
  { id: 'same-depth-prop', kind: 'object', groundY: 40, depthOrder: 0, stableOrder: 2 },
]);
assert.deepEqual(sorted.map(entry => entry.id), ['back-prop', 'same-depth-prop', 'front-actor'],
  'props and characters layer by foot/base depth, with props behind actors at a shared baseline');
console.log('V47 depth rendering: soft cast/contact shadows and ground-depth ordering pass.');
