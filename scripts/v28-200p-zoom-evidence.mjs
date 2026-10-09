import fs from 'node:fs';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/#v28';
const out = 'artifacts/v28-browser/zoom-200p';
fs.mkdirSync(out, { recursive: true });

// Headed Chromium is intentional: this evidence covers the user-visible enlarged page,
// not a headless layout approximation. The body zoom keeps the physical viewport fixed
// while exposing the same reduced content area a 200% browser zoom creates.
const browser = await chromium.launch({ headless: false });
const report = { schemaVersion: 'V28-200P-ZOOM-EVIDENCE-1', mode: 'headed Chromium, 200% page zoom emulation', screenshots: [], states: [], pageErrors: [] };

async function capture(page, name) {
  const path = `${out}/${name}.png`;
  await page.screenshot({ path, fullPage: true, timeout: 0 });
  report.screenshots.push(path);
}

async function finishIntro(page) {
  for (let guard = 0; guard < 40; guard += 1) {
    const count = await page.locator('.v28-runtime #choiceArea button').count();
    if (count >= 3) break;
    const button = page.locator('.v28-runtime #choiceArea button').first();
    const text = count === 1 ? await button.innerText() : '';
    if (count !== 1 || !/봉투를 펼쳐 본다|다음 대사|대화 뒤 문서를 확인한다|읽은 내용을 들려준다/.test(text)) break;
    await button.click();
    await page.waitForTimeout(180);
  }
}

async function scene(page, prefix, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('chancery-gold-runtime-v1'));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph), null, { timeout: 30000 });
  await page.waitForTimeout(250);
  await capture(page, `${prefix}-arrival`);
  const arrival = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    scrollWidth: document.documentElement.scrollWidth,
    scrollHeight: document.documentElement.scrollHeight,
    choiceCount: document.querySelectorAll('.v28-runtime #choiceArea button').length,
    choiceTexts: [...document.querySelectorAll('.v28-runtime #choiceArea button')].map((button) => button.innerText),
    clippedChoices: [...document.querySelectorAll('.v28-runtime #choiceArea button')].filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.right > innerWidth || rect.left < 0 || rect.bottom + scrollY > document.documentElement.scrollHeight || rect.top + scrollY < 0;
    }).length,
  }));
  await finishIntro(page);
  await capture(page, `${prefix}-choice`);
  const choiceState = await page.evaluate(() => ({
    choiceCount: document.querySelectorAll('.v28-runtime #choiceArea button').length,
    clippedChoices: [...document.querySelectorAll('.v28-runtime #choiceArea button')].filter((button) => {
      const rect = button.getBoundingClientRect();
      return rect.right > innerWidth || rect.left < 0 || rect.bottom + scrollY > document.documentElement.scrollHeight || rect.top + scrollY < 0;
    }).length,
  }));
  report.states.push({ prefix, viewport, arrival, choice: choiceState, overflowFree: arrival.scrollWidth <= arrival.viewport.width && choiceState.clippedChoices === 0 });
  if (await page.locator('.v28-runtime #choiceArea button').count() >= 3) {
    await page.locator('.v28-runtime #choiceArea button').first().click();
    await page.waitForTimeout(180);
    await capture(page, `${prefix}-reaction`);
  }
}

try {
  const page = await browser.newPage({ viewport: { width: 683, height: 384 }, deviceScaleFactor: 2 });
  page.on('pageerror', (error) => report.pageErrors.push(String(error)));
  await scene(page, 'desktop-1366x768-200p', { width: 683, height: 384 });
  await page.close();
  const mobile = await browser.newPage({ viewport: { width: 195, height: 422 }, deviceScaleFactor: 2 });
  mobile.on('pageerror', (error) => report.pageErrors.push(String(error)));
  await scene(mobile, 'mobile-390x844-200p', { width: 195, height: 422 });
  await mobile.close();
  report.status = report.pageErrors.length || report.states.some((state) => !state.overflowFree) ? 'FAIL' : 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failures = [String(error)];
}

fs.writeFileSync(`${out}/V28_200P_ZOOM_EVIDENCE.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (report.status !== 'PASS') process.exitCode = 1;
