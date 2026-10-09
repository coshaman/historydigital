import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.MAIN20_BASE_URL || 'http://127.0.0.1:4173';
const out = path.resolve('artifacts/final-main20');
fs.mkdirSync(out, { recursive: true });
const viewports = [{ name: 'desktop-1440x900', width: 1440, height: 900 }, { name: 'desktop-1366x768', width: 1366, height: 768 }, { name: 'mobile-390x844', width: 390, height: 844 }, { name: 'mobile-360x800', width: 360, height: 800 }];
const browser = await chromium.launch({ headless: true });
const geometry = [];
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    await page.goto(`${base}/#main`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__main20), null, { timeout: 10000 });
    await page.screenshot({ path: path.join(out, `${viewport.name}-01-onboarding.png`), fullPage: true });
    const initialWidth = await page.locator('.app-shell').evaluate((node) => node.getBoundingClientRect().width);
    for (let i = 0; i < 6; i += 1) await page.locator('#choiceArea button').first().click();
    await page.screenshot({ path: path.join(out, `${viewport.name}-02-first-dialogue.png`), fullPage: true });
    for (let i = 0; i < 5; i += 1) await page.locator('#choiceArea button').first().click();
    await page.screenshot({ path: path.join(out, `${viewport.name}-03-first-choice-directions.png`), fullPage: true });
    const choiceWidth = await page.locator('.app-shell').evaluate((node) => node.getBoundingClientRect().width);
    await page.locator('#petersburgWindow').click({ force: true });
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(out, `${viewport.name}-04-window-open.png`), fullPage: true });
    await page.locator('#petersburgWindow').click({ force: true });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(out, `${viewport.name}-05-window-restored.png`), fullPage: true });
    const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
    if (overflow.width > overflow.client + 1) throw new Error(`${viewport.name}: horizontal overflow ${JSON.stringify(overflow)}`);
    if (Math.abs(initialWidth - choiceWidth) > 1) throw new Error(`${viewport.name}: outer play-area width changed`);
    geometry.push({ viewport: viewport.name, outerPlayAreaWidth: initialWidth, initialWidth, choiceWidth, delta: Math.abs(initialWidth - choiceWidth), overflow });
    await page.close();
  }

  const reader = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await reader.goto(`${base}/#main`, { waitUntil: 'networkidle' });
  await reader.waitForFunction(() => Boolean(window.__main20), null, { timeout: 10000 });
  await reader.evaluate(() => { const state = window.__main20.getState(); state.phase = 'reading'; state.onboardingComplete = true; state.sceneIndex = 0; localStorage.setItem('chancery-main20-v35', JSON.stringify(state)); });
  await reader.reload({ waitUntil: 'networkidle' });
  await reader.waitForFunction(() => Boolean(window.__main20), null, { timeout: 10000 });
  await reader.screenshot({ path: path.join(out, 'desktop-1440x900-06-reader-ru-ko.png'), fullPage: true });
  await reader.locator('#paperColumns').evaluate((node) => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event('scroll')); });
  await reader.screenshot({ path: path.join(out, 'desktop-1440x900-07-reader-scrolled.png'), fullPage: true });
  await reader.close();

  const endingPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  for (const ending of ['UVAROV', 'BELINSKY', 'HERZEN', 'KHOMYAKOV', 'DOSTOEVSKY_PETRASHEVSKY']) {
    await endingPage.goto(`${base}/#main`, { waitUntil: 'networkidle' });
    await endingPage.waitForFunction(() => Boolean(window.__main20), null, { timeout: 10000 });
    await endingPage.evaluate((endingId) => { const state = window.__main20.getState(); state.phase = 'ending'; state.onboardingComplete = true; state.sceneIndex = 4; state.endingId = endingId; state.endingResolution = { endingId, supportingActions: [] }; localStorage.setItem('chancery-main20-v35', JSON.stringify(state)); }, ending);
    await endingPage.reload({ waitUntil: 'networkidle' });
    await endingPage.waitForFunction(() => Boolean(window.__main20), null, { timeout: 10000 });
    await endingPage.screenshot({ path: path.join(out, `desktop-1440x900-ending-${ending}.png`), fullPage: true });
  }
  await endingPage.close();
  fs.writeFileSync(path.join(out, 'geometry.json'), JSON.stringify({ route: '#main', viewports: geometry, endingIds: ['UVAROV', 'BELINSKY', 'HERZEN', 'KHOMYAKOV', 'DOSTOEVSKY_PETRASHEVSKY'] }, null, 2));
  console.log(`PASS MAIN20 evidence: ${geometry.length} viewports, 5 endings, ${fs.readdirSync(out).length} files`);
} finally { await browser.close(); }
