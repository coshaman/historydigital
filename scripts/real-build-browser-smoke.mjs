import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const port = 4183;
const server = spawn(process.execPath, ['server.mjs'], { cwd: 'dist', env: { ...process.env, CHANCERY_PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
const errors = [];
server.stderr.on('data', chunk => errors.push(String(chunk)));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(() => Boolean(window.__goldRuntime?.getV26Manifest), null, { timeout: 20000 });
  const state = await page.evaluate(() => ({ title: document.title, runtime: Boolean(window.__goldRuntime?.getV26Manifest), width: innerWidth }));
  await page.screenshot({ path: 'artifacts/v27-browser/real-build.png', fullPage: false, timeout: 30000 });
  const report = { schemaVersion: 'REAL-BUILD-BROWSER-1', status: errors.length ? 'FAIL' : 'PASS', port, state, screenshot: 'real-build.png', serverErrors: errors };
  await import('node:fs/promises').then(fs => fs.writeFile('docs/v27/REAL_BUILD_BROWSER.json', JSON.stringify(report, null, 2) + '\n'));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
  server.kill();
}
