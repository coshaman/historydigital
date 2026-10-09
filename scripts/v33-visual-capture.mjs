import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const runId = process.env.V33_RUN_ID || 'V33_20261004_READER_WINDOW';
const out = path.join(root, 'artifacts', 'v33', runId);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(15000);
const base = 'http://127.0.0.1:4173/?main20=1#v33';
async function fresh(viewport) { await page.setViewportSize(viewport); await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => Boolean(window.__main20)); }
async function introToChoice() { while (await page.evaluate(() => window.__main20.getState().phase === 'intro')) await page.locator('#choiceArea button').first().click(); await page.waitForFunction(() => window.__main20.getState().phase === 'choice'); }
async function beginReading(choice = 0) { await page.locator('#choiceArea button').nth(choice).click(); await page.locator('#choiceArea button').first().click(); await page.waitForFunction(() => window.__main20.getState().phase === 'reading'); }
async function readAll() { const articles = page.locator('.main20-excerpt'); for (let i = 0; i < await articles.count(); i += 1) { const article = articles.nth(i); await article.scrollIntoViewIfNeeded(); await article.locator('.main20-read-mark').click(); } }

await fresh({ width: 390, height: 844 });
await introToChoice();
await page.screenshot({ path: path.join(out, 'C03-choice-390x844.png'), fullPage: true });
await page.locator('#petersburgWindow').click(); await page.waitForFunction(() => document.body.classList.contains('window-view')); await page.screenshot({ path: path.join(out, 'C03-window-390x844.png'), fullPage: true });
await page.locator('#petersburgWindow').click(); await page.waitForFunction(() => !document.body.classList.contains('window-view'));
await page.screenshot({ path: path.join(out, 'C03-window-return-390x844.png'), fullPage: true });
await beginReading(0);
await page.screenshot({ path: path.join(out, 'C03-reading-before-scroll-390x844.png'), fullPage: true });
await page.locator('#paperColumns').evaluate((node) => { node.scrollTop = Math.floor(node.scrollHeight / 2); });
await page.screenshot({ path: path.join(out, 'C03-reading-mid-scroll-390x844.png'), fullPage: true });
await readAll();
await page.locator('#choiceArea button').first().click();
await page.screenshot({ path: path.join(out, 'C03-post-choice-390x844.png'), fullPage: true });
await page.locator('#choiceArea button').first().click();
await page.locator('#choiceArea button').first().click();
await page.waitForFunction(() => window.__main20.getState().phase === 'intro');

await fresh({ width: 1440, height: 900 });
await introToChoice(); await beginReading(0); await readAll(); await page.locator('#choiceArea button').first().click(); await page.locator('#choiceArea button').first().click(); await page.locator('#choiceArea button').first().click(); await page.waitForFunction(() => window.__main20.getState().phase === 'intro');
await introToChoice(); await beginReading(0);
await page.screenshot({ path: path.join(out, 'C06-reading-before-scroll-1440x900.png'), fullPage: true });
await page.locator('#paperColumns').evaluate((node) => { node.scrollTop = Math.floor(node.scrollHeight / 2); });
await page.screenshot({ path: path.join(out, 'C06-reading-mid-scroll-1440x900.png'), fullPage: true });
await readAll(); await page.screenshot({ path: path.join(out, 'C06-reading-after-scroll-1440x900.png'), fullPage: true });
const metrics = await page.evaluate(() => { const paper = document.querySelector('#paper').getBoundingClientRect(); const cols = document.querySelector('#paperColumns').getBoundingClientRect(); const items = [...document.querySelectorAll('.main20-excerpt')].map((el) => { const ru = el.querySelector('.ru-text').getBoundingClientRect(); const ko = el.querySelector('.ko-text').getBoundingClientRect(); return { ru: { x: ru.x, y: ru.y, width: ru.width, height: ru.height }, ko: { x: ko.x, y: ko.y, width: ko.width, height: ko.height } }; }); return { paper: { x: paper.x, y: paper.y, width: paper.width, height: paper.height }, columns: { x: cols.x, y: cols.y, width: cols.width, height: cols.height }, items, windowImage: { src: document.querySelector('.window-plate')?.getAttribute('src'), naturalWidth: document.querySelector('.window-plate')?.naturalWidth || 0 } }; });
fs.writeFileSync(path.join(out, 'V33_VISUAL_METRICS.json'), JSON.stringify(metrics, null, 2) + '\n');
await browser.close(); console.log(JSON.stringify({ status: 'PASS', runId, metrics }));
