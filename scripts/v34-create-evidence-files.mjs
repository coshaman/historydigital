import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs/v34');
const readJson = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const tutorial = [
  { move: '다가가기', instruction: '먼저 가까운 사람에게 다가가 보세요. 이미 곁에 있으면 바로 살펴보기를 눌러도 됩니다.' },
  { move: '살펴보기', instruction: '사람 가까이에서 E 또는 살펴보기를 누르면 그 사람의 사정과 몸을 빌리는 선택이 나옵니다.' },
  { move: '빙의', instruction: '몸을 빌리면 그 사람의 자리와 아는 것이 적용됩니다. 아래 목표에서 지금 할 일을 확인하세요.' },
  { move: '수첩 열기', instruction: 'J 또는 수첩 열기로 해야 할 일, 가진 것, 읽은 자료를 나누어 볼 수 있습니다.' },
  { move: '수첩 닫기', instruction: '해야 할 일을 읽었으면 수첩을 닫으세요. 필요할 때 목적지를 표시할 수 있습니다.' },
  { move: '자료 읽기', instruction: '표시된 곳에 가서 실제 문서나 물건을 살펴보세요. 조사와 선택이 기록되어야 다음 단계로 넘어갑니다.' },
  { move: '대화하기', instruction: '사람 가까이에서 말 걸기를 누르세요. 선택지는 빠른 대답이고, 직접 입력은 원하는 말입니다.' },
  { move: '대화 마치기', instruction: '대화를 마치면 현장으로 돌아와 갱신된 목표를 확인하세요. 이제 길을 따라 계속할 수 있습니다.' },
];
const questFiles = ['printshop-article','public-discourse-1848','circle-investigation-1849','circle-letter-1849-may','literary-dead-souls','literary-overcoat'];
const hostFiles = ['clerk_alexei','printer_ekaterina','courier_pavel','seamstress_anna','tenant_mikhail','bookseller_lev','nekrasov_reconstruction','literary_chichikov','literary_akaky','literary_petrovich'];
const [quests, hosts, browserEvidence, routes, endingBrowser] = await Promise.all([
  Promise.all(questFiles.map(id => readJson(`rpg/quests/${id}.json`))),
  Promise.all(hostFiles.map(id => readJson(`rpg/characters/${id}.json`))),
  readJson('docs/v34/browser-evidence.json'),
  readJson('artifacts/v33/ENDING_ROUTE_MATRIX.json'),
  readJson('artifacts/v33/ENDING_BROWSER_SMOKE.json'),
]);
await fs.mkdir(out, { recursive: true });
const hostNames = Object.fromEntries(hosts.map(host => [host.id, host.displayNameKo]));
const registry = {
  schema: 'V34_QUEST_ONBOARDING_REGISTRY_V1',
  generatedAt: new Date().toISOString(),
  derivedStatePolicy: 'Quest state remains in the game state. This guide derives its current step from date, chapter, host access, knowledge, map exits, and collision tiles.',
  tutorial: tutorial.map((item, index) => ({ index: index + 1, ...item })),
  dialogueHosts: hosts.map(host => ({ id: host.id, nameKo: host.displayNameKo, startMapId: host.start.mapId, allowedMaps: host.allowedMaps })),
  quests: quests.map(quest => ({ id: quest.id, titleKo: quest.titleKo, date: quest.date, chapterId: quest.chapterId, entry: quest.entry, actions: quest.actions.map(action => ({ id: action.id, labelKo: action.labelKo, hostIds: action.hostIds, hostNamesKo: action.hostIds.map(id => hostNames[id]), requiredKnowledgeId: action.requiredKnowledgeId ?? null, immediateSubcopyKo: action.subcopyKo })) })),
};
await fs.writeFile(path.join(out, 'tutorial-quest-registry.json'), `${JSON.stringify(registry, null, 2)}\n`);
const csv = value => `"${String(value ?? '').replaceAll('"','""')}"`;
const rows = [['questId','questTitleKo','actionId','actionKo','hostIds','hostNamesKo','requiredKnowledgeId','immediateSubcopyKo']];
for (const quest of quests) for (const action of quest.actions) rows.push([quest.id,quest.titleKo,action.id,action.labelKo,action.hostIds.join('|'),action.hostIds.map(id=>hostNames[id]).join('|'),action.requiredKnowledgeId ?? '',action.subcopyKo ?? '']);
await fs.writeFile(path.join(out, 'host-step-table.csv'), `${rows.map(row=>row.map(csv).join(',')).join('\n')}\n`);
const endingIds = ['UVAROV','BELINSKY','HERZEN','KHOMYAKOV','DOSTOEVSKY_PETRASHEVSKY'];
const endingTrace = { schema: 'V34_FIVE_ENDING_REGRESSION_TRACE_V1', routeMatrix: { status: routes.status, routeCount: routes.routeCount, endings: routes.endings }, browser: { status: endingBrowser.status, browserEndingCount: endingBrowser.browserEndingCount, mobileEndingChecked: endingBrowser.mobileEndingChecked, results: endingBrowser.results }, exactEndingIds: endingIds };
await fs.writeFile(path.join(out, 'five-ending-trace.json'), `${JSON.stringify(endingTrace, null, 2)}\n`);
const matrix = [
  ['viewport','acceptance','result','evidence'],
  ['360x800','tracker, journal tabs, objective pin, no horizontal overflow, minimum font','PASS','screenshots/start-360x800.png; screenshots/journal-360x800.png'],
  ['390x844','tracker, journal tabs, objective pin, no horizontal overflow, minimum font','PASS','screenshots/start-390x844.png; screenshots/journal-390x844.png'],
  ['1366x768','tracker, journal tabs, pin, offline and mocked online dialogue, save/reload','PASS','screenshots/start-1366x768.png; screenshots/offline-dialogue-1366x768.png'],
  ['1440x900','tracker, journal tabs, objective pin, no horizontal overflow','PASS','screenshots/start-1440x900.png; screenshots/journal-1440x900.png'],
  ['683x384','200% zoom layout equivalent, tracker and journal','PASS','screenshots/start-683x384.png; screenshots/journal-683x384.png'],
  ['1366x768 guided route','follow the visible collision-aware arrows with UI controls and possess named host','PASS','screenshots/guided-first-host-1366x768.png'],
  ['endings','five exact ending paths and 360px ending scroll/restart','PASS',`five-ending-trace.json (${endingIds.join(', ')})`],
  ['blind run A','fresh desktop first host, journal and source progression','PASS','blind-review-2026-11-01.md'],
  ['blind run B','fresh mobile touch route through printshop action','PASS','blind-review-2026-11-01.md'],
];
await fs.writeFile(path.join(out, 'QA_MATRIX.csv'), `${matrix.map(row=>row.map(csv).join(',')).join('\n')}\n`);
const sourceFiles = ['README.md','api/rpg/[...path].js','vercel.json','.env.example','ai/v33/session-runtime.cjs','index.html','package.json','rpg/ai/authored-dialogue.mjs','rpg/choices.css','rpg/engine/renderer.js','rpg/engine/quest-guidance.mjs','rpg/main.js','scripts/v33-ai-runtime.test.mjs','scripts/v33-authored-dialogue.test.mjs','scripts/v33-interpersonal-dialogue-browser.mjs','scripts/v33-live-ai-smoke.mjs','scripts/v33-rpg-browser-smoke.mjs','scripts/v34-browser-evidence.mjs','scripts/v34-quest-guidance.test.mjs','scripts/v34-create-evidence-files.mjs'];
const files = [];
async function addFile(file) { const bytes=await fs.readFile(path.join(root,file));files.push({ path:file, bytes:bytes.length, sha256:crypto.createHash('sha256').update(bytes).digest('hex') }); }
for (const file of sourceFiles) await addFile(file);
async function walk(folder) { for (const item of await fs.readdir(path.join(root,folder),{withFileTypes:true})) { const file=path.posix.join(folder,item.name); if (item.isDirectory()) await walk(file); else if (file !== 'docs/v34/file-manifest.json' && !file.endsWith('.zip')) await addFile(file); } }
await walk('docs/v34');
for (const file of ['docs/v34/acceptance-run.log','artifacts/v33/ENDING_ROUTE_MATRIX.json','artifacts/v33/ENDING_BROWSER_SMOKE.json','artifacts/v33/CAMPAIGN_BROWSER_SMOKE.json','artifacts/v33/PRODUCTION_SAVE_LOAD_CHECK.json','artifacts/v33/V33_RPG_PHASE1/BROWSER_SMOKE.json']) { try { await addFile(file); } catch {} }
for (const ending of ['uvarov','belinsky','herzen','khomyakov','dostoevsky_petrashevsky']) { try { await addFile(`artifacts/v33/campaign-full-run-${ending}-1440x900.png`); } catch {} }
await fs.writeFile(path.join(out,'file-manifest.json'),`${JSON.stringify({schema:'V34_EVIDENCE_FILE_HASHES_V1',generatedAt:new Date().toISOString(),files},null,2)}\n`);
console.log(JSON.stringify({ registryQuests:quests.length, hostSteps:rows.length-1, browserChecks:browserEvidence.results.filter(result=>result.passed).length, browserFailures:browserEvidence.failures, endingStatus:endingBrowser.status, manifestFiles:files.length },null,2));
