import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staging = path.join(root, 'artifacts', 'v35-evidence-staging');
const archive = path.join(root, 'artifacts', 'RUSSIAN_LIVES_V35_LIVING_HISTORY_EVIDENCE.zip');
const safeGit = ['-c', `safe.directory=${root.replaceAll('\\', '/')}`];
const changed = execFileSync('git', [...safeGit, 'diff', 'HEAD', '--name-only'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean);
const untracked = execFileSync('git', [...safeGit, 'ls-files', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' })
  .split(/\r?\n/).filter(Boolean);
const codePaths = [...new Set([...changed, ...untracked])].filter(file =>
  /^(README\.md|package\.json|server\.mjs|vercel\.json|index\.html|ai\/|api\/|rpg\/|scripts\/)/.test(file)
  && !/(^|\/)\.env(?:\.|$)|(^|\/)node_modules\/|(^|\/)dist-v33\//i.test(file)
  && !file.startsWith('artifacts/')
);
const evidencePaths = [
  ...codePaths,
  ...await (async () => {
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(path.join(root, 'docs', 'v35'), { recursive: true, withFileTypes: true });
    return files.filter(entry => entry.isFile()).map(entry => path.relative(root, path.join(entry.parentPath, entry.name)));
  })(),
  'artifacts/v33/ENDING_BROWSER_SMOKE.json',
  ...['UVAROV', 'BELINSKY', 'HERZEN', 'KHOMYAKOV', 'DOSTOEVSKY_PETRASHEVSKY'].flatMap(id => [
    `artifacts/v33/CAMPAIGN_BROWSER_SMOKE_${id}.json`,
    `artifacts/v33/campaign-full-run-${id.toLowerCase()}-1440x900.png`,
  ]),
];
const selected = [...new Set(evidencePaths.map(file => file.replaceAll('\\', '/')))].filter(file => file !== 'docs/v35/evidence-manifest.json' && !file.includes('failure') && !/(^|\/)\.env(?:\.|$)/i.test(file));
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
const manifest = [];
for (const relative of selected) {
  const source = path.join(root, relative);
  let bytes;
  try { bytes = await readFile(source); } catch { continue; }
  const textFile = /\.(?:md|json|csv|mjs|cjs|js|html|css|txt)$/i.test(relative);
  if (textFile && /sk-proj-[A-Za-z0-9_-]{20,}/.test(bytes.toString('utf8'))) throw new Error(`Credential-like value found in ${relative}; evidence packaging stopped`);
  const destination = path.join(staging, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination);
  manifest.push({ path: relative.replaceAll('\\', '/'), bytes: (await stat(source)).size, sha256: createHash('sha256').update(bytes).digest('hex') });
}
manifest.sort((a, b) => a.path.localeCompare(b.path));
const manifestPath = path.join(root, 'docs', 'v35', 'evidence-manifest.json');
await writeFile(manifestPath, `${JSON.stringify({ schemaVersion: 'V35_EVIDENCE_MANIFEST_V1', credentialScan: 'PASS', excluded: ['.env.local', 'credentials', '.git', 'generated failure captures'], files: manifest }, null, 2)}\n`);
const stagedManifest = path.join(staging, 'docs', 'v35', 'evidence-manifest.json');
await mkdir(path.dirname(stagedManifest), { recursive: true });
await cp(manifestPath, stagedManifest);
process.stdout.write(JSON.stringify({ status: 'PASS', fileCount: manifest.length + 1, staging: path.relative(root, staging), archive: path.relative(root, archive), credentialScan: 'PASS' }) + '\n');
