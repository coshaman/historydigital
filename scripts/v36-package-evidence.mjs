import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const archiveName = 'RUSSIAN_LIVES_V36_OPEN_WORLD_EVIDENCE.zip';
const archivePath = path.join(root, archiveName);
const manifestName = 'SHA256SUMS.txt';

async function listFiles(dir, relative = '') {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const rel = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) out.push(...await listFiles(path.join(dir, entry.name), rel));
    else if (entry.isFile()) out.push(rel);
  }
  return out;
}

async function digest(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

if (process.argv[2] === '--verify') {
  const extracted = path.resolve(process.argv[3] ?? '');
  const manifest = await readFile(path.join(extracted, manifestName), 'utf8');
  const rows = manifest.trim().split(/\r?\n/).filter(Boolean);
  for (const row of rows) {
    const [expected, relative] = row.split('  ', 2);
    if (!expected || !relative || path.isAbsolute(relative) || relative.split('/').includes('..')) throw new Error(`Invalid manifest row: ${row}`);
    const actual = await digest(path.join(extracted, ...relative.split('/')));
    if (actual !== expected) throw new Error(`Checksum mismatch: ${relative}`);
  }
  console.log(JSON.stringify({ status: 'PASS', verifiedFiles: rows.length, archive: archiveName }));
  process.exit(0);
}

const stage = path.join(os.tmpdir(), `russian-lives-v36-evidence-${process.pid}`);
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
const skipDirectories = new Set(['.git', 'node_modules', 'dist', 'dist-v33', '.vercel', '.superpowers']);
const skipFiles = new Set(['.git', archiveName, 'RUSSIAN_LIVES_V33_POSSESSION_RPG_VERIFICATION.zip', 'RUSSIAN_LIVES_V35_LIVING_HISTORY_EVIDENCE.zip']);
const curatedBrowserScreenshots = [
  'canonical-BELINSKY-ending-1440.png',
  'canonical-DOSTOEVSKY_PETRASHEVSKY-ending-1440.png',
  'canonical-HERZEN-ending-1440.png',
  'canonical-KHOMYAKOV-ending-1440.png',
  'canonical-UVAROV-ending-1440.png',
  'canonical-BELINSKY-C07-reading-1440.png',
  'canonical-BELINSKY-E04-decision-1440.png',
  'canonical-BELINSKY-E07-reading-1440.png',
];

async function copyProject(from, to, relative = '') {
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const rel = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) {
      if (skipDirectories.has(entry.name)) continue;
      if (rel === 'docs/v27' || rel === 'artifacts/v27-browser') continue;
      if (rel === 'artifacts') {
        const v36 = path.join(from, entry.name, 'v36');
        try { await stat(v36); } catch { continue; }
        const screenshotDirectory = path.join(v36, 'BROWSER_ACCEPTANCE');
        await mkdir(screenshotDirectory.replace(v36, path.join(to, 'artifacts', 'v36')), { recursive: true });
        for (const file of curatedBrowserScreenshots) {
          const source = path.join(screenshotDirectory, file);
          try { await stat(source); } catch { throw new Error(`Required curated screenshot is missing: ${file}`); }
          await cp(source, path.join(to, 'artifacts', 'v36', 'BROWSER_ACCEPTANCE', file));
        }
        continue;
      }
      await copyProject(path.join(from, entry.name), path.join(to, entry.name), rel);
    } else if (entry.isFile()) {
      if (skipFiles.has(entry.name) || entry.name.endsWith('.zip')) continue;
      if (entry.name.startsWith('.env') && entry.name !== '.env.example') continue;
      const target = path.join(to, entry.name);
      await mkdir(path.dirname(target), { recursive: true });
      await cp(path.join(from, entry.name), target);
    }
  }
}

await copyProject(root, stage);

const stageCopy = async (source, target) => {
  const targetPath = path.join(stage, target);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await cp(path.join(root, source), targetPath, { recursive: true });
};
const readJsonAtRoot = async relative => JSON.parse(await readFile(path.join(root, relative), 'utf8'));
const writeStage = async (relative, contents) => {
  const target = path.join(stage, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents, 'utf8');
};
const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;

// Preserve the project-root source layout for a directly runnable extraction,
// and also expose the requested reviewer-friendly evidence tree.
await stageCopy('docs/v36/baseline/BASELINE_HEAD_AND_DIFF.md', 'BASELINE_HEAD_AND_DIFF.md');
for (const [source, target] of [
  ['rpg', 'src/rpg'],
  ['api', 'src/api'],
  ['server.mjs', 'src/server.mjs'],
  ['package.json', 'config/package.json'],
  ['package-lock.json', 'config/package-lock.json'],
  ['vercel.json', 'config/vercel.json'],
  ['.env.example', 'config/.env.example'],
  ['rpg/maps', 'maps'],
  ['rpg/characters', 'npc'],
  ['rpg/assets', 'assets'],
  ['rpg/quests', 'quests'],
  ['rpg/data/historical-source-packets.json', 'historical/historical-source-packets.json'],
  ['rpg/data/historical-claim-ledger.json', 'historical/historical-claim-ledger.json'],
  ['rpg/data/historical-comparisons.json', 'historical/historical-comparisons.json'],
  ['rpg/data/source-register.json', 'historical/source-register.json'],
  ['rpg/data/city-districts-v36.json', 'historical/city-districts-v36.json'],
  ['docs/v36/historical-map-source-register.json', 'historical/historical-map-source-register.json'],
]) await stageCopy(source, target);

const residentFiles = (await readdir(path.join(root, 'rpg/characters'))).filter(file => file.endsWith('.json'));
const residents = (await Promise.all(residentFiles.map(async file => readJsonAtRoot(`rpg/characters/${file}`))))
  .filter(card => card.kind === 'FICTIONAL' && !card.id.startsWith('literary_'))
  .sort((a, b) => a.id.localeCompare(b.id));
const scheduleRows = [['resident_id', 'slot_minute', 'map_id', 'x', 'y', 'activity_ko', 'task_type', 'task_id', 'recipient_host_id']];
for (const card of residents) for (const slot of card.schedule ?? []) scheduleRows.push([
  card.id, slot.atMinute, slot.mapId, slot.position?.x, slot.position?.y, slot.activityKo,
  slot.task?.type, slot.task?.id, slot.task?.recipientHostId,
]);
await writeStage('qa/36_NPC_DAILY_SCHEDULES.csv', `${scheduleRows.map(row => row.map(csvCell).join(',')).join('\n')}\n`);
await stageCopy('docs/v36/current-audit/FULL_DAY_36_RESIDENT_REPLAY.json', 'qa/36_NPC_24H_REPLAY.json');
await stageCopy('docs/v36/current-audit/MAP_GRAPH_AUDIT.json', 'qa/MAP_NAVIGATION_AND_ACCESS.json');
await stageCopy('docs/v36/current-audit/ASSET_AUDIT.csv', 'qa/ASSET_REVIEW_MANIFEST.csv');
await stageCopy('docs/v36/current-audit/PERSONAL_LIFE_CHAIN_ACCEPTANCE.json', 'qa/36_RESIDENT_LIFE_CHAIN_REPLAY.json');
const questFiles = (await readdir(path.join(root, 'rpg/quests'))).filter(file => file.endsWith('.json'));
const quests = (await Promise.all(questFiles.map(async file => readJsonAtRoot(`rpg/quests/${file}`))))
  .filter(quest => Array.isArray(quest.actions) && quest.historicalOutcome?.id && quest.entry?.requiredHostId);
const chainReplay = await readJsonAtRoot('docs/v36/current-audit/PERSONAL_LIFE_CHAIN_ACCEPTANCE.json');
const replayedQuestIds = new Set((chainReplay.playedResidentArcs ?? []).flatMap(row => row.stageQuestIds ?? []));
const questRows = [['resident_id', 'life_chain_id', 'stage', 'quest_id', 'map_id', 'object_id', 'choice_count', 'prerequisite_ids', 'social_partner_id', 'full_three_stage_arc_replayed']];
for (const quest of quests.sort((a, b) => a.entry.requiredHostId.localeCompare(b.entry.requiredHostId) || String(a.lifeChain?.id ?? a.id).localeCompare(String(b.lifeChain?.id ?? b.id)) || (a.lifeChain?.stage ?? 0) - (b.lifeChain?.stage ?? 0))) {
  questRows.push([quest.entry.requiredHostId, quest.lifeChain?.id, quest.lifeChain?.stage, quest.id, quest.entry.mapId,
    quest.entry.objectId, quest.actions.length, (quest.prerequisiteQuestIds ?? []).join('|'), quest.socialChain?.partnerHostId,
    replayedQuestIds.has(quest.id) ? 'YES' : 'NOT_IN_36_RESIDENT_ARC_REPLAY']);
}
await writeStage('qa/QUEST_COMPLETION_MATRIX.csv', `${questRows.map(row => row.map(csvCell).join(',')).join('\n')}\n`);

for (const [source, target] of [
  ['docs/v36/current-audit/screenshots/world-map-tour-verified/desktop-1440x900-nevsky.png', 'screenshots/desktop-1440x900-nevsky.png'],
  ['docs/v36/current-audit/screenshots/world-map-tour-verified/laptop-1366x768-nevsky.png', 'screenshots/laptop-1366x768-nevsky.png'],
  ['docs/v36/current-audit/screenshots/world-map-tour-verified/mobile-390x844-nevsky.png', 'screenshots/mobile-390x844-nevsky.png'],
  ['docs/v36/current-audit/screenshots/world-map-tour-verified/mobile-360x800-nevsky.png', 'screenshots/mobile-360x800-nevsky.png'],
  ['docs/v36/current-audit/reader-opinion-quest-click.png', 'screenshots/opinion-board-and-quest.png'],
  ['docs/v36/current-audit/screenshots/resident-batch-1-quest-choices.png', 'screenshots/resident-batch-1-quest.png'],
  ['docs/v36/current-audit/screenshots/resident-batch-2-quest-choices.png', 'screenshots/resident-batch-2-quest.png'],
  ['docs/v36/current-audit/screenshots/resident-batch-3-quest-choices.png', 'screenshots/resident-batch-3-quest.png'],
  ['docs/v36/current-audit/screenshots/resident-batch-4-quest-choices.png', 'screenshots/resident-batch-4-quest.png'],
  ['docs/v36/current-audit/screenshots/resident-batch-5-quest-choices.png', 'screenshots/resident-batch-5-quest.png'],
  ['docs/v36/current-audit/screenshots/resident-batch-6-quest-choices.png', 'screenshots/resident-batch-6-quest.png'],
  ...curatedBrowserScreenshots.map(file => [`artifacts/v36/BROWSER_ACCEPTANCE/${file}`, `screenshots/endings/${file}`]),
]) await stageCopy(source, target);

const finalStatus = `# V36 status — current audited state\n\nThis is an honest progress snapshot, not a completion declaration. The integrated gate is evidence for the listed checks only; it does not override the blockers below.\n\n` +
`V36_36_ACTIVE_CITIZENS: YES\nV36_30_POSSESSABLE: YES\nV36_NPC_INDEPENDENT_DAILY_GOALS: YES\nV36_6_DISTRICTS_8_INTERIORS: YES\nV36_ASSETS_AND_PERIOD_EVIDENCE: NO\nV36_OPENWORLD_CONTENT: YES\nV36_5_ENDINGS: YES\nV36_VERIFIABLE_BUILD: YES\nV36_BROWSER_QA: YES\nV36_GPU_PERFORMANCE: UNVERIFIED\nINDEPENDENT_REVIEW: COMPLETE_WITH_P2_FOLLOWUP\nHUMAN_PLAYTEST: PENDING\nV36_COMPLETE: NO\n\n` +
`## Remaining work\n\n- The observed-event audit covers 12 player-visible state-change families: 9 witnessed autonomous resident behaviors (routine changes, movement, daily plans, personal-life visits, neighbor meetings, deliveries, exchanges, meals, and rest) plus 3 civic consequences (shop purchases change carried goods and money, street circulation moves a printed issue to a public audience, and witnessed misconduct can trigger custody). Each civic event is verified as both a state change and a journal entry.\n- The 36-resident daily-goal gate requires every resident to log a non-schedule choice in a deterministic 24-hour replay; utility tests prove livelihood policy changes, personal appointments, urgent rest, meals, and named social goals alter the selected action and state.\n- Period evidence is scoped and honest about fictional/non-georeferenced areas, but the full role, access, and environment-art claim audit still needs independent source-by-source review.\n- GPU-specific frame-time verification and human playtesting are not available in this run.\n- Vercel Production key/configuration and deployed generation remain outside this local evidence package.\n\nThe positive counts are backed by the included roster, route, quest, map, asset, world-reaction, and browser evidence. A NO or UNVERIFIED value above is intentional and prevents V36_COMPLETE: YES.\n`;
await writeStage('V36_FINAL_STATUS.md', finalStatus);
await stageCopy('docs/v36/INDEPENDENT_REVIEW_P1_FOLLOWUP.md', 'qa/INDEPENDENT_REVIEW.md');
await writeStage('qa/INDEPENDENT_REVIEW_STATUS.md', '# Independent review status\n\nA fresh read-only adversarial review of the current checkout completed on 2026-11-04. It found no P0 issues. Its P1 finding was that the journal verified nine observed autonomous behavior families; this is addressed by adding and testing the shop purchase, public newspaper circulation, and witness-triggered custody consequences as three more visible state-change families. It also found two P2 follow-ups: generated replies still lack a runtime character-style quality gate, and NARRATION beats were mislabeled as NPC speech. The UI now labels NARRATION as “주변 상황”; generated-style naturalness remains unverified.\n\nThis review did not audit every historical asset or role/access claim source by source. GPU frame-time measurement, human playtesting, and deployed Vercel production verification also remain outstanding. V36 completion remains NO.\n');

const files = (await listFiles(stage)).filter(file => file !== manifestName).sort();
const lines = [];
for (const relative of files) lines.push(`${await digest(path.join(stage, ...relative.split('/')))}  ${relative}`);
await writeFile(path.join(stage, manifestName), `${lines.join('\n')}\n`, 'utf8');
await writeFile(path.join(stage, 'manifest.sha256'), `${lines.join('\n')}\n`, 'utf8');
const escapedStage = stage.replaceAll("'", "''");
const escapedArchive = archivePath.replaceAll("'", "''");
execFileSync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${escapedStage}\\*' -DestinationPath '${escapedArchive}' -Force`], { stdio: 'inherit' });
const archiveSize = (await stat(archivePath)).size;
if (archiveSize > 95 * 1024 * 1024) throw new Error(`Evidence ZIP exceeds 95 MiB Git hosting safety budget: ${archiveSize}`);
console.log(JSON.stringify({ status: 'PASS', archive: archivePath, archiveBytes: archiveSize, sourceFiles: files.length,
  curatedBrowserScreenshots: curatedBrowserScreenshots.length, credentialsExcluded: true,
  envLocalExcluded: true, gitExcluded: true, nodeModulesExcluded: true }));
await rm(stage, { recursive: true, force: true });
