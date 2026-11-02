import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const root = process.cwd();
const require = createRequire(import.meta.url);
require('../rpg/engine/game-state.js');
const { createInitialState, saveGame } = globalThis.V33GameState;
const json = file => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const maps = Object.fromEntries(readdirSync(path.join(root, 'rpg/maps')).filter(file => file.endsWith('.json')).map(file => [file.slice(0, -5), json(`rpg/maps/${file}`)]));
const cards = readdirSync(path.join(root, 'rpg/characters')).filter(file => file.endsWith('.json')).map(file => json(`rpg/characters/${file}`));
const quests = ['printshop-article', 'public-discourse-1848', 'circle-investigation-1849', 'circle-letter-1849-may', 'literary-dead-souls', 'literary-overcoat'].map(id => json(`rpg/quests/${id}.json`));
const portProbe = createServer();
await new Promise((resolve, reject) => { portProbe.once('error', reject); portProbe.listen(0, '127.0.0.1', resolve); });
const port = portProbe.address().port;
await new Promise((resolve, reject) => portProbe.close(error => error ? reject(error) : resolve()));
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, CHANCERY_PORT: String(port), CHANCERY_STATIC_ROOT: path.join(root, 'dist-v33') }, stdio: 'ignore', windowsHide: true });
const base = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const report = { status: 'FAIL', completed: [], errors: [] };
function seeded({ mapId, hostId, position, date = '1847-06-01', setup = () => {} }) {
  const state = createInitialState({ maps, hostCards: cards, quests, startMapId: mapId });
  state.world.currentMapId = mapId;
  state.world.date = date;
  state.player.embodiment = hostId;
  state.player.position = { ...position };
  state.hosts[hostId].mapId = mapId;
  state.hosts[hostId].position = { ...position };
  setup(state);
  return saveGame(state);
}
async function openWith(save) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 820 } });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(value => { localStorage.clear(); localStorage.setItem('v33-rpg-save', value); localStorage.setItem('v33-tutorial-stage', 'done'); }, save);
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('#world').waitFor();
  return { page, context };
}
async function readState(page) { return page.evaluate(() => JSON.parse(localStorage.getItem('v33-rpg-save')).state); }
try {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try { if ((await fetch(base)).ok) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
    if (attempt === 39) throw new Error('Local game server failed to start');
  }

  {
    const { page, context } = await openWith(seeded({ mapId: 'nevsky', hostId: 'clerk_alexei', position: { x: 24, y: 15 } }));
    await page.keyboard.press('e');
    await page.getByRole('button', { name: /신문용 종이 한 묶음/ }).click();
    await page.locator('#save').click();
    let state = await readState(page);
    if (!state.hosts.clerk_alexei.inventory.includes('newsprint_sheet') || state.hosts.clerk_alexei.money.amount >= cards.find(card => card.id === 'clerk_alexei').money.amount) throw new Error('In-world newspaper purchase did not update inventory and funds');
    await page.keyboard.press('e');
    await page.getByRole('button', { name: /값을 치르지 않고 가져간다/ }).click();
    await page.getByRole('heading', { name: '경찰 접수실로 연행됐다' }).waitFor();
    await page.locator('#save').click();
    state = await readState(page);
    if (!state.player.civic.custody.active || state.world.currentMapId !== 'police-station') throw new Error('Witnessed theft did not transfer the player to police custody');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('e');
    await page.getByRole('button', { name: /진술서를 쓰고 석방된다/ }).click();
    await page.locator('#save').click();
    state = await readState(page);
    if (state.player.civic.custody.active || !state.ledger.some(entry => entry.eventType === 'POLICE_RELEASE' && entry.resolution === 'give_statement')) throw new Error('Police statement/release did not resolve custody');
    report.completed.push('shop purchase, witnessed theft, police custody and statement release');
    await context.close();
  }

  {
    const { page, context } = await openWith(seeded({ mapId: 'printshop', hostId: 'editor_sofia', position: { x: 14, y: 9 }, setup(state) { state.hosts.editor_sofia.inventory.push('newsprint_sheet', 'printing_ink'); } }));
    if (!(await page.locator('#mission-title').innerText()).includes('신문')) throw new Error('Press objective did not appear in the mission tracker');
    await page.keyboard.press('e');
    await page.getByRole('button', { name: /근거 자료 읽기.*농촌의 두 사람을 그린 글/ }).click();
    await page.locator('#source-reader').waitFor({ state: 'visible' });
    if (!(await page.locator('#source-reader-ids').innerText()).includes('LIT-TURGENEV-KHOR-KALYNYCH-1847')) throw new Error('The article source was not exposed before printing');
    await page.locator('#source-reader-complete').click();
    await page.keyboard.press('e');
    await page.getByRole('button', { name: /호외 인쇄.*농촌의 두 사람을 그린 글/ }).click();
    await page.getByRole('button', { name: /새 호를 읽는다/ }).click();
    await page.getByRole('heading', { name: '농촌의 두 사람을 그린 글' }).waitFor();
    await page.locator('#save').click();
    const state = await readState(page);
    if (state.player.civic.publishedIssues.length !== 1 || !state.ledger.some(entry => entry.eventType === 'NEWSPAPER_PUBLISHED')) throw new Error('Printing did not publish a source-linked issue');
    report.completed.push('source review, newsroom objective, issue printing and reading');
    await context.close();
  }

  {
    const { page, context } = await openWith(seeded({ mapId: 'nevsky', hostId: 'reader_darya', position: { x: 21, y: 14 }, setup(state) {
      const civic = state.player.civic;
      const issue = { id: 'CITY_ISSUE_1', storyId: 'LITERARY_RURAL_LIFE_1847', titleKo: '농촌의 두 사람을 그린 글', bodyKo: '작품 속 인물의 모습과 실제 농촌 사람들의 경험을 구분해 싣습니다.', editorialKo: '확인된 문학 자료를 바탕으로 편집했습니다.', sourceId: 'LIT-TURGENEV-KHOR-KALYNYCH-1847', publishedDate: '1847-06-01', publisherHostId: 'editor_sofia' };
      civic.publishedIssues.push(issue);
      civic.circulatedIssues.push({ issueId: issue.id, route: 'street', date: '1847-06-01', hostId: 'editor_sofia' });
      state.ledger.push({ eventId: 'NEWSPAPER_CIRCULATED_1', eventType: 'NEWSPAPER_CIRCULATED', issueId: issue.id, route: 'street', hostId: 'editor_sofia', date: '1847-06-01', mapId: 'nevsky' });
    } }));
    await page.keyboard.press('e');
    await page.getByRole('button', { name: /거리 독자가 놓고 간 호 읽기.*농촌의 두 사람/ }).click();
    await page.getByRole('heading', { name: '농촌의 두 사람을 그린 글' }).waitFor();
    await page.locator('#save').click();
    const state = await readState(page);
    if (!state.hosts.reader_darya.knownEvidenceIds.includes('LIT-TURGENEV-KHOR-KALYNYCH-1847') || !state.ledger.some(entry => entry.eventType === 'NEWSPAPER_READ' && entry.hostId === 'reader_darya' && entry.publicCopy)) throw new Error('A street reader did not gain the article evidence from the shared copy');
    report.completed.push('street circulation lets a separate reader read and record the cited source');
    await context.close();
  }

  {
    const completedIssueState = state => {
      state.player.civic.publishedIssues.push(
        { id: 'CITY_ISSUE_1', storyId: 'LITERARY_RURAL_LIFE_1847', titleKo: '농촌의 두 사람을 그린 글', sourceId: 'LIT-TURGENEV-KHOR-KALYNYCH-1847', publishedDate: '1847-06-01', publisherHostId: 'editor_sofia' },
        { id: 'CITY_ISSUE_2', storyId: 'DELIVERY_NOTICE_1848', titleKo: '지방 구독자에게 늦어진 소식', sourceId: 'OBJ-WS-NEKRASOV-EDITORIAL-1848', publishedDate: '1848-01-01', publisherHostId: 'editor_sofia' },
      );
      state.player.civic.circulatedIssues.push({ issueId: 'CITY_ISSUE_1', route: 'street', hostId: 'editor_sofia' }, { issueId: 'CITY_ISSUE_2', route: 'postal', hostId: 'editor_sofia' });
      state.hosts.editor_sofia.inventory.push('newsprint_sheet', 'printing_ink');
      return state;
    };
    const { page, context } = await openWith(seeded({ mapId: 'printshop', hostId: 'editor_sofia', position: { x: 14, y: 9 }, date: '1849-04-22', setup: completedIssueState }));
    if (!(await page.locator('#mission-action').innerText()).includes('관청 접수실')) throw new Error('The 1849 newspaper mission did not guide the editor to the report location');
    await page.keyboard.press('e');
    if (!(await page.locator('#journal-text').innerText()).includes('관청 접수실')) throw new Error('Newsroom did not explain where the 1849 source must be read');
    await context.close();

    const { page: handoffPage, context: handoffContext } = await openWith(seeded({ mapId: 'printshop', hostId: 'editor_sofia', position: { x: 14, y: 9 }, date: '1849-04-22', setup(state) {
      completedIssueState(state);
      state.player.observedEvidenceIds.push('OBJ-WS-PETRASHEVSKY-REPORT-1849');
    } }));
    if (!(await handoffPage.locator('#mission-action').innerText()).includes('자료 전달')) throw new Error('The mission did not ask for a read source to be handed to the editor');
    await handoffPage.keyboard.press('e');
    await handoffPage.getByRole('button', { name: /확인한 자료 전달.*보고서에는 누가 말했는가/ }).click();
    await handoffPage.locator('#save').click();
    let state = await readState(handoffPage);
    if (!state.hosts.editor_sofia.knownEvidenceIds.includes('OBJ-WS-PETRASHEVSKY-REPORT-1849')) throw new Error('The source handoff did not update the editor’s knowledge');
    await handoffPage.keyboard.press('e');
    await handoffPage.getByRole('button', { name: /호외 인쇄.*보고서에는 누가 말했는가/ }).click();
    await handoffPage.locator('#save').click();
    state = await readState(handoffPage);
    if (!state.player.civic.publishedIssues.some(issue => issue.storyId === 'CIRCLE_REPORT_1849')) throw new Error('The 1849 report issue was not printable after a documented handoff');
    report.completed.push('1849 report source location, explicit editor handoff and final issue publication');
    await handoffContext.close();
  }
  report.status = 'PASS';
} catch (error) {
  report.errors.push(String(error?.stack ?? error));
  throw error;
} finally {
  await browser.close();
  server.kill();
  console.log(JSON.stringify(report, null, 2));
}
