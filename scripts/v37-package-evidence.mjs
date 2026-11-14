import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archiveName = 'RUSSIAN_LIVES_V37_LIVING_WORLD_VERIFIABLE.zip';
const archivePath = path.join(root, archiveName);
const manifestName = 'SHA256SUMS.txt';
const digest = async file => createHash('sha256').update(await readFile(file)).digest('hex');
const listFiles = async (dir, relative = '') => {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(path.join(dir, entry.name), rel));
    else files.push(rel);
  }
  return files;
};

if (process.argv[2] === '--verify') {
  const extracted = path.resolve(process.argv[3] ?? '');
  const rows = (await readFile(path.join(extracted, manifestName), 'utf8')).trim().split(/\r?\n/).filter(Boolean);
  for (const row of rows) {
    const [expected, relative] = row.split('  ', 2);
    if (!expected || !relative || path.isAbsolute(relative) || relative.split('/').includes('..')) throw new Error(`Invalid manifest row: ${row}`);
    if (await digest(path.join(extracted, ...relative.split('/'))) !== expected) throw new Error(`Checksum mismatch: ${relative}`);
  }
  console.log(JSON.stringify({ status: 'PASS', verifiedFiles: rows.length, archive: archiveName }));
  process.exit(0);
}

const stage = path.join(os.tmpdir(), `russian-lives-v37-evidence-${process.pid}`);
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
const skipDirs = new Set(['.git', 'node_modules', 'dist', 'dist-v33', '.vercel', '.superpowers', 'coverage']);
const copyTree = async (from, to, rel = '') => {
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const childRel = path.posix.join(rel, entry.name);
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      if (childRel === 'artifacts') {
        for (const artifactDir of ['artifacts/v37', 'artifacts/v38/HISTORICAL_LIVING_SCENES']) {
          try { await cp(path.join(root, artifactDir), path.join(stage, artifactDir), { recursive: true }); } catch {}
        }
        continue;
      }
      await copyTree(path.join(from, entry.name), path.join(to, entry.name), childRel);
    } else if (entry.isFile() && entry.name !== '.git' && !entry.name.endsWith('.zip')
      && !(entry.name.startsWith('.env') && entry.name !== '.env.example')) {
      await mkdir(path.dirname(path.join(to, entry.name)), { recursive: true });
      await cp(path.join(from, entry.name), path.join(to, entry.name));
    }
  }
};
await copyTree(root, stage);
const evidenceFiles = (await listFiles(stage)).sort();
const rows = [];
for (const relative of evidenceFiles) rows.push(`${await digest(path.join(stage, ...relative.split('/')))}  ${relative}`);
await writeFile(path.join(stage, manifestName), `${rows.join('\n')}\n`, 'utf8');
await writeFile(path.join(stage, 'manifest.sha256'), `${rows.join('\n')}\n`, 'utf8');
execFileSync('tar.exe', ['-a', '-c', '-f', archivePath, '-C', stage, '.'], { stdio: 'inherit' });
const bytes = (await stat(archivePath)).size;
if (bytes > 95 * 1024 * 1024) throw new Error(`Evidence archive exceeds 95 MiB: ${bytes}`);
await rm(stage, { recursive: true, force: true });
console.log(JSON.stringify({ status: 'PASS', archive: archivePath, archiveBytes: bytes, files: evidenceFiles.length,
  credentialsExcluded: true, gitExcluded: true, nodeModulesExcluded: true,
  completionClaim: 'NO; see docs/v37/FINAL_STATUS.md' }));
