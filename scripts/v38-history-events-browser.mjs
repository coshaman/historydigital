import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base = process.env.V33_RPG_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const scenarios = [
  { title: '상원 광장, 12월 14일', first: '사람들에게 확인된 명령만 전한다', second: '목격한 일과 전해 들은 말을 나눠 적는다', proof: 'GARF' },
  { title: '알렉산드린스키 극장의 《감찰관》', first: '공연을 보고 객석의 반응을 기록한다', second: '공연 기록과 고골의 편지를 함께 살핀다', proof: '1836년 4월 19일' },
  { title: '농노해방 선언이 읽히는 날', first: '선언문과 시행 규정을 나눠 읽는다', second: '생활 질문을 관청에 전달할 사본으로 만든다', proof: 'RGIA' },
];
const results = [];
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !document.querySelector('#roster-open')?.disabled);
    const eventButton = page.locator('#history-events-open');
    assert.equal(await eventButton.isVisible(), true);
    const headerLayout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, button: document.querySelector('#history-events-open').getBoundingClientRect().toJSON() }));
    assert.ok(headerLayout.scrollWidth <= headerLayout.width, `page overflows at ${viewport.width}px: ${JSON.stringify(headerLayout)}`);
    for (const [index, event] of scenarios.entries()) {
      if (index === 0) await eventButton.click();
      else await page.locator('#actions button').filter({ hasText: '다른 현장 보기' }).click();
      await page.locator('#actions button').filter({ hasText: event.title }).click();
      await page.locator('#actions button').filter({ hasText: event.first }).click();
      const secondChoice = page.locator('#actions button').filter({ hasText: event.second });
      await secondChoice.waitFor();
      await secondChoice.click();
      await page.locator('#journal-text').getByText(event.proof, { exact: false }).waitFor();
      await page.locator('#actions button').filter({ hasText: '사료 원문 열기' }).waitFor();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('v38-historical-event-records') || '{}'));
      assert.ok(saved[ ['SENATE_SQUARE_1825', 'GOGOL_INSPECTOR_1836', 'EMANCIPATION_1861'][index] ], 'event intervention persisted locally');
    }
    assert.deepEqual(errors, [], `browser errors at ${viewport.width}px`);
    results.push({ viewport, noHorizontalOverflow: true, eventsCompleted: 3, errors });
    await context.close();
  }
  console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
} finally {
  await browser.close();
}
