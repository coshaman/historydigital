import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const staticRoot = path.join(root, 'dist-v33');
const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, CHANCERY_PORT: String(port), CHANCERY_STATIC_ROOT: staticRoot, CHANCERY_STATIC_ONLY: '1' },
  stdio: 'ignore',
  windowsHide: true,
});
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'the Vercel static output server starts');

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const pageErrors = [];
  const localFailures = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  page.on('response', response => {
    if (response.url().startsWith(base) && response.status() >= 400) localFailures.push({ url: response.url(), status: response.status() });
  });

  await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
  await page.locator('#mission-title').waitFor({ state: 'visible', timeout: 15000 });
  assert.ok(await page.locator('#world').isVisible(), 'the V36 playable RPG entry renders from dist-v33');

  await page.goto(`${base}/chancery.html#legacy`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__threeRuntime?.loaded === true, null, { timeout: 15000 });
  await page.waitForFunction(() => window.__goldRuntime, null, { timeout: 15000 });
  const beforeFocus = await page.evaluate(() => ({
    threeLoaded: document.querySelector('#deskCanvas')?.dataset.threeLoaded,
    fallback: document.querySelector('#deskCanvas')?.dataset.fallback,
    metrics: window.__deskMetrics(),
    portraitHidden: document.querySelector('#v28Portrait')?.hidden,
    missingVisibleImage: [...document.images].some(image => {
      const rect = image.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && !image.complete;
    }),
  }));
  assert.equal(beforeFocus.threeLoaded, 'local', 'the 3D desk loads the vendored same-origin Three.js files');
  assert.equal(beforeFocus.fallback, 'false');
  assert.equal(beforeFocus.metrics.renderedFrames, 1, 'the desk renders its initial frame once');
  assert.equal(beforeFocus.portraitHidden, true, 'narration does not display an empty portrait box');
  assert.equal(beforeFocus.missingVisibleImage, false, 'all visible images in the preserved desk route are loaded');
  await page.screenshot({ path: path.join(root, 'docs/v36/current-audit/v33-static-desk-1440.png') });

  await page.evaluate(() => window.__windowController.openWindow());
  await page.waitForFunction(() => window.__threeRuntime.cameraFocus() === 'window', null, { timeout: 3000 });
  const afterFocus = await page.evaluate(() => ({ focus: window.__threeRuntime.cameraFocus(), frames: window.__deskMetrics().renderedFrames }));
  const cameraFocusRedraws = afterFocus.frames - beforeFocus.metrics.renderedFrames;
  assert.equal(afterFocus.focus, 'window');
  assert.ok(cameraFocusRedraws > 0, 'window focus redraws the destination view');
  if (beforeFocus.metrics.softwareRenderer) assert.ok(cameraFocusRedraws <= 1, `software renderer redraws once per focus change, got ${cameraFocusRedraws}`);
  assert.deepEqual(pageErrors, [], `no browser exceptions: ${pageErrors.join('\n')}`);
  assert.deepEqual(localFailures, [], `no missing dist-v33 resources: ${JSON.stringify(localFailures)}`);

  await page.evaluate(() => window.__windowController.closeWindow());
  const mobileLayouts = [];
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) {
    await page.setViewportSize(viewport);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__threeRuntime?.loaded === true, null, { timeout: 15000 });
    const layout = await page.evaluate(() => {
      const canvas = document.querySelector('#deskCanvas').getBoundingClientRect();
      return { width: innerWidth, height: innerHeight, documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth, canvasRight: canvas.right, canvasWidth: canvas.width };
    });
    assert.ok(layout.documentWidth <= viewport.width && layout.bodyWidth <= viewport.width && layout.canvasRight <= viewport.width + 1,
      `preserved 3D desk route fits ${viewport.width}px: ${JSON.stringify(layout)}`);
    mobileLayouts.push({ viewport, layout });
  }

  const report = {
    status: 'PASS',
    artifact: 'dist-v33/',
    viewport: { width: 1440, height: 900 },
    v36EntryPlayable: true,
    preservedDeskEntry: { threeLoaded: true, fallback: false, visibleImagesLoaded: true, narrationPortraitHidden: true },
    cameraFocus: { ...afterFocus, redraws: cameraFocusRedraws },
    mobileLayouts,
    pageErrors,
    localResourceFailures: localFailures,
    screenshot: 'docs/v36/current-audit/v33-static-desk-1440.png',
  };
  await mkdir(path.join(root, 'docs/v36/current-audit'), { recursive: true });
  await writeFile(path.join(root, 'docs/v36/current-audit/V33_STATIC_BUILD_BROWSER.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  await page.close();
} finally {
  await browser.close();
  server.kill();
}
