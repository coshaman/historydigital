import { readFile } from 'node:fs/promises';
const files=['index.html','styles.css','app.js']; const text=(await Promise.all(files.map(f=>readFile(new URL(`../${f}`,import.meta.url),'utf8')))).join('\n');
const bad=['purple','violet','indigo','backdrop-blur','rounded-2xl','hover:scale','animate-bounce','Lorem Ipsum','href="#"']; const found=bad.filter(x=>text.toLowerCase().includes(x.toLowerCase()));
if(found.length) throw new Error(`UI audit hit: ${found.join(', ')}`); if(!text.includes('prefers-reduced-motion')) throw new Error('missing reduced-motion support'); console.log('ui-lint: bespoke palette, no dead controls, reduced motion present — PASS');
