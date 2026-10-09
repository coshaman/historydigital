import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
const exec=promisify(execFile); const path='docs/v13/GOLD_DECISION_VISIBILITY_REVIEW.csv'; const source=await readFile(path,'utf8');
const rows=source.trimEnd().split(/\r\n|\n/).map(line=>{const out=[];let field='',quoted=false;for(let i=0;i<line.length;i++){const ch=line[i];if(ch==='"'){if(quoted&&line[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){out.push(field);field='';}else field+=ch;}out.push(field);return out;});
if(rows.length!==25||rows.some(row=>row.length!==rows[0].length))throw new Error(`Node CSV shape invalid: ${rows.length} rows`);
const py=await exec('python',['-c',`import csv
rows=list(csv.reader(open(r'${path}',encoding='utf-8',newline='')))
assert len(rows)==25
assert all(len(row)==len(rows[0]) for row in rows)
print('python parser rows=%d columns=%d' % (len(rows)-1,len(rows[0])))`]);
console.log(JSON.stringify({nodeParser:{rows:rows.length-1,columns:rows[0].length},pythonParser:py.stdout.trim(),utf8:true},null,2)); console.log('v13-csv-gate: Node + Python standard parser shape — PASS');
