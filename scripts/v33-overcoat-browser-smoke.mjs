import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const base = process.env.V33_RPG_URL || 'http://127.0.0.1:4173/';
const output = path.join(root, 'artifacts', 'v33', 'OVERCOAT_REALM');
const v35Screenshots = path.join(root, 'docs', 'v35', 'screenshots');
fs.mkdirSync(output, { recursive: true });
fs.mkdirSync(v35Screenshots, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(8000);
const errors = [];
page.on('pageerror', error => errors.push(String(error)));

try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#source-drawer-open').click();
  const realmChoices = await page.locator('#actions').innerText();
  if (!realmChoices.includes('외투')) throw new Error(`The source drawer did not offer the Overcoat realm: ${realmChoices}`);
  await page.locator('#actions button').filter({ hasText: '《외투》 속 재단사의 방으로 들어가기' }).click();
  await page.getByText('자료철에서 해당 작품의 원문을 먼저 읽어야 한다.', { exact: true }).waitFor();
  if ((await page.locator('#mapname').innerText()).includes('재단사의 방')) throw new Error('The literary realm opened before its source was read');
  await page.getByRole('button', { name: /《외투》 · 낡은 옷과 새 외투의 값/ }).click();
  await page.locator('#source-reader').waitFor({ state: 'visible' });
  await page.locator('#source-reader-passages').getByText('페테르부르크에는 해마다 400루블 안팎', { exact: false }).waitFor();
  await page.getByRole('link', { name: /확인한 러시아어 원문 열기/ }).waitFor();
  const readerEvidence = await page.evaluate(() => ({
    titleKo: document.querySelector('#source-reader-title')?.textContent,
    titleRu: document.querySelector('#source-reader-title-ru')?.textContent,
    citation: document.querySelector('#source-reader-ids')?.textContent,
    layout: document.querySelector('#source-reader')?.className,
    russianVisible: Boolean(document.querySelector('.source-passage-ru')?.getClientRects().length),
    koreanVisible: Boolean(document.querySelector('.source-passage-ko')?.getClientRects().length),
    sourceLinkVisible: Boolean(document.querySelector('#source-reader-links a')?.getClientRects().length),
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
  }));
  if (!readerEvidence.titleKo || !readerEvidence.titleRu || !readerEvidence.citation.includes('EX-')) throw new Error(`Source reader metadata is incomplete: ${JSON.stringify(readerEvidence)}`);
  if (!readerEvidence.russianVisible || !readerEvidence.koreanVisible || !readerEvidence.sourceLinkVisible || readerEvidence.horizontalOverflow) throw new Error(`Source reader did not render both languages and provenance cleanly: ${JSON.stringify(readerEvidence)}`);
  await page.screenshot({ path: path.join(v35Screenshots, 'source-reader-overcoat-1440x900.png'), fullPage: true });
  const readerViewports = [];
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }, { width: 360, height: 800 }]) {
    await page.setViewportSize(viewport);
    const layout = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, dialogWidth: Math.round(document.querySelector('#source-reader').getBoundingClientRect().width), dialogHeight: Math.round(document.querySelector('#source-reader').getBoundingClientRect().height) }));
    if (layout.documentWidth !== layout.width) throw new Error(`Source reader overflows ${viewport.width}x${viewport.height}: ${JSON.stringify(layout)}`);
    readerViewports.push(layout);
    await page.screenshot({ path: path.join(v35Screenshots, `source-reader-overcoat-${viewport.width}x${viewport.height}.png`), fullPage: true });
  }
  const mobileReader = readerViewports.find(layout => layout.width === 390);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('#source-reader-complete').click();
  await page.locator('#actions button').filter({ hasText: '《외투》 속 재단사의 방으로 들어가기' }).click();
  await page.getByText('《외투》 속 재단사의 방', { exact: true }).first().waitFor();
  await page.locator('#use').click();
  const akakyActions = await page.locator('#actions').innerText();
  if (!akakyActions.includes('몸을 빌린다')) throw new Error(`Akaky did not appear at the adjacent tile: ${akakyActions}`);
  await page.getByRole('button', { name: '몸을 빌린다' }).click();
  if (!(await page.locator('#bodyname').innerText()).includes('아카키')) throw new Error('Akaky embodiment did not update the visible host name');
  await page.locator('[data-move="left"]').click();
  await page.locator('[data-move="left"]').click();
  await page.locator('[data-move="left"]').click();
  await page.locator('#use').click();
  await page.locator('#source-reader').waitFor({ state: 'visible' });
  await page.locator('#source-reader-passages').getByText('페테르부르크에는 해마다 400루블 안팎', { exact: false }).waitFor();
  await page.locator('#source-reader-complete').click();
  for (let step = 0; step < 9; step += 1) await page.locator('[data-move="right"]').click();
  await page.locator('#use').click();
  await page.getByRole('button', { name: '수선 불가 판정을 그대로 기록한다' }).click();
  await page.getByText('페트로비치는 외투를 고칠 수 없다고 했다.', { exact: false }).waitFor();
  const report = await page.evaluate(() => ({
    map: document.querySelector('#mapname').textContent,
    body: document.querySelector('#bodyname').textContent,
    title: document.querySelector('#headline').textContent,
    result: document.querySelector('#journal-text').textContent,
    record: document.querySelector('#record').textContent,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    canvas: { width: document.querySelector('#world').clientWidth, height: document.querySelector('#world').clientHeight },
  }));
  report.base = base;
  report.sourceGate = { entryBlockedBeforeReading: true, archiveExcerptReadBeforeEntry: true, entrySucceededAfterReading: true, reader: readerEvidence, readerViewports };
  if (!report.result.includes('판정을 그대로 기록했다')) throw new Error(`Recorded repair decision missing from action result: ${report.result}`);
  if (report.horizontalOverflow) throw new Error('Overcoat route overflows at desktop viewport');
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
  await page.screenshot({ path: path.join(output, 'akaky-record-1440x900.png'), fullPage: true });
  await page.keyboard.press('h');
  await page.locator('#actions button').filter({ hasText: '문학 세계에서 돌아오기' }).click();
  if ((await page.locator('#mapname').innerText()).includes('재단사의 방')) throw new Error('Leaving the literary realm did not return to the historical map');
  report.returnedToHistoricalMap = true;
  report.noPageErrors = true;
  fs.writeFileSync(path.join(output, 'BROWSER_SMOKE.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await context.close();
  await browser.close();
}
