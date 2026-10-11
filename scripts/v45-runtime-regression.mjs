import { chromium } from 'playwright';

const base = process.env.MAIN20_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));

try {
  await page.goto(`${base}/?main20=1&v45fresh=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__main20), null, { timeout: 12000 });
  await page.waitForFunction(() => document.body.classList.contains('main20-mode'));

  const initial = await page.evaluate(() => ({
    phase: window.__main20.getState().phase,
    paperHidden: document.querySelector('#paper')?.hidden === true,
    oldPaperTitle: document.querySelector('#paperTitle')?.textContent || '',
    restartVisible: !document.querySelector('#main20Restart')?.hidden,
    goldDisabled: window.__goldRuntime?.disabled === true,
    threeRequests: performance.getEntriesByType('resource').filter((entry) => entry.name.includes('three.module.js')).length,
  }));
  if (initial.phase !== 'onboarding') throw new Error(`expected onboarding, got ${initial.phase}`);
  if (!initial.paperHidden) throw new Error('legacy document is visible before onboarding');
  if (initial.oldPaperTitle.includes('Насильный')) throw new Error('legacy E02 flashed into the main route');
  if (!initial.restartVisible) throw new Error('main route has no visible restart control');
  if (!initial.goldDisabled) throw new Error('gold runtime still owns the main route');
  if (initial.threeRequests !== 0) throw new Error(`3D runtime loaded on the main route: ${initial.threeRequests} request(s)`);

  await page.locator('#main20Restart').click();
  const afterRestart = await page.evaluate(() => window.__main20.getState().phase);
  if (afterRestart !== 'onboarding') throw new Error(`restart did not reset onboarding: ${afterRestart}`);

  for (let index = 0; index < 8 && await page.evaluate(() => window.__main20.getState().phase === 'onboarding'); index += 1) await page.locator('#choiceArea button').first().click();
  const afterOnboarding = await page.evaluate(() => ({ phase: window.__main20.getState().phase, title: document.querySelector('#paperTitle')?.textContent || '' }));
  if (afterOnboarding.phase !== 'ideology_prologue') throw new Error(`onboarding did not advance: ${afterOnboarding.phase}`);
  if (!afterOnboarding.title) throw new Error('ideology source paper did not render');
  if (await page.locator('#paperColumns .main20-ideology-paper').count() === 0) throw new Error('ideology source paper did not render');
  if (await page.locator('#choiceArea button').count() === 0) throw new Error('onboarding/prologue controls did not render');
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  console.log('v45 runtime regression: PASS');
} finally {
  await browser.close();
}
