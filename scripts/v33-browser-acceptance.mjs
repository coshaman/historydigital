import { spawn, spawnSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd();
const staticRoot = path.join(root, 'dist-v33');
await access(path.join(staticRoot, 'index.html')).catch(() => { throw new Error('Build the release artifact first with npm run build:v33; browser acceptance serves dist-v33, not the source checkout.'); });
const portProbe = createServer();
await new Promise((resolve, reject) => {
  portProbe.once('error', reject);
  portProbe.listen(0, '127.0.0.1', resolve);
});
const port = portProbe.address().port;
await new Promise((resolve, reject) => portProbe.close(error => error ? reject(error) : resolve()));

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, CHANCERY_PORT: String(port), CHANCERY_STATIC_ROOT: staticRoot },
  stdio: ['ignore', 'ignore', 'inherit'],
  windowsHide: true,
});
const url = `http://127.0.0.1:${port}/`;

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Local game server exited with code ${server.exitCode}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok && (await response.text()).includes('id="world"')) { ready = true; break; }
    } catch {}
    await delay(250);
  }
  if (!ready) throw new Error(`Local game server did not become ready at ${url} (exitCode=${server.exitCode})`);

  const campaignCase = process.argv.find(argument => argument.startsWith('--campaign-case='))?.slice('--campaign-case='.length);
  const overcoatOnly = process.argv.includes('--overcoat-only');
const atmosphereOnly = process.argv.includes('--atmosphere-only');
const endingOnly = process.argv.includes('--ending-only');
const rpgOnly = process.argv.includes('--rpg-only');
const campaignOnly = process.argv.includes('--campaign-only');
const scripts = atmosphereOnly
    ? [['scripts/v33-atmosphere-browser.mjs']]
    : overcoatOnly
    ? [['scripts/v33-overcoat-browser-smoke.mjs']]
    : endingOnly
    ? [['scripts/v33-ending-browser-smoke.mjs']]
    : rpgOnly
    ? [['scripts/v33-rpg-browser-smoke.mjs']]
    : campaignOnly
    ? [['scripts/v33-campaign-browser-acceptance.mjs']]
    : campaignCase
    ? [['scripts/v33-campaign-browser-acceptance.mjs', `--case=${campaignCase}`]]
    : [
    'scripts/v33-atmosphere-browser.mjs',
    'scripts/v33-interpersonal-dialogue-browser.mjs',
    'scripts/v33-rpg-browser-smoke.mjs',
    'scripts/v33-overcoat-browser-smoke.mjs',
    'scripts/v33-ending-browser-smoke.mjs',
    'scripts/v33-campaign-browser-acceptance.mjs',
  ].map(script => [script]);
  for (const [script, ...scriptArgs] of scripts) {
    console.log(`\n> ${script} (${url})`);
    const result = spawnSync(process.execPath, [script, ...scriptArgs], {
      cwd: root,
      env: { ...process.env, V33_RPG_URL: url, ...(rpgOnly ? { V33_BROWSER_RUN_ID: new Date().toISOString().replaceAll(':', '-') } : {}) },
      stdio: 'inherit',
      // The campaign case drives a complete historical route through an
      // interactive browser and can exceed the old 15-minute ceiling on
      // slower/virtualized machines. Preserve all assertions and allow the
      // route to finish before the enclosing acceptance gate decides status.
      timeout: script.includes('v33-campaign-browser-acceptance') ? 45 * 60 * 1000 : 15 * 60 * 1000,
      windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${script} failed with status ${result.status}`);
  }
} finally {
  server.kill();
}
