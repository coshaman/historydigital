import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const outputDir = 'docs/v25/tests/runtime_traces';
await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: false });
const samples = [];

async function enterPilotRead(page) {
  await page.goto('http://127.0.0.1:4173/');
  await page.evaluate(() => localStorage.removeItem('chancery-gold-runtime-v1'));
  await page.reload();
  await page.waitForFunction(() => window.__goldRuntime?.getPilotManifest && window.__threeRuntime?.loaded);
  await page.locator('#ledgerObject').click();
  await page.locator('[data-ledger-scene="C06"]').click();
  for (let index = 0; index < 5; index += 1) await page.locator('.v25-pilot-excerpt-head').nth(index).click();
  await page.locator('.pilot-continue').click();
  await page.waitForFunction(() => window.__goldRuntime.getState().phase === 'choices');
}

async function enterPilotJudgment(page) {
  await enterPilotRead(page);
  await page.locator('#choiceArea button').first().click();
  await page.waitForFunction(() => window.__goldRuntime.getState().phase === 'judgment');
}

async function measure(mode, repeat, page, assertion) {
  await page.waitForTimeout(3000);
  const result = await page.evaluate(async ({ mode, repeat, assertion }) => {
    const frames = [];
    let last = performance.now();
    const started = last;
    while (performance.now() - started < 10000) {
      await new Promise(requestAnimationFrame);
      const now = performance.now();
      frames.push(now - last);
      last = now;
    }
    const sorted = [...frames].sort((a, b) => a - b);
    const runtime = window.__threeRuntime;
    const metrics = runtime?.getMetrics?.() || {};
    const renderer = runtime?.renderer;
    const gl = renderer?.getContext?.();
    const gpu = gl ? gl.getParameter(gl.RENDERER) : null;
    return {
      mode, repeat, assertion,
      durationSeconds: 10,
      phase: window.__goldRuntime.getState().phase,
      caseId: window.__goldRuntime.getState().caseId,
      visible: document.visibilityState === 'visible',
      focused: document.hasFocus(),
      threeLoaded: Boolean(runtime?.loaded),
      threeLocal: Boolean(runtime?.local),
      threeFallback: Boolean(runtime?.fallback),
      renderer: { ...metrics, gpu, softwareRenderer: /SwiftShader|Software/i.test(gpu || '') },
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      frameCount: frames.length,
      medianFrameMs: sorted[Math.floor(sorted.length * 0.5)] || 0,
      p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] || 0,
      fps: frames.length / 10,
      framesOver33ms: frames.filter((frame) => frame > 33).length,
      framesOver50ms: frames.filter((frame) => frame > 50).length,
    };
  }, { mode, repeat, assertion });
  await page.screenshot({ path: `${outputDir}/${mode}-${repeat}.png` });
  return result;
}

for (const mode of ['idle', 'read', 'judgment', 'window']) {
  for (let repeat = 1; repeat <= 3; repeat += 1) {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    let assertion;
    if (mode === 'idle') {
      await page.goto('http://127.0.0.1:4173/');
      await page.evaluate(() => localStorage.removeItem('chancery-gold-runtime-v1'));
      await page.reload();
      await page.waitForFunction(() => window.__threeRuntime?.loaded && window.__goldRuntime?.getState);
      assertion = await page.evaluate(() => ({ phase: window.__goldRuntime.getState().phase, cameraFocus: window.__threeRuntime.cameraFocus() }));
    } else if (mode === 'read') {
      await enterPilotRead(page);
      assertion = await page.evaluate(() => ({ phase: window.__goldRuntime.getState().phase, readCount: window.__goldRuntime.getState().pilot.readExcerptIds.length }));
    } else if (mode === 'judgment') {
      await enterPilotJudgment(page);
      assertion = await page.evaluate(() => ({ phase: window.__goldRuntime.getState().phase, readCount: window.__goldRuntime.getState().pilot.readExcerptIds.length }));
    } else {
      await page.goto('http://127.0.0.1:4173/');
      await page.evaluate(() => localStorage.removeItem('chancery-gold-runtime-v1'));
      await page.reload();
      await page.waitForFunction(() => window.__threeRuntime?.loaded && window.__goldRuntime?.getState);
      await page.locator('#petersburgWindow').click();
      await page.waitForFunction(() => document.body.classList.contains('window-focused'));
      assertion = await page.evaluate(() => ({ phase: window.__goldRuntime.getState().phase, cameraFocus: window.__threeRuntime.cameraFocus(), windowFocused: document.body.classList.contains('window-focused') }));
    }
    samples.push(await measure(mode, repeat, page, assertion));
    await page.close();
  }
}

const notebookPage = await browser.newPage({ viewport: { width: 1366, height: 768 } });
await notebookPage.goto('http://127.0.0.1:4173/');
await notebookPage.evaluate(() => localStorage.removeItem('chancery-gold-runtime-v1'));
await notebookPage.reload();
await notebookPage.waitForFunction(() => window.__threeRuntime?.loaded && window.__goldRuntime?.getState);
await notebookPage.locator('#notebookObject').click();
await notebookPage.waitForFunction(() => document.body.classList.contains('notebook-focus'));
const notebookAssertion = await notebookPage.evaluate(() => ({ notebookFocused: document.body.classList.contains('notebook-focus'), phase: window.__goldRuntime.getState().phase }));
samples.push(await measure('notebook', 1, notebookPage, notebookAssertion));
await notebookPage.close();

const invalid = samples.filter((sample) => !sample.visible || !sample.focused || !sample.threeLoaded || !sample.threeLocal || sample.threeFallback || sample.renderer.softwareRenderer || !sample.assertion);
const targetsMet = samples.filter((sample) => sample.fps >= 50 && sample.p95FrameMs <= 33).length === samples.length;
const result = { version: 'v25', headed: true, durationSecondsPerSample: 10, sampleCount: samples.length, invalidCount: invalid.length, targetsMet, status: invalid.length === 0 && targetsMet ? 'PASS' : invalid.length ? 'INVALID' : 'FAIL', samples };
await writeFile('docs/v25/tests/REAL_STATE_PERFORMANCE.json', JSON.stringify(result, null, 2));
await writeFile('docs/v25/tests/PERFORMANCE_TRACE_SUMMARY.md', `# V25 headed runtime performance\n\n- samples: ${samples.length}\n- invalid samples: ${invalid.length}\n- target status: ${result.status}\n- modes: idle/read/judgment/window × 3, notebook × 1\n- every sample entered through real browser UI actions; no runtime state injection was used.\n`);
console.log(JSON.stringify({ status: result.status, sampleCount: result.sampleCount, invalidCount: result.invalidCount, targetsMet: result.targetsMet }, null, 2));
await browser.close();
if (result.status !== 'PASS') process.exitCode = 1;
