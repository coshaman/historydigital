import fs from 'node:fs';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/#v28-reset';
const out = 'artifacts/v28-browser/endings';
fs.mkdirSync(out, { recursive: true });
const routes = {
  DOSTOEVSKY_PETRASHEVSKY: [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 2],
  HERZEN: [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2],
  BELINSKY: [2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1],
  KHOMYAKOV: [0, 1],
  UVAROV: [0, 1, 2],
};
const browser = await chromium.launch({ headless: true });
const results = [];

for (const [expectedEnding, pattern] of Object.entries(routes)) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph), null, { timeout: 30000 });
  const finishIntro = async () => { await page.evaluate(() => { for (let guard = 0; guard < 40; guard += 1) { const buttons = [...document.querySelectorAll('.v28-runtime #choiceArea button')]; if (buttons.length !== 1 || !/다음 말을 듣는다|고개를 들고 대답한다/.test(buttons[0].textContent || '')) break; buttons[0].click(); } }); };
  const clickText = async (text) => page.evaluate((value) => {
    const element = [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === value);
    if (!element) throw new Error(`missing action: ${value}`);
    element.click();
  }, text);
  const readAllExcerpts = async () => {
    await page.waitForFunction(() => document.querySelectorAll('.v28-excerpt-open').length >= 5, null, { timeout: 30000 });
    await page.evaluate(() => document.querySelectorAll('.v28-excerpt-open').forEach((button) => button.click()));
    await page.waitForFunction(() => document.querySelectorAll('.v28-evidence-card.is-read').length === document.querySelectorAll('.v28-excerpt-open').length, null, { timeout: 30000 });
  };
  for (let index = 0; index < 12; index += 1) {
    console.log(`${expectedEnding}: case ${index + 1}/12`);
    await finishIntro();
    await page.evaluate((choiceIndex) => document.querySelectorAll('.v28-runtime #choiceArea button')[choiceIndex]?.click(), pattern[index % pattern.length]);
    await clickText('봉투를 펼쳐 본다');
    await readAllExcerpts();
    await clickText('읽은 내용을 들려준다');
    await clickText('오늘의 기록을 접는다');
    await page.getByText(/다음 봉투를 받는다|기록을 보관한다/).evaluate((element) => element.click());
    if (index < 11) {
      await page.waitForFunction((completedCount) => window.__goldRuntime.getState().v28.completedCaseIds.length >= completedCount, index + 1, { timeout: 30000 });
      await page.waitForTimeout(100);
      await page.waitForFunction(() => { const buttons = [...document.querySelectorAll('.v28-runtime #choiceArea button')]; return buttons.length >= 3 || (buttons.length === 1 && /다음 말을 듣는다|고개를 들고 대답한다/.test(buttons[0].textContent || '')); }, null, { timeout: 30000 });
    }
  }
  console.log(`${expectedEnding} final state`, await page.evaluate(() => { const s = window.__goldRuntime.getState(); return { phase: s.v28.phase, completed: s.v28.completedCaseIds.length, counts: s.v28.choiceCounts, access: s.v27.access, relationships: s.relationships, witnesses: s.v28.witnessedCharacters, ending: s.v28.endingId, assessment: window.__goldRuntime.v28EndingAssessment?.() }; }));
  await page.waitForSelector('#endingOverlay:not([hidden])', { timeout: 30000 });
  const actualEnding = await page.evaluate(() => window.__goldRuntime.getState().v28.endingId);
  const endingState = await page.evaluate(() => {
    const state = window.__goldRuntime.getState();
    return {
      completedCaseCount: state.v28.completedCaseIds.length,
      choiceCounts: { ...state.v28.choiceCounts },
      witnessedCharacters: [...state.v28.witnessedCharacters],
      access: { ...(state.v27?.access || {}) },
      relationships: { ...(state.relationships || {}) },
      risk: state.v28.risk,
      routedDocuments: state.actions.filter(action => action.type === 'V28_ROUTED_DOCUMENT').length,
      readDocuments: state.actions.filter(action => action.type === 'V28_DOCUMENT_READ').length,
    };
  });
  const title = await page.locator('#endingTitle').innerText();
  const screenshot = `${out}/ending-${expectedEnding.toLowerCase()}.png`;
  await page.screenshot({ path: screenshot, fullPage: true });
  results.push({ expectedEnding, actualEnding, title, pattern, endingState, screenshot, pageErrors });
  await context.close();
}

const report = { schemaVersion: 'V28-ENDING-BROWSER-2', status: results.every((item) => item.expectedEnding === item.actualEnding && item.pageErrors.length === 0) ? 'PASS' : 'FAIL', results };
fs.writeFileSync('docs/v28/ENDING_BROWSER_EVIDENCE.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (report.status !== 'PASS') process.exit(1);
