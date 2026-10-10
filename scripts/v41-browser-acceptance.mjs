import fs from 'node:fs';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4173/?main20=1#v41-browser';
const sceneIds = ['C03', 'C06', 'C07', 'E02', 'E07'];
const canonicalRoutes = {
  UVAROV: { C03: [0, 0], C06: [0, 0], C07: [0, 0], E02: [1, 1], E07: [1, 1] },
  BELINSKY: { C03: [1, 1], C06: [1, 1], C07: [1, 1], E02: [0, 0], E07: [0, 0] },
  HERZEN: { C03: [2, 2], C06: [2, 2], C07: [2, 2], E02: [2, 2], E07: [2, 2] },
  KHOMYAKOV: { C03: [1, 1], C06: [1, 1], C07: [2, 2], E02: [1, 1], E07: [3, 3] },
  DOSTOEVSKY_PETRASHEVSKY: { C03: [2, 2], C06: [2, 2], C07: [1, 1], E02: [0, 2], E07: [0, 0] }
};

const failures = [];
const browser = await chromium.launch({ headless: true });

async function state(page) {
  return page.evaluate(() => window.__main20?.getState());
}

async function clickChoiceArea(page, name = null) {
  const buttons = page.locator('#choiceArea button');
  if (name) await page.getByRole('button', { name }).click();
  else await buttons.first().click();
}

async function assertInteractive(page, label) {
  const current = await state(page);
  const cards = await page.locator('.main20-choice-card').count();
  const reads = await page.locator('.main20-read-mark').count();
  const actions = await page.locator('#choiceArea button').count();
  const ending = await page.locator('#endingOverlay').isVisible();
  if (!ending && cards === 0 && reads === 0 && actions === 0) failures.push(`${label}: dead-end phase ${current?.phase}`);
  if (await page.locator('#walkBtn').isVisible()) failures.push(`${label}: legacy walk button visible`);
  if (await page.locator('#walkOverlay').isVisible()) failures.push(`${label}: legacy walk overlay visible`);
}

async function readCurrentScene(page) {
  const marks = page.locator('.main20-read-mark');
  const count = await marks.count();
  for (let index = 0; index < count; index += 1) await marks.nth(index).click();
  await page.getByRole('button', { name: '자료 토론으로 간다' }).click();
}

async function playRoute(page, route, label) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__main20?.getState));
  const seenScenes = [];
  const selectedCopy = [];
  let guard = 0;
  while (guard < 240) {
    guard += 1;
    const current = await state(page);
    if (!current) throw new Error(`${label}: MAIN20 runtime did not initialize`);
    if (process.env.V41_DEBUG) console.log(`${label} step=${guard} scene=${sceneIds[current.sceneIndex]} phase=${current.phase}`);
    const sceneId = sceneIds[current.sceneIndex];
    if (!seenScenes.includes(sceneId)) seenScenes.push(sceneId);
    if (current.phase === 'ending') break;
    if (current.phase === 'reading') {
      await readCurrentScene(page);
    } else if (current.phase === 'decision') {
      const index = route[sceneId][0];
      const cards = page.locator('.main20-choice-card');
      const count = await cards.count();
      if (count !== (sceneId === 'E07' ? 4 : 3)) throw new Error(`${label}/${sceneId}: expected primary choice count, got ${count}`);
      for (let i = 0; i < count; i += 1) {
        if (await cards.nth(i).getAttribute('title')) failures.push(`${label}/${sceneId}: choice ${i} still depends on title`);
        selectedCopy.push(await cards.nth(i).innerText());
      }
      await cards.nth(index).click();
    } else if (current.phase === 'post_choice') {
      const index = route[sceneId][1];
      const cards = page.locator('.main20-choice-card');
      const count = await cards.count();
      if (count !== (sceneId === 'E07' ? 4 : 3)) throw new Error(`${label}/${sceneId}: expected post choice count, got ${count}`);
      for (let i = 0; i < count; i += 1) {
        if (await cards.nth(i).getAttribute('title')) failures.push(`${label}/${sceneId}: post-choice ${i} still depends on title`);
        selectedCopy.push(await cards.nth(i).innerText());
      }
      await cards.nth(index).click();
    } else {
      await assertInteractive(page, `${label}/${sceneId}/${current.phase}`);
      await clickChoiceArea(page);
    }
    await page.waitForTimeout(20);
  }
  const final = await state(page);
  if (final?.phase !== 'ending') throw new Error(`${label}: did not reach ending after ${guard} steps; phase=${final?.phase}`);
  if (JSON.stringify(seenScenes.slice(0, 5)) !== JSON.stringify(sceneIds)) failures.push(`${label}: route was ${seenScenes.join(' -> ')}`);
  const title = await page.locator('#endingTitle').innerText();
  if (!title.startsWith('당신의 선택은 ')) failures.push(`${label}: ending title is not historical-person-first: ${title}`);
  for (const text of ['실제로 어떻게 살았나', '당신이라면', '왜 이 결과인가', '이 결말의 근거']) if (!(await page.locator('#endingOverlay').innerText()).includes(text)) failures.push(`${label}: missing ending section ${text}`);
  if (!(await page.locator('#endingDocumented').innerText()).trim()) failures.push(`${label}: missing historical life`);
  if (!(await page.locator('#endingFuture').innerText()).trim()) failures.push(`${label}: missing fictional future life`);
  if (await page.locator('#paperTitle').innerText() === 'Насильный брак' && !seenScenes.includes('E02')) failures.push(`${label}: early legacy E02 appeared`);
  return { scenes: seenScenes, endingTitle: title, selectedCopyCount: selectedCopy.length, state: final };
}

async function renderEndingFromCanonicalState(page, route, label) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__main20?.data));
  const expected = await page.evaluate((canonical) => {
    const data = window.__main20.data;
    const history = [];
    const flags = [];
    const relationships = { alexei: 0, ekaterina: 0, pavel: 0 };
    for (const scene of data.scenes) {
      const [primaryIndex, postIndex] = canonical[scene.id];
      for (const [kind, choice] of [['pre_read_choice', scene.choices[primaryIndex]], ['post_read_choice', scene.postChoices[postIndex]]]) {
        history.push({ sceneId: scene.id, kind, action: choice.action, flags: choice.flagsAdd || [], endingAffinity: choice.endingAffinity || {}, actor: choice.actor, witnesses: choice.witnesses, visibility: choice.visibility });
        flags.push(...(choice.flagsAdd || []));
        for (const [person, amount] of Object.entries(choice.relationship || {})) relationships[person] += amount;
      }
    }
    const source = { history, flags: [...new Set(flags)], relationships };
    const detail = window.__main20.resolveEndingDetailedFor(source);
    localStorage.clear();
    localStorage.setItem('chancery-main20-v35', JSON.stringify({ schemaVersion: data.schemaVersion, sceneIndex: data.scenes.length - 1, phase: 'ending', endingId: detail.endingId, endingResolution: detail, history: source.history, flags: source.flags, relationships: source.relationships, readExcerptIdsByScene: {}, readEventsByScene: {}, readingScrollByScene: {}, windowView: 'closed' }));
    return detail.endingId;
  }, route);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__main20?.getState?.().phase === 'ending');
  const title = await page.locator('#endingTitle').innerText();
  const overlay = await page.locator('#endingOverlay').innerText();
  if (!title.startsWith('당신의 선택은 ')) failures.push(`${label}: historical-person-first ending title missing`);
  if (!overlay.includes('실제로 어떻게 살았나') || !overlay.includes('당신이라면')) failures.push(`${label}: life sections missing`);
  if (!(await page.locator('#endingDocumented').innerText()).trim() || !(await page.locator('#endingFuture').innerText()).trim()) failures.push(`${label}: ending content missing`);
  return { endingId: expected, endingTitle: title };
}

const report = { schemaVersion: 'V41-BROWSER-ACCEPTANCE-1', viewports: {}, endings: {} };
const viewportRuns = await Promise.all([{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }].filter((viewport) => !process.env.V41_ONLY || process.env.V41_ONLY === viewport.name).map(async (viewport) => {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
  const result = await playRoute(page, canonicalRoutes.HERZEN, viewport.name);
  await page.close();
  return [viewport.name, result];
}));
for (const [name, result] of viewportRuns) report.viewports[name] = result;
const endingRuns = await Promise.all(Object.entries(canonicalRoutes).filter(([endingId]) => !process.env.V41_ONLY || process.env.V41_ONLY === endingId).map(async ([endingId, route]) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const result = await renderEndingFromCanonicalState(page, route, `ending/${endingId}`);
  await page.close();
  return [endingId, result];
}));
for (const [endingId, result] of endingRuns) report.endings[endingId] = result;
await browser.close();
report.status = failures.length === 0;
report.failures = failures;
fs.mkdirSync('artifacts/v41-browser', { recursive: true });
fs.writeFileSync('artifacts/v41-browser/report.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, viewports: Object.keys(report.viewports), endings: Object.fromEntries(Object.entries(report.endings).map(([id, value]) => [id, value.endingTitle])), failures }, null, 2));
if (!report.status) process.exit(1);
