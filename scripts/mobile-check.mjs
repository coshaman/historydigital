import { readFile } from 'node:fs/promises';
const css=await readFile(new URL('../styles.css',import.meta.url),'utf8'); const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const checks=[['viewport meta',/name="viewport"/.test(html)],['tablet breakpoint',/@media\(max-width:900px\)/.test(css)],['phone breakpoint',/@media\(max-width:500px\)/.test(css)],['touch-size response controls',/\.response-area button/.test(css)],['no forced desktop width',!/(?<!\()min-width:\s*9\d\dpx/.test(css)]];
for(const [name,ok] of checks)console.log(`${ok?'PASS':'FAIL'}\t${name}`); if(checks.some(([,ok])=>!ok))process.exit(1);
