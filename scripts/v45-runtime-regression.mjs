import { chromium } from 'playwright';

const base = process.env.MAIN20_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
const errors = [];

try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 640 }]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', (error) => errors.push(String(error)));
    await page.goto(`${base}/?main20=1&v50fresh=1`, { waitUntil: 'domcontentloaded' });
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
  const layout = await page.evaluate(() => {
    const stage = document.querySelector('.document-stage');
    const paper = document.querySelector('#paper');
    const columns = document.querySelector('#paperColumns');
    const title = document.querySelector('#paperTitle');
    const dialogue = document.querySelector('.dialogue-strip');
    const choices = document.querySelector('#choiceArea');
    const style = (node) => getComputedStyle(node);
    const rect = (node) => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, width: r.width }; };
    const desk = document.querySelector('.desk');
    return { viewport: { width: innerWidth, height: innerHeight }, document: { scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }, stage: rect(stage), stageBackground: style(stage).backgroundImage, paper: { ...rect(paper), opacity: style(paper).opacity, pointerEvents: style(paper).pointerEvents, transform: style(paper).transform, title: title.textContent, columnsHeight: rect(columns).height, excerptCount: columns.querySelectorAll('.main20-excerpt').length, excerptFont: parseFloat(style(columns.querySelector('.main20-excerpt p')).fontSize) }, dialogue: { ...rect(dialogue), overflowY: style(dialogue).overflowY, scrollHeight: dialogue.scrollHeight }, choices: { ...rect(choices), hidden: choices.hidden, buttons: [...choices.querySelectorAll('button')].map((button) => { const r = button.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, disabled: button.disabled }; }) }, deskBackground: style(desk).backgroundImage, deskEdgeHeight: parseFloat(getComputedStyle(desk, '::after').height), restartVisible: !document.querySelector('#main20Restart').hidden };
  });
  if (layout.paper.opacity !== '1' || layout.paper.pointerEvents === 'none' || layout.paper.width < 260) throw new Error(`paper is dimmed, tiny, or blocked at ${viewport.width}x${viewport.height}: ${JSON.stringify(layout.paper)}`);
  if (!layout.paper.title || layout.paper.excerptCount < 1 || layout.paper.excerptFont < 14) throw new Error(`newspaper/source text is missing or too small at ${viewport.width}x${viewport.height}: ${JSON.stringify(layout.paper)}`);
  if (layout.document.scrollWidth > viewport.width) throw new Error(`horizontal overflow at ${viewport.width}x${viewport.height}: document width ${layout.document.scrollWidth}`);
  if (layout.dialogue.height > viewport.height * 0.48) throw new Error(`dialogue panel consumes too much of the viewport at ${viewport.width}x${viewport.height}: ${layout.dialogue.height}px`);
  if (!['auto', 'scroll'].includes(layout.dialogue.overflowY)) throw new Error(`dialogue panel cannot scroll at ${viewport.width}x${viewport.height}: ${layout.dialogue.overflowY}`);
  if (!layout.choices.buttons.length || layout.choices.buttons.some((button) => button.height < 42 || button.bottom > viewport.height - 36)) throw new Error(`choice controls are too small or below the viewport at ${viewport.width}x${viewport.height}: ${JSON.stringify(layout.choices)}`);
  if (!layout.deskBackground.includes('wood-grain.svg')) throw new Error(`visible wooden desk texture is missing at ${viewport.width}x${viewport.height}: ${layout.deskBackground}`);
  if (layout.stageBackground !== 'none') throw new Error(`opaque document-stage background hides the tabletop at ${viewport.width}x${viewport.height}: ${layout.stageBackground}`);
  if (layout.deskEdgeHeight < 14) throw new Error(`tabletop front edge is missing at ${viewport.width}x${viewport.height}: ${layout.deskEdgeHeight}px`);
  if (!layout.restartVisible) throw new Error(`restart control is missing at ${viewport.width}x${viewport.height}`);
  await page.locator('#choiceArea button').last().scrollIntoViewIfNeeded();
  await page.locator('#choiceArea button').last().click();
  await page.waitForFunction(() => window.__main20.getState().ideologyLineIndex === 1);
  if (await page.locator('#choiceArea .main20-ideology-source').count() !== 0) throw new Error(`source excerpt is duplicated in the dialogue panel at ${viewport.width}x${viewport.height}`);
  await page.locator('#paperColumns .main20-ideology-read').click();
  await page.waitForFunction(() => window.__main20.getState().ideologyReadBeat === 'V42-PROLOGUE-EUROPEANIZATION');
  if (await page.locator('#choiceArea button').count() < 3) throw new Error(`ideology choices did not appear at ${viewport.width}x${viewport.height}`);
  await page.locator('#choiceArea button').last().scrollIntoViewIfNeeded();
  await page.locator('#choiceArea button').last().click();
  await page.waitForFunction(() => window.__main20.getState().ideologyBeatIndex === 1);
  const polishedFollowUp = await page.locator('#dialogue').textContent();
  if (!polishedFollowUp?.startsWith('관등표를 보면 여기 일자리가')) throw new Error(`natural dialogue presentation did not reach the next beat at ${viewport.width}x${viewport.height}: ${polishedFollowUp}`);
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  console.log(`v50 layout and interaction regression: PASS ${viewport.width}x${viewport.height}`);
  await page.close();
  }
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`);
  console.log('v50 runtime regression: PASS');
} finally {
  await browser.close();
}
