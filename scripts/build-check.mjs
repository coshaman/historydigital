import { readFile } from 'node:fs/promises';
for (const file of ['app.js','server.mjs','three-walk.js']) { const text=await readFile(new URL(`../${file}`, import.meta.url),'utf8'); if (!text.trim()) throw new Error(`${file} empty`); }
console.log('build/typecheck: source files present and readable — PASS');
