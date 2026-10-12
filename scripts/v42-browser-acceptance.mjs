import fs from 'node:fs';
import { chromium } from 'playwright';

const baseUrl = process.env.V42_BASE_URL || 'http://127.0.0.1:4173/?main20=1&v42fresh=1';
const failures = [];
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });

const state = (page) => page.evaluate(() => window.__main20?.getState());
const click = async (page, name) => { const button = page.getByRole('button', { name, exact: true }); if (!(await button.count())) throw new Error(`missing button: ${name}`); await button.first().click(); await page.waitForTimeout(20); };
const advanceButton = async (page) => { const buttons = page.locator('#choiceArea button'); if (!(await buttons.count())) throw new Error('choice area dead end'); await buttons.first().click(); await page.waitForTimeout(20); };
const readScene = async (page) => { const marks = page.locator('.main20-read-mark'); for (let i = 0; i < await marks.count(); i += 1) { const mark = marks.nth(i); await mark.scrollIntoViewIfNeeded(); await page.waitForTimeout(25); if (await mark.isEnabled()) await mark.click(); } const layout = await page.evaluate(() => { const dialogue = document.querySelector('.dialogue-strip'); const paper = document.querySelector('#paper'); const columns = document.querySelector('#paperColumns'); const button = document.querySelector('#choiceArea button'); const stage = document.querySelector('.document-stage'); const desk = document.querySelector('.desk'); const dialogueRect = dialogue?.getBoundingClientRect(); const paperRect = paper?.getBoundingClientRect(); const buttonRect = button?.getBoundingClientRect(); const stageRect = stage?.getBoundingClientRect(); const deskRect = desk?.getBoundingClientRect(); return { viewport: { width: innerWidth, height: innerHeight }, desk: deskRect && { top: deskRect.top, bottom: deskRect.bottom, grid: getComputedStyle(desk).gridTemplateRows }, stage: stageRect && { top: stageRect.top, bottom: stageRect.bottom, paddingBottom: getComputedStyle(stage).paddingBottom }, dialogue: dialogueRect && { top: dialogueRect.top, bottom: dialogueRect.bottom, height: dialogueRect.height, overflowY: getComputedStyle(dialogue).overflowY }, paper: paperRect && { top: paperRect.top, bottom: paperRect.bottom, height: paperRect.height, overflowY: getComputedStyle(paper).overflowY }, columns: columns && { overflowY: getComputedStyle(columns).overflowY, clientHeight: columns.clientHeight, scrollHeight: columns.scrollHeight }, button: buttonRect && { top: buttonRect.top, bottom: buttonRect.bottom, height: buttonRect.height } }; }); if (!layout.dialogue || layout.dialogue.top < 0 || layout.dialogue.bottom > layout.viewport.height || layout.dialogue.height > 180 || !layout.paper || layout.paper.bottom > layout.dialogue.top || !['auto', 'scroll'].includes(layout.paper.overflowY) || !['auto', 'scroll'].includes(layout.columns?.overflowY) || !['auto', 'scroll'].includes(layout.dialogue.overflowY) || !layout.button || layout.button.top < layout.dialogue.top || layout.button.bottom > layout.dialogue.bottom) throw new Error(`reading page overlaps or hides the continuation UI at ${layout.viewport.width}x${layout.viewport.height}: ${JSON.stringify(layout)}`); await click(page, '자료 토론으로 간다'); };
const visibleText = (page) => page.locator('body').innerText();

async function play(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__main20?.getState), { timeout: 12000 });
  await page.waitForFunction(() => Boolean(document.querySelector('#deskCanvas')?.dataset.threeLoaded), { timeout: 20000 });
  const threeDesk = await page.evaluate(() => { const canvas = document.querySelector('#deskCanvas'); const style = canvas && getComputedStyle(canvas); return { present: Boolean(canvas), display: style?.display, loaded: canvas?.dataset.threeLoaded, fallback: canvas?.dataset.fallback }; });
  if (!threeDesk.present || threeDesk.display === 'none' || threeDesk.loaded !== 'local' || threeDesk.fallback !== 'false') throw new Error(`3D desk was not restored on MAIN20 route: ${JSON.stringify(threeDesk)}`);
  if ([1996, 1440, 390].includes(await page.evaluate(() => innerWidth))) { const width = await page.evaluate(() => innerWidth); fs.mkdirSync('artifacts/v53-desk', { recursive: true }); await page.screenshot({ path: `artifacts/v53-desk/desk-${width}.png` }); }
  const seen = [];
  const trace = [];
  let prologueText = '';
  let guard = 0;
  while (guard++ < 500) {
    const current = await state(page);
    trace.push({ phase: current?.phase, sceneIndex: current?.sceneIndex, sceneId: await page.evaluate(() => window.__main20.data.scenes[window.__main20.getState().sceneIndex]?.id), branchHubIndex: current?.branchHubIndex, routeChoices: current?.routeChoices?.slice() });
    if (!current) throw new Error('MAIN20 state missing');
    if (current.phase === 'ending') break;
    if (current.phase === 'ideology_prologue') prologueText += `\n${await visibleText(page)}`;
    if (current.phase === 'onboarding') {
      const next = page.getByRole('button', { name: '다음 말을 듣는다', exact: true });
      if (await next.count()) await next.click(); else await click(page, await page.evaluate(() => window.__main20.data.onboarding.response.text));
    } else if (current.phase === 'ideology_prologue' || current.phase === 'c07_ideology') {
      const next = page.getByRole('button', { name: '다음 말을 듣는다', exact: true });
      const read = page.getByRole('button', { name: '자료를 읽고 답한다', exact: true });
      const newspaperRead = page.locator('.main20-ideology-read');
      const cards = page.locator('.main20-choice-card');
      if (await next.count()) await next.click(); else if (await read.count()) await read.click(); else if (await cards.count()) await cards.first().click(); else if (await newspaperRead.count()) await newspaperRead.click(); else throw new Error(`${current.phase} dead end`);
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
        const hint = (await cards.nth(i).locator('.main20-choice-hint').innerText()).trim();
        if (hint.length < 20) failures.push(`${current.phase}/${i}: immediate direction subcopy is too short: ${JSON.stringify(hint)} (${JSON.stringify(copy)})`);
      }
      await cards.first().click();
    } else if (current.phase === 'reaction' || current.phase === 'final_reaction') {
      await advanceButton(page);
    } else if (current.phase === 'branch_hub') {
      const newspaper = page.getByRole('button', { name: '신문에서 읽고 선택지를 연다', exact: true });
      if (await newspaper.count()) {
        const before = await page.locator('#paperColumns').innerText();
        if (!before.trim()) throw new Error(`branch ${current.branchHubIndex} newspaper is empty before reading`);
        await newspaper.click();
      } else {
        const cards = page.locator('#choiceArea .main20-choice-card');
        if (await cards.count() !== 3) throw new Error(`branch ${current.branchHubIndex} does not show its three options`);
        for (let i = 0; i < await cards.count(); i += 1) {
          const copy = await cards.nth(i).innerText();
          if (!copy.includes('·')) failures.push(`branch ${current.branchHubIndex}/${i}: immediate direction subcopy missing`);
        }
        await cards.first().click();
      }
    } else if (current.phase === 'branch_event') {
      await advanceButton(page);
    } else if (current.phase === 'branch_callback') {
      await advanceButton(page);
    } else if (current.phase === 'legacy_recovery') {
      throw new Error(`legacy recovery reached during V42 route: ${JSON.stringify({ trace: trace.slice(-12), lastHistory: current.history.slice(-4) })}`);
    } else {
      throw new Error(`unknown phase ${current.phase}`);
    }
    const after = await state(page);
    if (after?.sceneIndex !== undefined && !seen.includes(after.sceneIndex)) seen.push(after.sceneIndex);
    const viewportCheck = await page.evaluate(() => { const rect = (selector) => { const node = document.querySelector(selector); if (!node) return null; const box = node.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, left: box.left, right: box.right }; }; return { width: innerWidth, height: innerHeight, pageWidth: document.documentElement.scrollWidth, desk: rect('.desk'), dialogue: rect('.dialogue-strip') }; });
    if (viewportCheck.pageWidth > viewportCheck.width || !viewportCheck.desk || viewportCheck.desk.top < 0 || viewportCheck.desk.bottom > viewportCheck.height + 1 || !viewportCheck.dialogue || viewportCheck.dialogue.top < 0 || viewportCheck.dialogue.bottom > viewportCheck.height + 1) throw new Error(`game UI overflows the viewport after ${after?.phase}: ${JSON.stringify(viewportCheck)}`);
  }
  const final = await state(page);
  if (final?.phase !== 'ending') failures.push(`route did not reach a real ending: ${final?.phase}`);
  const branchEndingAudit = await page.evaluate(() => {
    const vectors = window.__main20.enumerateRouteVectors();
    const graph = window.__main20.getBranchGraph();
    const outcomes = vectors.map(({ choiceIds }) => {
      const history = choiceIds.map((choiceId, index) => ({ sceneId: graph.hubs[index].id, action: choiceId, choiceKind: 'ACTION', flags: [], endingAffinity: graph.choiceEndingAffinity[choiceId] }));
      const detail = window.__main20.resolveEndingDetailedFor({ history, relationships: { alexei: 0, ekaterina: 0, pavel: 0 }, flags: [], ideology: {}, ideologyEvidence: [], visibleCallbacks: [] });
      return { choiceIds, endingId: detail.endingId, unresolved: detail.unresolvedSemanticTie, scores: detail.scores };
    });
    return { vectorCount: outcomes.length, distinctEndingCount: new Set(outcomes.map(item => item.endingId).filter(Boolean)).size, unresolvedCount: outcomes.filter(item => item.unresolved).length, samples: outcomes.filter(item => item.endingId).slice(0, 12) };
  });
  if (branchEndingAudit.vectorCount !== 81 || branchEndingAudit.distinctEndingCount !== 5 || branchEndingAudit.unresolvedCount) failures.push(`branch-only choices do not materially reach all five endings: ${JSON.stringify(branchEndingAudit)}`);
  const endingLayout = await page.evaluate(() => { const overlay = document.querySelector('#endingOverlay'); const card = document.querySelector('#endingOverlay .ending-card'); const dialogue = document.querySelector('.dialogue-strip'); const rect = card.getBoundingClientRect(); const overlayStyle = getComputedStyle(overlay); return { visible: !overlay.hidden, overflowY: overlayStyle.overflowY, position: overlayStyle.position, zIndex: Number(overlayStyle.zIndex), backgroundColor: overlayStyle.backgroundColor, overlayRect: (() => { const box = overlay.getBoundingClientRect(); return { top: box.top, right: box.right, bottom: box.bottom, left: box.left }; })(), dialogueDisplay: getComputedStyle(dialogue).display, overlayHeight: overlay.clientHeight, overlayScrollHeight: overlay.scrollHeight, cardTop: rect.top, cardBottom: rect.bottom, viewportHeight: innerHeight, viewportWidth: innerWidth, restartVisible: document.querySelector('#endingOverlay #restart')?.getBoundingClientRect().height > 0 }; });
  const rgba = endingLayout.backgroundColor.match(/rgba?\([^)]*[,\s/]\s*([\d.]+)\s*\)$/);
  const overlayAlpha = endingLayout.backgroundColor.startsWith('rgba') && rgba ? Number(rgba[1]) : 1;
  if (endingLayout.dialogueDisplay !== 'none') throw new Error(`ending still shows dialogue rail: ${JSON.stringify(endingLayout)}`);
  if (endingLayout.position !== 'fixed' || endingLayout.zIndex < 100 || endingLayout.overlayRect.top > 0 || endingLayout.overlayRect.left > 0 || endingLayout.overlayRect.right < endingLayout.viewportWidth || endingLayout.overlayRect.bottom < endingLayout.viewportHeight || overlayAlpha < 1) throw new Error(`ending is not a full-screen opaque focus view: ${JSON.stringify(endingLayout)}`);
  if (!endingLayout.visible || !endingLayout.restartVisible || (endingLayout.cardBottom > endingLayout.viewportHeight && endingLayout.overflowY !== 'auto' && endingLayout.overflowY !== 'scroll')) throw new Error(`ending content is clipped or has no reachable restart control: ${JSON.stringify(endingLayout)}`);
  if ([1440, 390].includes(endingLayout.viewportWidth)) { fs.mkdirSync('artifacts/v46-ending', { recursive: true }); await page.screenshot({ path: `artifacts/v46-ending/ending-${endingLayout.viewportWidth}.png` }); }
  const endingActions = await page.locator('#endingActions').innerText();
  if (/MAIN\d+_|V42-|E07_|ACTION_/.test(endingActions)) throw new Error(`ending recap exposes internal action IDs: ${endingActions}`);
  const modalSemantics = await page.locator('#endingOverlay').evaluate((node) => ({ role: node.getAttribute('role'), modal: node.getAttribute('aria-modal'), appInert: document.querySelector('main')?.inert }));
  if (modalSemantics.role !== 'dialog' || modalSemantics.modal !== 'true' || !modalSemantics.appInert) throw new Error(`ending is not isolated as an accessible modal: ${JSON.stringify(modalSemantics)}`);
  await page.getByRole('button', { name: '내 선택 다시 보기', exact: true }).click();
  await page.locator('#endingOverlay .ending-evidence summary').click();
  if (!(await page.locator('#endingOverlay .ending-evidence').evaluate((node) => node.open))) throw new Error('ending evidence disclosure did not open');
  const replay = page.getByRole('button', { name: '처음부터 다시 읽는다', exact: true });
  if (!(await replay.count())) throw new Error('ending has no playable restart action');
  await replay.click();
  if ((await state(page))?.phase !== 'onboarding') throw new Error('ending restart did not return to onboarding');
  if (await page.locator('main').evaluate((node) => node.inert)) throw new Error('ending restart left the main game inert');
  return { final, text: await visibleText(page), prologueText, seen, guard, branchEndingAudit };
}

const report = { status: false, viewports: {} };
const viewports = [{ name: 'screenshot-size', width: 1996, height: 1248 }, { name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }, { name: 'compact-mobile', width: 360, height: 640 }];
for (const viewport of process.env.V42_QUICK === '1' ? [viewports[0]] : viewports) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  try {
    const result = await play(page);
    const bodyWidth = await page.evaluate(() => ({ body: document.body.scrollWidth, viewport: window.innerWidth, walk: document.querySelector('#walkBtn')?.hidden }));
    if (bodyWidth.body > bodyWidth.viewport + 1) failures.push(`${viewport.name}: horizontal overflow ${bodyWidth.body}/${bodyWidth.viewport}`);
    if (bodyWidth.walk === false) failures.push(`${viewport.name}: legacy walk button visible`);
    for (const phrase of ['표트르 대제 이후', '관등표', '10등관', '정교회', '전제정', '민족성', '차다예프', '유럽']) if (!result.prologueText.includes(phrase)) failures.push(`${viewport.name}: missing prologue comprehension phrase ${phrase}`);
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
