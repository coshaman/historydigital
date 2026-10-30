import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = process.cwd();
const base = process.env.V33_RPG_URL || 'http://127.0.0.1:4173/';
const output = path.join(root, 'artifacts', 'v33', 'OVERCOAT_REALM');
fs.mkdirSync(output, { recursive: true });
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
  await page.getByRole('button', { name: '원문과 번역 펼치기' }).waitFor();
  await page.getByRole('button', { name: '원문과 번역 펼치기' }).click();
  await page.getByText('페테르부르크에는 해마다 400루블 안팎', { exact: false }).waitFor();
  await page.getByRole('button', { name: '판본과 출처 보기' }).click();
  await page.getByRole('button', { name: '자료 목록으로' }).click();
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
  await page.getByRole('button', { name: '원문과 번역 펼치기' }).waitFor();
  await page.getByRole('button', { name: '원문과 번역 펼치기' }).click();
  await page.getByText('페테르부르크에는 해마다 400루블 안팎', { exact: false }).waitFor();
  for (let step = 0; step < 9; step += 1) await page.locator('[data-move="right"]').click();
  await page.locator('#use').click();
  await page.getByRole('button', { name: '수선 불가 판정을 그대로 기록한다' }).click();
  await page.getByText('페트로비치는 외투를 고칠 수 없다고 말했다.', { exact: false }).waitFor();
  const report = await page.evaluate(() => ({
    map: document.querySelector('#mapname').textContent,
    body: document.querySelector('#bodyname').textContent,
    title: document.querySelector('#headline').textContent,
    result: document.querySelector('#journal-text').textContent,
    record: document.querySelector('#record').textContent,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    canvas: { width: document.querySelector('#world').clientWidth, height: document.querySelector('#world').clientHeight },
  }));
  if (!report.result.includes('《외투》')) throw new Error(`Literary framing missing from action result: ${report.result}`);
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
