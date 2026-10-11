import fs from 'node:fs';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4173/?main20=1&v42fresh=1';
const failures = [];
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });

const state = (page) => page.evaluate(() => window.__main20?.getState());
const click = async (page, name) => { const button = page.getByRole('button', { name, exact: true }); if (!(await button.count())) throw new Error(`missing button: ${name}`); await button.first().click(); await page.waitForTimeout(20); };
const advanceButton = async (page) => { const buttons = page.locator('#choiceArea button'); if (!(await buttons.count())) throw new Error('choice area dead end'); await buttons.first().click(); await page.waitForTimeout(20); };
const readScene = async (page) => { const marks = page.locator('.main20-read-mark'); for (let i = 0; i < await marks.count(); i += 1) { const mark = marks.nth(i); await mark.scrollIntoViewIfNeeded(); await page.waitForTimeout(25); if (await mark.isEnabled()) await mark.click(); } await click(page, '자료 토론으로 간다'); };
const visibleText = (page) => page.locator('body').innerText();

async function play(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__main20?.getState), { timeout: 12000 });
  const seen = [];
  let prologueText = '';
  let guard = 0;
  while (guard++ < 500) {
    const current = await state(page);
    if (!current) throw new Error('MAIN20 state missing');
    if (current.phase === 'ending') break;
    if (current.phase === 'ideology_prologue') prologueText += `\n${await visibleText(page)}`;
    if (current.phase === 'onboarding') {
      const next = page.getByRole('button', { name: '다음 말을 듣는다', exact: true });
      if (await next.count()) await next.click(); else await click(page, '이 방의 기록과 사람을 함께 살피겠습니다');
    } else if (current.phase === 'ideology_prologue' || current.phase === 'c07_ideology') {
      const next = page.getByRole('button', { name: '다음 말을 듣는다', exact: true });
      const read = page.getByRole('button', { name: '자료를 읽고 답한다', exact: true });
      const cards = page.locator('.main20-choice-card');
      if (await next.count()) await next.click(); else if (await read.count()) await read.click(); else if (await cards.count()) await cards.first().click(); else throw new Error(`${current.phase} dead end`);
      await page.waitForTimeout(20);
    } else if (current.phase === 'intro') {
      await advanceButton(page);
    } else if (current.phase === 'reading') {
      await readScene(page);
    } else if (current.phase === 'source_discussion') {
      await advanceButton(page);
    } else if (current.phase === 'decision' || current.phase === 'post_choice') {
      const cards = page.locator('.main20-choice-card');
      if (!(await cards.count())) throw new Error(`${current.phase} has no visible choice cards`);
      for (let i = 0; i < await cards.count(); i += 1) {
        const copy = await cards.nth(i).innerText();
        if (!copy.includes('·')) failures.push(`${current.phase}/${i}: immediate direction subcopy missing`);
      }
      await cards.first().click();
    } else if (current.phase === 'reaction' || current.phase === 'final_reaction') {
      await advanceButton(page);
    } else if (current.phase === 'legacy_recovery') {
      throw new Error('legacy recovery reached during V42 route');
    } else {
      throw new Error(`unknown phase ${current.phase}`);
    }
    const after = await state(page);
    if (after?.sceneIndex !== undefined && !seen.includes(after.sceneIndex)) seen.push(after.sceneIndex);
  }
  const final = await state(page);
  if (final?.phase !== 'ending' && final?.phase !== 'legacy_recovery') failures.push(`route ended in ${final?.phase}`);
  return { final, text: await visibleText(page), prologueText, seen, guard };
}

const report = { status: false, viewports: {} };
for (const viewport of [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  try {
    const result = await play(page);
    const bodyWidth = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth, walk: document.querySelector('#walkBtn')?.hidden }));
    if (bodyWidth.body > bodyWidth.viewport + 1) failures.push(`${viewport.name}: horizontal overflow ${bodyWidth.body}/${bodyWidth.viewport}`);
    if (bodyWidth.walk === false) failures.push(`${viewport.name}: legacy walk button visible`);
    for (const phrase of ['표트르 이후', '관등표', '10등관', '정교회', '전제정', '민족성', '차다예프', '유럽']) if (!result.prologueText.includes(phrase)) failures.push(`${viewport.name}: missing prologue comprehension phrase ${phrase}`);
    report.viewports[viewport.name] = { phase: result.final.phase, sceneIndex: result.final.sceneIndex, guard: result.guard, bodyWidth };
  } catch (error) { failures.push(`${viewport.name}: ${error.message}`); }
  await page.close();
}
await browser.close();
report.status = failures.length === 0;
report.failures = failures;
fs.mkdirSync('artifacts/v42-browser', { recursive: true });
fs.writeFileSync('artifacts/v42-browser/report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!report.status) process.exit(1);
