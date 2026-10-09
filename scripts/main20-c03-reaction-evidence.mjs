import { chromium } from 'playwright';
import fs from 'node:fs';

fs.mkdirSync('artifacts/final-main20', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${process.env.MAIN20_BASE_URL || 'http://127.0.0.1:4173'}/#main`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__main20), null, { timeout: 10000 });
  for (let i = 0; i < 6; i += 1) await page.locator('#choiceArea button').first().click();
  for (let i = 0; i < 5; i += 1) await page.locator('#choiceArea button').first().click();
  await page.locator('#choiceArea button').first().click();
  const speaker = await page.locator('#speaker').textContent();
  if (!speaker?.includes('알렉세이')) throw new Error(`C03-A reaction rendered as ${speaker}`);
  await page.screenshot({ path: 'artifacts/final-main20/C03-A-reaction-1440x900.png', fullPage: true });
  console.log(`PASS C03-A reaction speaker: ${speaker}`);
} finally { await browser.close(); }
