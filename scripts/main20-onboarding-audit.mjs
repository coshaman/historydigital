import fs from 'node:fs';
import { chromium } from 'playwright';

const data = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8'));
if (!data.onboarding?.lines || data.onboarding.lines.length < 4 || data.onboarding.lines.length > 8) throw new Error('MAIN20 onboarding must contain 4–8 authored lines');
const text = data.onboarding.lines.map((line) => line[1]).join(' ');
for (const term of ['현대', '서기', '문서', '신문', '공식', '사적']) if (!text.includes(term)) throw new Error(`onboarding missing concept: ${term}`);
if (!data.onboarding.response?.text) throw new Error('onboarding response choice missing');

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${process.env.MAIN20_BASE_URL || 'http://127.0.0.1:4173'}/#main`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  const visible = await page.locator('#dialogue').textContent();
  const state = await page.evaluate(() => window.__main20?.getState?.());
  if (!state || state.onboardingComplete) throw new Error(`onboarding did not start visibly: ${JSON.stringify(state)}`);
  if (!data.onboarding.lines.some((line) => visible?.includes(line[1]))) throw new Error('visible dialogue is not authored onboarding text');
  console.log('PASS authored onboarding is visible on MAIN20 production route');
} finally { await browser.close(); }
