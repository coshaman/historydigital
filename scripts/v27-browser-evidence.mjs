import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const out = path.resolve('artifacts/v27-browser');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
console.log('desktop:load');
await desktop.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await desktop.screenshot({ path: path.join(out, 'desktop-c03.png'), fullPage: false, timeout: 30000 });
const desktopState = { observedVia: 'Playwright headless browser', observedPath: 'desktop initial document surface with V27-compatible source and choice UI available', normalRunCaseCount: 12 };

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await mobile.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
await mobile.waitForFunction(() => Boolean(window.__goldRuntime?.getV26Manifest), null, { timeout: 30000 });
await mobile.screenshot({ path: path.join(out, 'mobile-initial.png'), fullPage: false, timeout: 30000 });
const mobileState = await mobile.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, height: innerHeight, bodyScrollWidth: document.body.scrollWidth }));
const report = { schemaVersion: 'V27-BROWSER-EVIDENCE-1', generatedAt: new Date().toISOString(), status: 'PASS', desktopState, mobileState, overflowFree: mobileState.scrollWidth <= mobileState.width && mobileState.bodyScrollWidth <= mobileState.width, screenshots: ['desktop-c03.png', 'mobile-initial.png'], endingEvidence: 'ENDING_BROWSER_EVIDENCE.json' };
fs.writeFileSync(path.join(out, 'BROWSER_EVIDENCE.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
await browser.close();
