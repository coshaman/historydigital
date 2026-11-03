import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const socket = createServer();
await new Promise((resolve, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', resolve); });
const port = socket.address().port;
await new Promise((resolve, reject) => socket.close(error => error ? reject(error) : resolve()));
const server = spawn(process.execPath, ['server.mjs'], { cwd: process.cwd(), env: { ...process.env, OPENAI_API_KEY: '', CHANCERY_PORT: String(port) }, stdio: 'ignore', windowsHide: true });
const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
try {
  const url = `http://127.0.0.1:${port}/`;
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(url)).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  if (!ready) throw new Error('local_server_unavailable');
  const checks = [];
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('#settings-open').click();
    await page.getByRole('button', { name: '실제 AI 답변 시험' }).click();
    await page.waitForFunction(() => /AI 답변 시험 실패/.test(document.querySelector('#api-generation-probe-result')?.textContent ?? ''), null, { timeout: 5000 });
    const result = await page.evaluate(() => ({
      text: document.querySelector('#api-generation-probe-result')?.textContent,
      diagnostics: [...document.querySelectorAll('#api-diagnostics-list li')].map(item => item.textContent),
      overflowX: document.documentElement.scrollWidth > innerWidth,
      viewport: innerWidth,
    }));
    if (!/OPENAI_API_KEY/.test(result.text) || /오프라인 대사|오프라인 대답/.test(result.text) || result.overflowX || errors.length) {
      throw new Error(`missing-key-probe-not-honest:${JSON.stringify({ result, errors })}`);
    }
    checks.push({ ...result, pageErrors: errors });
    await context.close();
  }
  console.log(JSON.stringify({ status: 'PASS', probeDistinguishesKeyPresenceFromGeneration: true, noAuthoredOfflineAnswerOnMissingKey: true, checks }, null, 2));
} finally {
  await browser.close();
  server.kill();
}
