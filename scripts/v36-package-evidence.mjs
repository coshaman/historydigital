import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archiveName = 'RUSSIAN_LIVES_V36_OPEN_WORLD_EVIDENCE.zip';
const archivePath = path.join(root, archiveName);
const manifestName = 'SHA256SUMS.txt';

async function listFiles(dir, relative = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(path.join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

async function digest(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

if (process.argv[2] === '--verify') {
  const extracted = path.resolve(process.argv[3] ?? '');
  const manifest = await readFile(path.join(extracted, manifestName), 'utf8');
  const rows = manifest.trim().split(/\r?\n/).filter(Boolean);
  for (const row of rows) {
    const [expected, relative] = row.split('  ', 2);
    if (!expected || !relative || path.isAbsolute(relative) || relative.split('/').includes('..')) throw new Error(`Invalid manifest row: ${row}`);
    const actual = await digest(path.join(extracted, ...relative.split('/')));
    if (actual !== expected) throw new Error(`Checksum mismatch: ${relative}`);
  }
  console.log(JSON.stringify({ status: 'PASS', verifiedFiles: rows.length, archive: archiveName }));
  process.exit(0);
}

const stage = path.join(os.tmpdir(), `russian-lives-v36-evidence-${process.pid}`);
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
const skipDirectories = new Set(['.git', 'node_modules', 'dist', 'dist-v33', '.vercel', '.superpowers']);
const skipFiles = new Set(['.git', archiveName, 'RUSSIAN_LIVES_V33_POSSESSION_RPG_VERIFICATION.zip', 'RUSSIAN_LIVES_V35_LIVING_HISTORY_EVIDENCE.zip']);
const curatedBrowserScreenshots = [
  'canonical-BELINSKY-ending-1440.png',
  'canonical-DOSTOEVSKY_PETRASHEVSKY-ending-1440.png',
  'canonical-HERZEN-ending-1440.png',
  'canonical-KHOMYAKOV-ending-1440.png',
  'canonical-UVAROV-ending-1440.png',
  'canonical-BELINSKY-C07-reading-1440.png',
  'canonical-BELINSKY-E04-decision-1440.png',
  'canonical-BELINSKY-E07-reading-1440.png',
];

async function copyProject(from, to, relative = '') {
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const rel = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (skipDirectories.has(entry.name)) continue;
      if (rel === 'artifacts') {
        const v36 = path.join(from, entry.name, 'v36');
        try { await stat(v36); } catch { continue; }
        const screenshotDirectory = path.join(v36, 'BROWSER_ACCEPTANCE');
        await mkdir(screenshotDirectory.replace(v36, path.join(to, 'artifacts', 'v36')), { recursive: true });
        for (const file of curatedBrowserScreenshots) {
          const source = path.join(screenshotDirectory, file);
          try { await stat(source); } catch { throw new Error(`Required curated screenshot is missing: ${file}`); }
          await cp(source, path.join(to, 'artifacts', 'v36', 'BROWSER_ACCEPTANCE', file));
        }
        continue;
      }
      await copyProject(path.join(from, entry.name), path.join(to, entry.name), rel);
    } else if (entry.isFile()) {
      if (skipFiles.has(entry.name) || entry.name.endsWith('.zip')) continue;
      if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue;
      const target = path.join(to, entry.name);
      await mkdir(path.dirname(target), { recursive: true });
      await cp(path.join(from, entry.name), target);
    }
  }
}

await copyProject(root, stage);
const files = (await listFiles(stage)).filter(file => file !== manifestName).sort();
const lines = [];
for (const relative of files) lines.push(`${await digest(path.join(stage, ...relative.split('/')))}  ${relative}`);
await writeFile(path.join(stage, manifestName), `${lines.join('\n')}\n`, 'utf8');
const escapedStage = stage.replaceAll("'", "''");
const escapedArchive = archivePath.replaceAll("'", "''");
execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${escapedStage}\\*' -DestinationPath '${escapedArchive}' -Force`], { stdio: 'inherit' });
const archiveSize = (await stat(archivePath)).size;
if (archiveSize > 95 * 1024 * 1024) throw new Error(`Evidence ZIP exceeds 95 MiB Git hosting safety budget: ${archiveSize}`);
console.log(JSON.stringify({ status: 'PASS', archive: archivePath, archiveBytes: archiveSize, sourceFiles: files.length,
  curatedBrowserScreenshots: curatedBrowserScreenshots.length, credentialsExcluded: true,
  envLocalExcluded: true, gitExcluded: true, nodeModulesExcluded: true }));
await rm(stage, { recursive: true, force: true });
