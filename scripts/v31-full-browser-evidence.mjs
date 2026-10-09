import fs from 'node:fs';
import { chromium } from 'playwright';

const base = 'http://127.0.0.1:4173/?v31=evidence#v28-reset';
const out = 'artifacts/v31-browser';
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync('docs/v31', { recursive: true });
const coreIds = ['C01','C02','C03','C04','C05','C06','C07','C14','C17','C21','C19','C24'];
const browser = await chromium.launch({ headless: true });
const routeResults = [];

async function finishIntro(page) {
  await page.evaluate(() => {
    for (let guard = 0; guard < 12; guard += 1) {
      const buttons = [...document.querySelectorAll('.v28-runtime #choiceArea button')];
      if (buttons.length !== 1 || !/다음 말을 듣는다|고개를 들고 대답한다/.test(buttons[0].textContent || '')) break;
      buttons[0].click();
    }
  });
  await page.waitForFunction(() => document.querySelectorAll('.v28-runtime #choiceArea button').length === 3);
}

async function playCase(page, index, pattern, capture = true) {
  await finishIntro(page);
  const caseId = await page.evaluate(() => window.__goldRuntime.getState().v28.caseId);
  const choiceTexts = await page.locator('.v28-runtime #choiceArea button').allTextContents({ timeoutMs: 8000 });
  const selectedIndex = pattern[index % pattern.length];
  if (capture) await page.screenshot({ path: `${out}/case-${caseId}-choice.png`, fullPage: false });
  await page.locator('.v28-runtime #choiceArea button').nth(selectedIndex).click();
  await page.waitForFunction(() => document.querySelector('#choiceArea button')?.textContent?.includes('봉투를 펼쳐 본다'));
  const reaction = await page.evaluate(() => ({ speaker: document.querySelector('#speaker')?.textContent, line: document.querySelector('#dialogue')?.textContent, selected: window.__goldRuntime.getState().v28.spokenChoices.at(-1)?.spokenKo }));
  if (capture) await page.screenshot({ path: `${out}/case-${caseId}-reaction.png`, fullPage: false });
  await page.getByText('봉투를 펼쳐 본다', { exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.v28-excerpt-open').length === 5);
  await page.evaluate(() => document.querySelectorAll('.v28-excerpt-open').forEach((button) => button.click()));
  await page.waitForFunction(() => document.querySelectorAll('.v28-evidence-card.is-read').length === 5);
  if (capture) await page.screenshot({ path: `${out}/case-${caseId}-evidence.png`, fullPage: false });
  await page.getByText('읽은 내용을 들려준다', { exact: true }).click();
  await page.getByText('오늘의 기록을 접는다', { exact: true }).click();
  await page.getByText(/다음 봉투를 받는다|기록을 보관한다/).click();
  return { caseId, selectedIndex, choiceTexts, reaction };
}

async function runEnding(expectedEnding, pattern) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph));
  for (let index = 0; index < 12; index += 1) {
    await playCase(page, index, pattern, false);
    if (index < 11) await page.waitForFunction((count) => window.__goldRuntime.getState().v28.completedCaseIds.length >= count, index + 1);
  }
  await page.waitForSelector('#endingOverlay:not([hidden])');
  const actualEnding = await page.evaluate(() => window.__goldRuntime.getState().v28.endingId);
  const screenshot = `${out}/ending-${expectedEnding.toLowerCase()}.png`;
  await page.screenshot({ path: screenshot, fullPage: false });
  const state = await page.evaluate(() => { const s = window.__goldRuntime.getState(); return { completed: s.v28.completedCaseIds.length, readDocuments: s.actions.filter((a) => a.type === 'V28_DOCUMENT_READ').length, excerptReads: s.actions.filter((a) => a.type === 'V28_EXCERPT_READ').length }; });
  await context.close();
  return { expectedEnding, actualEnding, screenshot, state, pageErrors };
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(String(error)));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph));
  for (let index = 0; index < 12; index += 1) {
    routeResults.push({ ...(await playCase(page, index, [0, 1, 2], true)), pageErrors });
    if (index < 11) await page.waitForFunction((count) => window.__goldRuntime.getState().v28.completedCaseIds.length >= count, index + 1);
  }
  await context.close();

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobileContext.newPage();
  const mobileErrors = [];
  mobilePage.on('pageerror', (error) => mobileErrors.push(String(error)));
  await mobilePage.goto(base, { waitUntil: 'domcontentloaded' });
  await mobilePage.waitForFunction(() => Boolean(window.__goldRuntime?.getV28Graph));
  await finishIntro(mobilePage);
  await mobilePage.screenshot({ path: `${out}/mobile-C01-choice.png`, fullPage: false });
  await mobilePage.locator('.v28-runtime #choiceArea button').nth(1).click();
  await mobilePage.getByText('봉투를 펼쳐 본다', { exact: true }).click();
  await mobilePage.waitForSelector('.v28-excerpt-open');
  await mobilePage.screenshot({ path: `${out}/mobile-C01-evidence.png`, fullPage: false });
  await mobileContext.close();

  const endings = [];
  for (const [ending, pattern] of Object.entries({ DOSTOEVSKY_PETRASHEVSKY: [0], HERZEN: [1], BELINSKY: [2], KHOMYAKOV: [0, 1], UVAROV: [0, 1, 2] })) endings.push(await runEnding(ending, pattern));
  const report = { schemaVersion: 'V31-FULL-BROWSER-EVIDENCE-1', status: routeResults.length === 12 && endings.every((item) => item.expectedEnding === item.actualEnding && item.state.completed === 12 && item.state.readDocuments === 12 && item.state.excerptReads === 60 && item.pageErrors.length === 0) && routeResults.every((item) => item.pageErrors.length === 0 && item.choiceTexts.length === 3) ? 'PASS' : 'FAIL', coreCases: coreIds, routeResults, endings, mobile: { screenshots: ['mobile-C01-choice.png', 'mobile-C01-evidence.png'], pageErrors: mobileErrors }, checkedAt: new Date().toISOString() };
  fs.writeFileSync('docs/v31/FULL_BROWSER_EVIDENCE.json', `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync('docs/v31/CORE_12_TRANSCRIPT_SAMPLES.md', `# V31 12건 실행 대화 샘플\n\n${routeResults.map((item) => `## ${item.caseId}\n- 선택지: ${item.choiceTexts.join(' / ')}\n- 반응: ${item.reaction.speaker} — ${item.reaction.line}\n- 화면: case-${item.caseId}-reaction.png`).join('\n\n')}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
} finally {
  await browser.close();
}
