import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const dist = path.join(root, 'dist');
const files = ['index.html', 'styles.css', 'app.js', 'gold-runtime.js', 'three-desk.js', 'three-walk.js', 'window-view-controller.js', 'main20-runtime.js', 'server.mjs'];
const dirs = ['data', 'assets', 'narrative'];
await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });
for (const file of files) await fs.copyFile(path.join(root, file), path.join(dist, file));
for (const dir of dirs) await fs.cp(path.join(root, dir), path.join(dist, dir), { recursive: true });
const hash = async file => crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex');
const manifest = { schemaVersion: 'REAL-BUILD-1', kind: 'static-deployment-artifact', generatedAt: new Date().toISOString(), bundler: 'none', sourceRoot: '.', entry: 'index.html', server: 'server.mjs', copiedDirectories: dirs, files: {} };
for (const file of files) manifest.files[file] = { path: file, sha256: await hash(path.join(dist, file)) };
await fs.writeFile(path.join(dist, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await fs.mkdir(path.join(root, 'docs', 'v27'), { recursive: true });
await fs.writeFile(path.join(root, 'docs', 'v27', 'REAL_BUILD.json'), JSON.stringify({ ...manifest, status: 'PASS', artifactPath: 'dist/', note: 'Static app has no bundler; this is the actual copied deployment artifact served by dist/server.mjs.' }, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', artifact: 'dist/', entry: 'dist/index.html', fileCount: files.length, directories: dirs }, null, 2));
