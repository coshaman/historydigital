import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const textExtensions = new Set(['.js', '.mjs', '.cjs', '.json', '.html', '.css', '.md', '.txt', '.toml', '.yml', '.yaml', '.env', '.example']);
const ignoredDirectories = new Set(['.git', 'node_modules', '.superpowers']);
const secretPattern = /\bsk-[A-Za-z0-9_-]{20,}\b/g;

function inspectText(text) {
  const matches = [...String(text).matchAll(secretPattern)];
  return { hasSecret: matches.length > 0, count: matches.length };
}

function isFrontendFile(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  if (normalized.startsWith('dist/')) return true;
  if (normalized.includes('/') || normalized === 'server.mjs') return false;
  return ['.js', '.html', '.css', '.json'].includes(path.extname(normalized));
}

async function walk(directory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(absolute, files);
    else if (textExtensions.has(path.extname(entry.name)) || entry.name === '.env.example') files.push(absolute);
  }
  return files;
}

async function scanRepository(base = root) {
  const findings = [];
  for (const absolute of await walk(base)) {
    const relative = path.relative(base, absolute).replaceAll('\\', '/');
    const content = await readFile(absolute, 'utf8');
    if (inspectText(content).hasSecret) findings.push({ file: relative, kind: 'credential-pattern' });
    if (isFrontendFile(relative) && content.includes('OPENAI_API_KEY')) findings.push({ file: relative, kind: 'server-key-name-in-frontend' });
  }
  return findings;
}

export { inspectText, isFrontendFile, scanRepository };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const findings = await scanRepository();
  if (findings.length) {
    for (const finding of findings) console.error(`Secret scan failed: ${finding.kind} in ${finding.file}`);
    process.exitCode = 1;
  } else {
    console.log('secret-scan: no credential patterns; no server key name in frontend — PASS');
  }
}
