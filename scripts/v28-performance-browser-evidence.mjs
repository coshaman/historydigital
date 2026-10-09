import fs from 'node:fs';
import { chromium } from 'playwright';

const headed = process.argv.includes('--headed');
const browser = await chromium.launch({ headless: !headed });
const samples = [];
for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
  for (let run = 1; run <= 3; run += 1) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (error) => pageErrors.push(String(error)));
    await page.goto('http://127.0.0.1:4173/#v28-reset', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('chancery-gold-runtime-v1'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph), null, { timeout: 30000 });
    const metrics = await page.evaluate(async () => {
      const frames = [];
      let previous = performance.now();
      const start = previous;
      while (performance.now() - start < 1000) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const now = performance.now();
        frames.push(now - previous);
        previous = now;
      }
      const sorted = [...frames].sort((a, b) => a - b);
      const canvas = document.querySelector('canvas');
      let renderer = null;
      try {
        const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
        renderer = gl?.getParameter(gl.RENDERER) || null;
      } catch {}
      return { frameCount: frames.length, medianFrameMs: sorted[Math.floor(sorted.length * 0.5)] || 0, p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] || 0, renderer, softwareRenderer: /SwiftShader|Software/i.test(renderer || '') };
    });
    const click = async (selectorOrText) => {
      const started = await page.evaluate((target) => {
        const element = target.startsWith('#') || target.startsWith('.')
          ? document.querySelector(target)
          : [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === target);
        if (!element) throw new Error(`missing interaction: ${target}`);
        const now = performance.now();
        element.click();
        return now;
      }, selectorOrText);
      await page.waitForTimeout(40);
      return (await page.evaluate(() => performance.now())) - started;
    };
    const latencies = {
      choiceToReactionMs: await click('.v28-runtime #choiceArea button'),
      reactionToInspectionMs: await click('봉투를 펼쳐 본다'),
      excerptReadingMs: 0,
      inspectionToAftermathMs: 0,
      aftermathToNextCaseMs: 0,
    };
    const readStarted = await page.evaluate(() => performance.now());
    while (await page.evaluate(() => [...document.querySelectorAll('.v28-excerpt-open')].some((button) => button.textContent?.includes('이 발췌를 읽음')))) {
      await page.evaluate(() => [...document.querySelectorAll('.v28-excerpt-open')].find((button) => button.textContent?.includes('이 발췌를 읽음'))?.click());
      await page.waitForTimeout(0);
    }
    await page.locator('#choiceArea button').filter({ hasText: '읽은 내용을 들려준다' }).click();
    latencies.excerptReadingMs = (await page.evaluate(() => performance.now())) - readStarted;
    latencies.inspectionToAftermathMs = await click('오늘의 기록을 접는다');
    latencies.aftermathToNextCaseMs = await click('다음 봉투를 받는다');
    samples.push({ viewport, run, metrics, latencies, pageErrors });
    await context.close();
  }
}
const maxP95FrameMs = Math.max(...samples.map((sample) => sample.metrics.p95FrameMs));
const maxInteractionMs = Math.max(...samples.flatMap((sample) => Object.values(sample.latencies)));
const report = { schemaVersion: headed ? 'V28-PERFORMANCE-HEADED-1' : 'V28-PERFORMANCE-ACTUAL-1', status: samples.some((sample) => sample.pageErrors.length) ? 'FAIL' : (maxP95FrameMs > 100 || maxInteractionMs > 2000 ? 'PASS_WITH_PERFORMANCE_WARNING' : 'PASS'), environment: headed ? 'Playwright Chromium headed foreground on current host; renderer inspected separately; not a universal hardware claim' : 'Playwright Chromium headless on current host; not a hardware-GPU claim', maxP95FrameMs, maxInteractionMs, warning: maxP95FrameMs > 100 || maxInteractionMs > 2000 ? 'Current host has long frame samples or interaction latency; investigate on target hardware before a release performance claim.' : null, samples };
fs.writeFileSync(headed ? 'docs/v28/PERFORMANCE_HEADED_INTERACTIONS.json' : 'docs/v28/PERFORMANCE_ACTUAL_INTERACTIONS.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ status: report.status, samples: samples.length, maxP95FrameMs, maxInteractionMs, pageErrors: samples.flatMap((sample) => sample.pageErrors) }, null, 2));
await browser.close();
if (report.status === 'FAIL') process.exit(1);
