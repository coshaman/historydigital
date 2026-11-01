import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs/v34/screenshots');
const origin = process.env.V34_ORIGIN || 'http://127.0.0.1:4188/';
await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
const failures = [];
const check = (condition, label, evidence = '') => { results.push({ label, passed: Boolean(condition), evidence }); if (!condition) failures.push(label); };

async function freshPage(width, height, offline = true) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: width < 760, hasTouch: width < 760 });
  const page = await context.newPage();
  await page.addInitScript(() => { if (!sessionStorage.getItem('v34-fresh-context')) { localStorage.removeItem('v33-rpg-save'); localStorage.removeItem('v34-tutorial-stage'); sessionStorage.setItem('v34-fresh-context','1'); } });
  if (offline) await page.route('**/api/rpg/**', route => route.abort());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) errors.push(message.text()); });
  await page.goto(origin); await page.locator('#mission-tracker').waitFor({state:'visible',timeout:5000}); await page.waitForTimeout(250);
  return { context, page, errors };
}

async function journalCheck(page, tag) {
  await page.locator('#journal-open').click();
  check(await page.locator('#quest-journal').evaluate(element => element.open), `${tag} journal opens`);
  for (const tab of ['goal','inventory','people','sources','history']) {
    await page.locator(`[data-journal-tab="${tab}"]`).click();
    check(await page.locator(`[data-journal-panel="${tab}"]`).isVisible(), `${tag} journal ${tab} tab`);
  }
  await page.screenshot({ path: path.join(outDir, `journal-${tag}.png`) });
  await page.keyboard.press('Escape');
  check(!(await page.locator('#quest-journal').evaluate(element => element.open)), `${tag} Esc closes journal`);
}

for (const [width, height] of [[360,800],[390,844],[1366,768],[1440,900],[683,384]]) {
  const tag = `${width}x${height}`;
  const { context, page, errors } = await freshPage(width, height);
  const box = await page.locator('#mission-action').boundingBox();
  const font = await page.locator('#mission-action').evaluate(element => Number.parseFloat(getComputedStyle(element).fontSize));
  const overflow = await page.locator('body').evaluate(element => ({ scroll: element.scrollWidth, client: element.clientWidth }));
  check(Boolean(box) && await page.locator('#mission-tracker').isVisible(), `${tag} tracker visible`);
  check(font >= 16, `${tag} objective is at least 16px`, `${font}px`);
  check(overflow.scroll <= overflow.client, `${tag} no horizontal page overflow`, JSON.stringify(overflow));
  await page.screenshot({ path: path.join(outDir, `start-${tag}.png`) });
  await journalCheck(page, tag);
  await page.locator('#mission-pin').click();
  check(await page.locator('#mission-pin').getAttribute('aria-pressed') === 'true', `${tag} pin control works`);
  await page.waitForTimeout(100);
  if (width === 360 || width === 390 || width === 1366 || width === 1440) await page.screenshot({ path: path.join(outDir, `pinned-${tag}.png`) });
  if (width === 683) {
    const vertical = await page.evaluate(() => ({ scroll: document.scrollingElement.scrollHeight, client: document.scrollingElement.clientHeight }));
    check(vertical.scroll > vertical.client, 'short-height layout exposes vertical page scrolling', JSON.stringify(vertical));
    await page.locator('#mission-method').scrollIntoViewIfNeeded();
    const methodBox = await page.locator('#mission-method').boundingBox();
    check(Boolean(methodBox) && methodBox.y >= 0 && methodBox.y + methodBox.height <= height, 'short-height goal instructions are reachable without a clipped inner panel', JSON.stringify(methodBox));
    await page.screenshot({ path: path.join(outDir, 'short-height-objective-683x384.png') });
    await page.evaluate(() => window.scrollTo(0,0));
  }
  check(errors.length === 0, `${tag} console/page errors`, errors.join(' | '));
  await context.close();
}

async function obtainPavel(page) {
  for (let i=0;i<4;i++){ await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(75); }
  for (let i=0;i<2;i++){ await page.keyboard.press('ArrowUp'); await page.waitForTimeout(75); }
  await page.keyboard.press('e');
  let possess = page.getByRole('button',{name:/몸을 빌린다/});
  if (!(await possess.count())) {
    const candidate = page.locator('#actions button').first();
    if (await candidate.count()) await candidate.click();
    possess = page.getByRole('button',{name:/몸을 빌린다/});
  }
  check(await possess.count() > 0, 'walk to a visible person and inspect');
  await possess.first().click(); await page.waitForTimeout(120);
  check((await page.locator('#bodyname').innerText()).includes('파벨'), 'possess the person reached by movement');
}

async function followVisibleDirections(page) {
  const directions = await page.locator('#mission-method').innerText();
  const steps = [...directions.matchAll(/(왼쪽|오른쪽|위|아래)\s+(\d+)칸/g)];
  check(steps.length > 0, 'objective provides a concrete walk path', directions);
  const controls = { '왼쪽':'left', '오른쪽':'right', '위':'up', '아래':'down' };
  for (const [, korean, count] of steps) {
    for (let i = 0; i < Number(count); i++) {
      await page.locator(`[data-move="${controls[korean]}"]`).click();
      await page.waitForTimeout(45);
    }
  }
  await page.keyboard.press('e');
  await page.waitForTimeout(80);
  const possess = page.getByRole('button',{name:/몸을 빌린다/});
  check(await possess.count() > 0, 'following the displayed route reaches a person interaction', await page.locator('#actions').innerText());
  if (await possess.count()) await possess.first().click();
  await page.waitForTimeout(100);
}

const guidedStart = await freshPage(1366,768,true);
check((await guidedStart.page.locator('#mission-action').innerText()).includes('안나'), 'first objective selects the nearby quest-eligible host');
await followVisibleDirections(guidedStart.page);
check((await guidedStart.page.locator('#bodyname').innerText()).includes('안나'), 'collision-aware directions lead to the named first host', await guidedStart.page.locator('#bodyname').innerText());
check(guidedStart.errors.length === 0, 'guided first-host journey has no console/page errors', guidedStart.errors.join(' | '));
await guidedStart.page.screenshot({path:path.join(outDir,'guided-first-host-1366x768.png')});
await guidedStart.context.close();

const core = await freshPage(1366,768,true);
await obtainPavel(core.page);
check((await core.page.locator('#mission-identity').innerText()).includes('파벨'), 'current identity updates immediately after possession');
check((await core.page.locator('#mission-action').innerText()).includes('안나'), 'wrong-host objective directs to a permitted host');
await core.page.locator('#mission-pin').click();
await core.page.screenshot({ path: path.join(outDir,'possessed-pavel-1366x768.png') });
await journalCheck(core.page,'possessed-pavel-1366x768');
for(let i=0;i<2;i++){await core.page.locator('[data-move="left"]').click();await core.page.waitForTimeout(70)}
for(let i=0;i<2;i++){await core.page.locator('[data-move="up"]').click();await core.page.waitForTimeout(70)}
check(!(await core.page.locator('#talk').isDisabled()), 'nearby person becomes talk target');
await core.page.locator('#talk').click();
check(await core.page.locator('.dialogue-input').isVisible(), 'offline conversation always shows typed input');
check((await core.page.locator('#record').innerText()).includes('오프라인'), 'offline state is stated plainly');
await core.page.locator('.dialogue-input input').fill('오늘 일은 많으세요?');
check((await core.page.locator('.dialogue-char-count').innerText()).startsWith('10 /') || (await core.page.locator('.dialogue-char-count').innerText()).startsWith('11 /'), 'typed input character count updates', await core.page.locator('.dialogue-char-count').innerText());
await core.page.locator('.dialogue-input input').press('Enter'); await core.page.waitForTimeout(160);
check((await core.page.locator('#journal-text').innerText()).includes('수선은 끝냈어요'), 'offline free text receives a deterministic host-grounded reply', await core.page.locator('#journal-text').innerText());
check((await core.page.locator('#dialogue-history-lines').textContent()).includes('오늘 일은 많으세요?'), 'player utterance and NPC reply are retained in separate transcript');
await core.page.locator('#dialogue-history summary').click();
await core.page.screenshot({ path: path.join(outDir,'offline-dialogue-1366x768.png') });
const authoredChoice = core.page.locator('#actions button').filter({ hasNot: core.page.locator('.dialogue-input') }).first();
check(await authoredChoice.count() > 0, 'authored response remains available beside the input');
await authoredChoice.click(); await core.page.waitForTimeout(100);
check((await core.page.locator('#dialogue-history-lines').textContent()).includes('수선값'), 'authored reply adds a separate transcript turn');
await core.page.keyboard.press('Escape');
check(await core.page.locator('.dialogue-input').count() === 0, 'Escape closes conversation');
await core.page.locator('#save').click(); const savedGoal = await core.page.locator('#mission-action').innerText();
await core.page.reload(); await core.page.locator('#mission-tracker').waitFor({state:'visible',timeout:5000}); await core.page.waitForTimeout(100);
check((await core.page.locator('#bodyname').innerText()).includes('파벨'), 'save reload restores possessed body', await core.page.locator('#bodyname').innerText());
check((await core.page.locator('#mission-action').innerText()) === savedGoal, 'save reload recalculates identical objective', `${savedGoal} <> ${await core.page.locator('#mission-action').innerText()}`);
check(core.errors.length === 0, 'offline core journey has no console/page errors', core.errors.join(' | '));
await core.context.close();

const scenes = JSON.parse(await fs.readFile(path.join(root,'rpg/ai/scenes.json'),'utf8')).sessions;
const online = await freshPage(1366,768,false);
const requests = []; let dialogueCall = 0, mockHostId = null;
await online.page.route('**/api/rpg/session/start', route => { mockHostId=route.request().postDataJSON().hostId; return route.fulfill({ status: 201, contentType:'application/json', body: JSON.stringify({sessionToken:'mock-token-only',mode:'AI'}) }); });
await online.page.route('**/api/rpg/dialogue', async route => {
  const request = route.request().postDataJSON(); requests.push(request); dialogueCall++;
  if(dialogueCall===2){await route.fulfill({status:429,contentType:'application/json',body:JSON.stringify({error:'session_rate_limit'})});return;}
  if(dialogueCall===3){await route.abort('timedout');return;}
  const line = mockHostId === 'seamstress_anna' ? '수선은 끝났어요. 오늘은 값을 받아야 해요.' : '오늘은 이 봉투를 먼저 전하고 쉬려고요.';
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({sessionToken:'mock-token-only',fallback:false,mode:'AI',turn:{sceneId:scenes[mockHostId].sceneId,beats:[{speakerId:mockHostId,textKo:line,emotion:'focused'}],suggestedReplies:[{textKo:'어디로 가는 길이에요?'},{textKo:'오늘 일은 어때요?' }]}})});
});
await obtainPavel(online.page);
for(let i=0;i<2;i++){await online.page.locator('[data-move="left"]').click();await online.page.waitForTimeout(50)}
for(let i=0;i<2;i++){await online.page.locator('[data-move="up"]').click();await online.page.waitForTimeout(50)}
await online.page.locator('#talk').click();await online.page.waitForTimeout(40);
await online.page.locator('.dialogue-input input').fill('오늘은 어디로 가세요?');await online.page.locator('.dialogue-input input').press('Enter');await online.page.waitForTimeout(160);
check((await online.page.locator('#journal-text').innerText()).includes(mockHostId === 'seamstress_anna' ? '수선은 끝났어요' : '봉투를 먼저 전하고'), 'mock online dialogue displays validated current NPC turn', `${mockHostId}: ${await online.page.locator('#journal-text').innerText()}`);
check(requests[0]?.sceneContext?.mapId === 'nevsky' && requests[0]?.sceneContext?.date === '1847-06-01', 'mock request includes current map/date scene context', JSON.stringify(requests[0]?.sceneContext));
await online.page.locator('.dialogue-input input').fill('이번 주에 쉬는 날도 있어요?');await online.page.locator('.dialogue-input input').press('Enter');await online.page.waitForTimeout(140);
check((await online.page.locator('#record').innerText()).includes('한도') || (await online.page.locator('#record').innerText()).includes('오프라인'), '429 response returns to clear authored fallback');
await online.page.locator('.dialogue-input input').fill('봉투가 젖으면 어떻게 해요?');await online.page.locator('.dialogue-input input').press('Enter');await online.page.waitForTimeout(200);
check((await online.page.locator('#record').innerText()).includes('오프라인'), 'aborted provider request falls back without trapping the scene');
check(online.errors.length===0,'mock API journey has no console/page errors',online.errors.join(' | '));
await online.page.screenshot({path:path.join(outDir,'mock-online-and-fallback-1366x768.png')});
await online.context.close();

await fs.writeFile(path.join(root,'docs/v34/browser-evidence.json'),JSON.stringify({origin,generatedAt:new Date().toISOString(),results,failures},null,2));
await browser.close();
console.log(JSON.stringify({checks:results.length,passed:results.filter(item=>item.passed).length,failures,output:outDir},null,2));
if(failures.length)process.exitCode=1;
