import { readFile } from 'node:fs/promises';
const data=JSON.parse(await readFile(new URL('../data/content.json',import.meta.url))); const ids=new Set(data.endings.map(e=>e.id));
if(ids.size!==5) throw new Error('expected five endings'); for(const e of data.endings) if(!e.gate || e.hardGates?.length<3) throw new Error(`${e.id} missing three hard gates`);
const app=await readFile(new URL('../app.js',import.meta.url),'utf8'); for(const id of ['E02','E04','E07']) if(!app.includes(`'${id}'`)) throw new Error(`${id} route missing`);
for(const token of ['state.invitation','state.relationships','state.reputation','state.rank','maybePromote','european_outlook','tradition_affinity','state_loyalty','orthodoxy_attitude','radicalism','E02:(state.tags.press_freedom||0)>0']) if(!app.includes(token)) throw new Error(`branch state missing: ${token}`);
const route = s => { if(s.dossierEvidence>=3)return 'DOSTOEVSKY_PETRASHEVSKY'; if((s.press_freedom||0)>=2&&(s.westernism||0)>=1)return 'HERZEN'; if((s.press_freedom||0)>=2&&(s.legalism||0)>=1)return 'BELINSKY'; if((s.slavophile_affinity||0)>=2)return 'KHOMYAKOV'; return 'UVAROV'; };
const cases=[['UVAROV',{legalism:2}],['KHOMYAKOV',{slavophile_affinity:2}],['BELINSKY',{press_freedom:2,legalism:1}],['HERZEN',{press_freedom:2,westernism:1}],['DOSTOEVSKY_PETRASHEVSKY',{dossierEvidence:3}]]; for(const [expected,state] of cases) if(route(state)!==expected) throw new Error(`${expected} unreachable`);
console.log('route-test: five gated endings, branching relationship/invitation route, and E02/E04/E07 anchors — PASS');
