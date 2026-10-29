import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd();
const portProbe = createServer();
await new Promise((resolve, reject) => {
  portProbe.once('error', reject);
  portProbe.listen(0, '127.0.0.1', resolve);
});
const port = portProbe.address().port;
await new Promise((resolve, reject) => portProbe.close(error => error ? reject(error) : resolve()));

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: root,
  env: { ...process.env, CHANCERY_PORT: String(port) },
  stdio: 'ignore',
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
  if (!ready) throw new Error(`Local game server did not become ready at ${url}`);

  for (const script of [
    'scripts/v33-rpg-browser-smoke.mjs',
    'scripts/v33-ending-browser-smoke.mjs',
    'scripts/v33-campaign-browser-acceptance.mjs',
  ]) {
    console.log(`\n> ${script} (${url})`);
    const result = spawnSync(process.execPath, [script], {
      cwd: root,
      env: { ...process.env, V33_RPG_URL: url },
      stdio: 'inherit',
      timeout: 15 * 60 * 1000,
      windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${script} failed with status ${result.status}`);
  }
} finally {
  server.kill();
}
