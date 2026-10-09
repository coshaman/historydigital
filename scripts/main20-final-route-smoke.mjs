import { chromium } from 'playwright';

const base = process.env.MAIN20_BASE_URL || 'http://127.0.0.1:4173';
const cases = [
  { name: 'default', url: `${base}/`, expected: 'main20' },
  { name: 'main', url: `${base}/#main`, expected: 'main20' },
  { name: 'archive', url: `${base}/#archive-v28`, expected: 'v28' },
];

const browser = await chromium.launch({ headless: true });
try {
  for (const item of cases) {
    const page = await browser.newPage();
    await page.goto(item.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const result = await page.evaluate(() => ({
      main20: Boolean(window.__main20),
      v28: document.body.classList.contains('v28-runtime'),
      title: document.querySelector('#paperTitle')?.textContent || '',
      scene: window.__main20?.getState?.().sceneIndex ?? null,
    }));
    const actual = result.main20 ? 'main20' : result.v28 ? 'v28' : 'unknown';
    if (actual !== item.expected) throw new Error(`${item.name}: expected ${item.expected}, got ${actual} (${JSON.stringify(result)})`);
    console.log(`PASS ${item.name}: ${actual}`);
    await page.close();
  }
} finally {
  await browser.close();
}
