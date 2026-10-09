import fs from 'node:fs';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/?v30=evidence#v28-reset';
const out = 'artifacts/v30-browser';
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync('docs/v30', { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const scenes = [
  { key: 'alexei', choice: 0, expected: '알렉세이 오를로프' },
  { key: 'ekaterina', choice: 1, expected: '예카테리나 벨로바' },
  { key: 'pavel', choice: 2, expected: '파벨 안토노프' },
];

try {
  for (const viewport of [{ key: 'desktop', width: 1440, height: 900 }, { key: 'mobile', width: 390, height: 844 }]) {
    for (const scene of scenes) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      const pageErrors = [];
      page.on('pageerror', (error) => pageErrors.push(String(error)));
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph));
      const choices = page.locator('#choiceArea button');
      await choices.nth(scene.choice).click();
      await page.waitForFunction((name) => document.querySelector('#speaker')?.textContent === name, scene.expected);
      const speaker = await page.locator('#speaker').innerText();
      const line = await page.locator('#dialogue').innerText();
      const portraitSrc = await page.locator('#v28Portrait .portrait-image').getAttribute('src');
      const choiceText = await page.locator('#choiceArea button').first().innerText();
      const screenshot = `${out}/${viewport.key}-${scene.key}-reaction.png`;
      await page.screenshot({ path: screenshot, fullPage: false });
      results.push({ viewport: viewport.key, scene: scene.key, speaker, line, choiceText, portraitSrc, screenshot, pageErrors });
      await context.close();
    }
  }
  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  mobilePage.setDefaultTimeout(15000);
  const mobileErrors = [];
  mobilePage.on('pageerror', (error) => mobileErrors.push(String(error)));
  await mobilePage.goto(base, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph));
  await mobilePage.locator('#choiceArea button').first().click();
  await mobilePage.locator('#choiceArea button').first().click();
  await mobilePage.waitForSelector('.v28-excerpt-open');
  const cards = mobilePage.locator('.v28-excerpt-open');
  const count = await cards.count();
  for (let index = 0; index < count; index += 1) await cards.nth(index).click();
  await mobilePage.waitForFunction(() => document.querySelectorAll('.v28-evidence-card.is-read').length === 5);
  const evidenceScreenshot = `${out}/mobile-evidence-all-read.png`;
  await mobilePage.screenshot({ path: evidenceScreenshot, fullPage: false });
  results.push({ viewport: 'mobile', scene: 'evidence-all-read', excerptCount: count, screenshot: evidenceScreenshot, pageErrors: mobileErrors });
  await mobileContext.close();
} finally {
  await browser.close();
}

const report = {
  schemaVersion: 'V30-DIALOGUE-PORTRAIT-BROWSER-1',
  status: results.every((item) => item.pageErrors.length === 0 && (!item.scene.includes('evidence') ? item.portraitSrc?.includes('assets/portraits/') : item.excerptCount === 5)) ? 'PASS' : 'FAIL',
  results,
  checkedAt: new Date().toISOString(),
};
fs.writeFileSync('docs/v30/DIALOGUE_PORTRAIT_BROWSER_EVIDENCE.json', `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync('docs/v30/REWRITTEN_DIALOGUE_SAMPLES.md', `# V30 대화 샘플\n\n${results.filter((item) => item.line).map((item) => `- ${item.speaker}: “${item.line}”\n  - 선택지: “${item.choiceText}”\n  - 화면: ${item.viewport} / ${item.scene}`).join('\n')}\n`);
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exit(1);
