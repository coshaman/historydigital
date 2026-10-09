import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root='.';
const files=['gold-runtime.js','styles.css','index.html','data/periodical-review-gold-1847.json','package.json'];
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const fileHashes={}; const parts=[];
for(const file of files){const bytes=await readFile(`${root}/${file}`);fileHashes[file]=hash(bytes);parts.push(`${file}:${fileHashes[file]}`);}
let commit=null; try{commit=execFileSync('git',['-c','safe.directory=C:/Users/owner/Documents/ChatGPT/history','rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()||null;}catch{}
const response=await fetch('http://127.0.0.1:4173/data/periodical-review-gold-1847.json',{cache:'no-store'});
const body=await response.text();
const result={schemaVersion:'v21-build-provenance-1',capturedAt:'2026-10-01',deploymentUrl:'http://127.0.0.1:4173/',manifestUrl:'http://127.0.0.1:4173/data/periodical-review-gold-1847.json',httpStatus:response.status,httpManifestHash:hash(Buffer.from(body)),gitCommit:commit,gitCommitStatus:commit?'AVAILABLE':'NO_COMMIT_IN_WORKTREE',buildId:hash(Buffer.from(parts.join('\n'))),fileHashes};
await writeFile('docs/v21/V21_BUILD_PROVENANCE.json',`${JSON.stringify(result,null,2)}\n`); console.log(JSON.stringify(result,null,2));
