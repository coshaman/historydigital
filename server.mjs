import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mimeTypeFor } from './server-mime.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const staticRoot = resolve(process.env.CHANCERY_STATIC_ROOT || root);
const port = Number(process.env.CHANCERY_PORT || 4173);
const require = createRequire(import.meta.url);
const apiHandler = require('./api/rpg/[...path].js');
createServer(async (req, res) => {
  if (req.url.startsWith('/api/rpg/')) {
    const chunks = [];
    let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 32_768) { res.writeHead(413); return res.end('Payload too large'); }
      chunks.push(chunk);
    }
    if (chunks.length && req.headers['content-type']?.includes('application/json')) {
      try { req.body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { res.writeHead(400); return res.end('Invalid JSON'); }
    }
    req.headers.origin ||= `http://${req.headers.host}`;
    req.headers['x-forwarded-host'] ||= req.headers.host;
    req.headers['x-forwarded-proto'] ||= 'http';
    return apiHandler(req, res);
  }
  const pathname = req.url.split('?')[0];
  const requested = pathname === '/' ? '/index.html' : pathname;
  const path = normalize(join(staticRoot, requested));
  if (path !== staticRoot && !path.startsWith(`${staticRoot}${sep}`)) { res.writeHead(403); return res.end('Forbidden'); }
  try { const data = await readFile(path); res.writeHead(200, { 'Content-Type': mimeTypeFor(path), 'Cache-Control': 'no-store' }); res.end(data); }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Chancery of Ink at http://127.0.0.1:${port}`));
