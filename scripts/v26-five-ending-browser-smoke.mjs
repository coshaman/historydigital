import { chromium } from 'playwright';

const targets = {
  UVAROV: [],
  KHOMYAKOV: ['slavophile_affinity'],
  BELINSKY: ['press_freedom', 'legalism'],
  HERZEN: ['press_freedom', 'westernism'],
  DOSTOEVSKY_PETRASHEVSKY: ['risk_tolerance', 'social_reform']
};
const endingIds = Object.keys(targets);
const uvarovPlan = {
  C01: 'press_freedom', C02: 'legalism', C03: 'press_freedom', C04: 'press_freedom',
  C05: 'westernism', C06: null, C07: null, C08: 'slavophile_affinity', C11: null,
  C09: 'press_freedom', C10: 'social_reform', C12: 'social_reform', C13: 'risk_tolerance',
  C14: 'press_freedom', C15: 'press_freedom', C16: 'press_freedom', C17: 'press_freedom',
  C18: 'slavophile_affinity', C19: null, C20: null, C21: 'social_reform', C22: 'press_freedom', C23: 'social_reform', C24: 'risk_tolerance'
};
const routePlans = {
  UVAROV: uvarovPlan,
  KHOMYAKOV: {
    C01:'press_freedom', C02:'legalism', C03:'press_freedom', C04:'press_freedom', C05:'slavophile_affinity', C06:null, C07:null, C08:'slavophile_affinity', C09:'press_freedom', C10:'social_reform', C11:null, C12:'social_reform', C13:'risk_tolerance', C14:'press_freedom', C15:'press_freedom', C16:'press_freedom', C17:'press_freedom', C18:'slavophile_affinity', C19:null, C20:null, C21:'social_reform', C22:'press_freedom', C23:'social_reform', C24:'risk_tolerance'
  },
  BELINSKY: {
    C01:'press_freedom', C02:'legalism', C03:'press_freedom', C04:'press_freedom', C05:'westernism', C06:null, C07:null, C08:'slavophile_affinity', C09:'press_freedom', C10:'social_reform', C11:null, C12:'social_reform', C13:'risk_tolerance', C14:'press_freedom', C15:'press_freedom', C16:'press_freedom', C17:'legalism', C18:'slavophile_affinity', C19:null, C20:null, C21:'press_freedom', C22:'press_freedom', C23:'social_reform', C24:'risk_tolerance'
  },
  HERZEN: {
    C01:'press_freedom', C02:'legalism', C03:'press_freedom', C04:'press_freedom', C05:'westernism', C06:null, C07:null, C08:'slavophile_affinity', C09:'press_freedom', C10:'social_reform', C11:null, C12:'social_reform', C13:'risk_tolerance', C14:'press_freedom', C15:'press_freedom', C16:'press_freedom', C17:'legalism', C18:'westernism', C19:null, C20:null, C21:'press_freedom', C22:'press_freedom', C23:'social_reform', C24:'risk_tolerance'
  },
  DOSTOEVSKY_PETRASHEVSKY: {
    C01:'press_freedom', C02:'legalism', C03:'press_freedom', C04:'press_freedom', C05:'westernism', C06:null, C07:null, C08:'slavophile_affinity', C09:'press_freedom', C10:'social_reform', C11:null, C12:'risk_tolerance', C13:'risk_tolerance', C14:'press_freedom', C15:'press_freedom', C16:'press_freedom', C17:'legalism', C18:'slavophile_affinity', C19:null, C20:null, C21:'social_reform', C22:'social_reform', C23:'risk_tolerance', C24:'risk_tolerance'
  }
};
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
const evidence = [];

function chooseIndex(endingId, caseId, judgments, targetSignals, counts) {
  if (Object.hasOwn(routePlans[endingId] || {}, caseId)) {
    const planned = routePlans[endingId][caseId];
    const plannedIndex = judgments.findIndex(judgment => (judgment.routeSignal || null) === planned);
    if (plannedIndex >= 0) return plannedIndex;
  }
  const scored = judgments.map((judgment, index) => {
    const signal = judgment.routeSignal || null;
    const targetRank = targetSignals.indexOf(signal);
    if (targetRank >= 0) return { index, score: 100 - targetRank * 10 };
    if (signal === null) return { index, score: 80 };
    const competing = signal === 'slavophile_affinity' ? 20 : 10;
    return { index, score: competing - (counts[signal] || 0) };
  });
  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored[0].index;
}

await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV26Manifest), null, { timeout: 10000 });
const manifest = await page.evaluate(() => window.__goldRuntime.getV26Manifest());
const readyCases = manifest.cases.filter(item => !String(item.sourceStatus || '').startsWith('BLOCKED_'));
if (readyCases.length !== 24) throw new Error(`expected 24 READY cases, got ${readyCases.length}`);

for (const endingId of endingIds) {
  await page.evaluate(() => localStorage.removeItem('chancery-gold-runtime-v1'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV26Manifest), null, { timeout: 10000 });
  await page.locator('#ledgerObject').click();
  await page.locator('[data-ledger-scene="C01"]').last().click({ force: true });
  const counts = {};
  for (const data of readyCases) {
    await page.locator('.v25-pilot-excerpt-head').first().waitFor({ state: 'visible', timeout: 10000 });
    const excerptCount = await page.locator('.v25-pilot-excerpt-head').count();
    if (excerptCount !== 5) throw new Error(`${data.caseId} excerpt count ${excerptCount}`);
    for (let i = 0; i < excerptCount; i++) await page.locator('.v25-pilot-excerpt-head').nth(i).click({ force: true });
    await page.getByText('다섯 발췌를 읽고 처리 단계로 이동').click({ force: true });
    await page.locator('#choiceArea button').first().click({ force: true });
    const choiceIndex = chooseIndex(endingId, data.caseId, data.judgments, targets[endingId], counts);
    await page.locator('#choiceArea button').nth(choiceIndex).click({ force: true });
    const chosenSignal = data.judgments[choiceIndex].routeSignal || null;
    if (chosenSignal) counts[chosenSignal] = (counts[chosenSignal] || 0) + 1;
    await page.locator('#choiceArea button').first().click({ force: true });
  }
  await page.locator('#endingOverlay').waitFor({ state: 'visible', timeout: 10000 });
  const result = await page.evaluate(() => {
    const state = window.__goldRuntime.getState();
    return { endingId: state.v26.endingId, completedCaseCount: state.v26.completedCaseIds.length, routeSignals: state.v26.routeSignals };
  });
  if (result.endingId !== endingId) throw new Error(`${endingId} route resolved to ${result.endingId}`);
  if (result.completedCaseCount !== 24) throw new Error(`${endingId} completed ${result.completedCaseCount} cases`);
  const screenshot = `docs/v26/v26-ending-${endingId.toLowerCase()}.png`;
  await page.screenshot({ path: screenshot, fullPage: true });
  evidence.push({ endingId, ...result, screenshot });
}

await browser.close();
if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
console.log(JSON.stringify({ status: 'PASS', readyCaseCount: readyCases.length, evidence }, null, 2));
