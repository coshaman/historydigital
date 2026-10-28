import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleTurn } from './ai/http/turn-handler.js';
import { createResponsesProvider } from './ai/provider/openai-responses.js';

const root = fileURLToPath(new URL('.', import.meta.url)).replace(/[\\/]+$/, '');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };
const port = Number(process.env.CHANCERY_PORT || 4173);
const allowedOrigins = (process.env.CHANCERY_ALLOWED_ORIGINS || `http://127.0.0.1:${port},http://localhost:${port}`).split(',').map(value => value.trim()).filter(Boolean);
const provider = process.env.OPENAI_API_KEY ? createResponsesProvider({ apiKey: process.env.OPENAI_API_KEY }) : undefined;
const config = { allowedOrigins, dialogueModel: process.env.OPENAI_DIALOGUE_MODEL || 'gpt-6.1-terra', memoryModel: process.env.OPENAI_MEMORY_MODEL || 'gpt-6-luna', maxRequestBytes: 8192, maxTurnsPerSession: 80 };

async function readJson(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('too large'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('invalid json'), { status: 400 }); }
}

createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  if (new URL(req.url, `http://127.0.0.1:${port}`).pathname === '/api/ai/turn') {
    if (req.method === 'OPTIONS') {
      const preflight = await handleTurn({ method: 'OPTIONS', origin }, { config });
      res.writeHead(preflight.status, preflight.headers); return res.end();
    }
    let body;
    try { body = await readJson(req, config.maxRequestBytes); }
    catch (error) { res.writeHead(error.status || 400, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: error.status === 413 ? 'request_too_large' : 'invalid_json' })); }
    const result = await handleTurn({ method: req.method, origin, body }, { provider, config });
    res.writeHead(result.status, result.headers); return res.end(JSON.stringify(result.body));
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
  catch { res.writeHead(400); return res.end('Bad request'); }
  const requested = pathname === '/' ? '/index.html' : pathname;
  const path = normalize(join(root, requested));
  if (path === root || !path.startsWith(`${root}${process.platform === 'win32' ? '\\' : '/'}`)) { res.writeHead(403); return res.end('Forbidden'); }
  try { const data = await readFile(path); res.writeHead(200, { 'Content-Type': types[extname(path)] || 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(data); }
  catch { res.writeHead(404); res.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Chancery of Ink at http://127.0.0.1:${port}`));
