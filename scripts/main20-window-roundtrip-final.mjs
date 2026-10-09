import { chromium } from 'playwright';

const base = process.env.MAIN20_BASE_URL || 'http://127.0.0.1:4173';
const viewports = [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }];
const browser = await chromium.launch({ headless: true });
try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.goto(`${base}/#main`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__main20), null, { timeout: 10000 });
    const seeded = await page.evaluate(() => {
      const current = window.__main20.getState();
      current.phase = 'reading'; current.onboardingComplete = true; current.sceneIndex = 0; current.readingScrollByScene = { C03: 37 };
      localStorage.setItem('chancery-main20-v35', JSON.stringify(current));
      return current;
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__main20), null, { timeout: 10000 });
    const columns = page.locator('#paperColumns');
    await columns.evaluate((node) => { node.scrollTop = 37; node.dispatchEvent(new Event('scroll')); });
    const before = await page.evaluate(() => ({ state: window.__main20.getState(), scroll: document.querySelector('#paperColumns').scrollTop }));
    await page.locator('#petersburgWindow').click({ force: true, timeout: 3000 });
    await page.waitForTimeout(260);
    const open = await page.evaluate(() => ({ open: document.body.classList.contains('window-view'), dialogHidden: getComputedStyle(document.querySelector('.dialogue-strip')).visibility === 'hidden', choicesHidden: document.querySelector('#choiceArea').inert, exterior: getComputedStyle(document.querySelector('#petersburgWindow')).zIndex }));
    if (!open.open || !open.dialogHidden || !open.choicesHidden) throw new Error(`window did not take focus at ${viewport.width}: ${JSON.stringify(open)}`);
    await page.locator('#petersburgWindow').click({ force: true, timeout: 3000 });
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => ({ state: window.__main20.getState(), scroll: document.querySelector('#paperColumns').scrollTop, closed: !document.body.classList.contains('window-view') }));
    if (!after.closed || after.state.phase !== before.state.phase || after.state.sceneIndex !== before.state.sceneIndex || after.scroll !== before.scroll) throw new Error(`roundtrip mismatch at ${viewport.width}: ${JSON.stringify({ before, after })}`);
    console.log(`PASS window roundtrip ${viewport.width}x${viewport.height}`);
    await page.close();
  }
} finally { await browser.close(); }
