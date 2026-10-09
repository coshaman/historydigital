import { readFile } from 'node:fs/promises';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const app=await readFile(new URL('../app.js',import.meta.url),'utf8');
const required=['sourceScanImage','sourceTranscription','sourceTranslation','scanTab','transcriptionTab','translationTab','underlineAction','marginAction','stampAction'];
const missing=required.filter(token=>!html.includes(token)&&!app.includes(token));
const cases=(app.match(/const originalRenderScene=renderScene/g)||[]).length;
if(missing.length||cases!==1||!app.includes("window.addEventListener('desk-prop'")) { console.error(JSON.stringify({missing,renderHook:cases,deskHook:app.includes("window.addEventListener('desk-prop'")})); process.exit(1); }
console.log('source-interaction-audit: original material → transcription → Korean → evidence actions — PASS');
