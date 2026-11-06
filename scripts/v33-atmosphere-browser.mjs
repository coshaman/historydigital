import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

let server = null;
let origin = process.env.V33_RPG_URL;
if (!origin) {
  const probe = createServer();
  await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = probe.address().port;
  await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
  origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env, CHANCERY_PORT: String(port) }, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
}
let startupError = '';
let spawnError = '';
if (server) {
  server.stderr.setEncoding('utf8');
  server.stderr.on('data', chunk => { startupError = `${startupError}${chunk}`.slice(-2000); });
  server.on('error', error => { spawnError = error.message; });
}
const browser = await chromium.launch({ headless: true });

async function canvasFrame(page) {
  await page.waitForTimeout(500);
  const first = await page.locator('#world').evaluate(canvas => canvas.toDataURL());
  await page.waitForTimeout(500);
  const second = await page.locator('#world').evaluate(canvas => canvas.toDataURL());
  return first !== second;
}

async function testMotionPreferences() {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'no-preference' });
  const page = await context.newPage();
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => { const canvas = document.querySelector('#world'); return canvas?.width > 0 && canvas?.height > 0; });
  const moving = await canvasFrame(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const still = await canvasFrame(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const resumes = await canvasFrame(page);
  await context.close();
  return { moving, still, resumes };
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch {}
    await delay(200);
  }
  assert.ok(ready, `local game server starts for atmosphere visual test${spawnError ? ` · ${spawnError}` : ''}${startupError ? ` · ${startupError}` : ''}${server && server.exitCode !== null ? ` · exit ${server.exitCode}` : ''}`);
  const motion = await testMotionPreferences();
  assert.equal(motion.moving, true, 'ambient drizzle changes the exterior canvas over time');
  assert.equal(motion.still, false, 'reduced-motion canvas stays visually still');
  assert.equal(motion.resumes, true, 'ambient motion resumes when reduced-motion is disabled');
  process.stdout.write(JSON.stringify({ status: 'PASS', ...motion }) + '\n');
} finally {
  await browser.close();
  server?.kill();
}
