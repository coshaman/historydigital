import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const root = process.cwd();
const probe = createServer();
await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
const port = probe.address().port;
await new Promise((resolve, reject) => probe.close(error => error ? reject(error) : resolve()));
const server = spawn(process.execPath, ['server.mjs'], { cwd: root, env: { ...process.env, CHANCERY_PORT: String(port) }, stdio: 'ignore', windowsHide: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const checks = [];
try {
  const url = `http://127.0.0.1:${port}/`;
  let ready = false;
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  if (!ready) throw new Error('local_server_unavailable');
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url, { waitUntil: 'networkidle' });
    const result = await page.evaluate(() => ({
      viewport: { width: innerWidth, height: innerHeight },
      documentWidth: document.documentElement.scrollWidth,
      boardVisible: !document.querySelector('#discussion-quest-board')?.hidden,
      missionVisible: !document.querySelector('#mission-tracker')?.hidden,
      progress: document.querySelector('#discussion-quest-progress')?.textContent,
      guidance: document.querySelector('#discussion-quest-guidance')?.textContent,
      rows: [...document.querySelectorAll('#discussion-quest-items li')].map(item => item.textContent),
      overflowX: document.documentElement.scrollWidth > innerWidth,
    }));
    if (!result.boardVisible || !result.missionVisible || !/빙의해/.test(result.guidance) || result.rows.length < 1 || result.overflowX || errors.length) {
      throw new Error(`opinion_board_not_actionable:${JSON.stringify({ result, errors })}`);
    }
    checks.push({ ...result, pageErrors: errors });
    await context.close();
  }
  console.log(JSON.stringify({ status: 'PASS', possessionNotRequiredToSeeOpinionGoals: true, checks }, null, 2));
} finally {
  await browser.close();
  server.kill();
}
