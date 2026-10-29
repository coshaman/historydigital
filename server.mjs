import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mimeTypeFor } from './server-mime.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.CHANCERY_PORT || 4173);
createServer(async (req, res) => {
  const pathname = req.url.split('?')[0];
  const requested = pathname === '/' ? '/index.html' : pathname;
  const path = normalize(join(root, requested));
  if (!path.startsWith(root)) { res.writeHead(403); return res.end('Forbidden'); }
  try { const data = await readFile(path); res.writeHead(200, { 'Content-Type': mimeTypeFor(path), 'Cache-Control': 'no-store' }); res.end(data); }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Chancery of Ink at http://127.0.0.1:${port}`));
