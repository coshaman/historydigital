import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const port = 4175;
const base = `http://127.0.0.1:${port}/?main20=1&v42fresh=1`;
const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, CHANCERY_PORT: String(port) }, stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(base)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.__main20?.getState));
    const state = await page.evaluate(() => window.__main20.getState());
    assert.equal(state.phase, 'onboarding');
    const surfaces = await page.evaluate(() => {
      const paper = document.querySelector('#paper');
      const action = document.querySelector('#choiceArea button');
      const desk = document.querySelector('#deskCanvas');
      const win = document.querySelector('#petersburgWindow');
      const rect = node => { const r = node?.getBoundingClientRect(); return r && { top: r.top, right: r.right, bottom: r.bottom, left: r.left, width: r.width, height: r.height }; };
      return {
        viewport: { width: innerWidth, height: innerHeight }, pageWidth: document.documentElement.scrollWidth,
        token: getComputedStyle(document.documentElement).getPropertyValue('--paper-stock').trim(),
        paperClasses: paper?.className, actionClasses: action?.className,
        actionVisible: Boolean(action && action.getBoundingClientRect().height && !action.disabled),
        desk: rect(desk), window: rect(win)
      };
    });
    assert.ok(surfaces.token, `shared paper design token missing at ${viewport.width}px`);
    assert.match(surfaces.paperClasses, /document-surface/);
    assert.match(surfaces.actionClasses, /document-action/);
    assert.equal(surfaces.actionVisible, true);
    assert.ok(surfaces.pageWidth <= viewport.width, `horizontal overflow: ${JSON.stringify(surfaces)}`);
    assert.ok(surfaces.desk?.width > 0 && surfaces.desk?.height > 0, `desk missing: ${JSON.stringify(surfaces)}`);
    assert.ok(surfaces.window?.width > 0 && surfaces.window.top < viewport.height / 2, `wall window not visible/high: ${JSON.stringify(surfaces)}`);
    const firstAction = page.locator('#choiceArea button:visible').first();
    await firstAction.focus();
    assert.ok(await page.evaluate(() => document.activeElement?.matches('#choiceArea button')));
    await page.keyboard.press('Enter');
    assert.notEqual((await page.evaluate(() => window.__main20.getState())).onboardingIndex, state.onboardingIndex);
    const beforeResize = await page.evaluate(() => ({ url: location.href, state: window.__main20.getState() }));
    const resizedViewport = viewport.width === 1440 ? { width: 720, height: 450 } : viewport.width === 1024 ? { width: 390, height: 844 } : { width: 844, height: 390 };
    await page.setViewportSize(resizedViewport);
    const afterResize = await page.evaluate(() => {
      const button = document.querySelector('#choiceArea button');
      const rect = button?.getBoundingClientRect();
      return { url: location.href, pageWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth, phase: window.__main20.getState().phase, onboardingIndex: window.__main20.getState().onboardingIndex, button: rect && { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, buttonVisible: Boolean(rect?.height && getComputedStyle(button).display !== 'none') };
    });
    assert.equal(afterResize.url, beforeResize.url, 'resize must not reload/navigate the route');
    assert.equal(afterResize.phase, beforeResize.state.phase);
    assert.equal(afterResize.onboardingIndex, beforeResize.state.onboardingIndex);
    assert.ok(afterResize.pageWidth <= afterResize.viewportWidth, `resize overflow: ${JSON.stringify(afterResize)}`);
    assert.ok(afterResize.buttonVisible && afterResize.button.left >= 0 && afterResize.button.right <= afterResize.viewportWidth, `choice no longer fits/can be reached after resize: ${JSON.stringify(afterResize)}`);
    await page.close();
  }
  const reducedPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await reducedPage.emulateMedia({ reducedMotion: 'reduce' });
  await reducedPage.goto(base, { waitUntil: 'domcontentloaded' });
  await reducedPage.waitForFunction(() => Boolean(window.__main20?.getState));
  const reducedMotion = await reducedPage.locator('#choiceArea button').first().evaluate(button => ({ requested: matchMedia('(prefers-reduced-motion: reduce)').matches, transition: getComputedStyle(button).transitionProperty, animation: getComputedStyle(button).animationName }));
  assert.equal(reducedMotion.requested, true);
  assert.equal(reducedMotion.transition, 'none');
  assert.equal(reducedMotion.animation, 'none');
  await reducedPage.close();
  console.log('main20-unified-ui: 1440x900, 1024x768, 390x844, 200%-effective 720x450 resize, keyboard, reduced motion — PASS');
} finally {
  await browser?.close();
  server.kill();
}
