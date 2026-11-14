import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifactDir = path.join(root, 'artifacts', 'v47');
const archiveName = 'RUSSIAN_LIVES_V47_THREE_MAIN_EVENTS_IMPLEMENTED.zip';
const archivePath = path.join(artifactDir, archiveName);
const tempRoot = path.join(os.tmpdir(), `russian-lives-v47-${process.pid}`);
const stage = path.join(tempRoot, 'package');
const verify = path.join(tempRoot, 'verify');
const sha = async file => createHash('sha256').update(await readFile(file)).digest('hex');

await rm(tempRoot, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
const excludedDirs = new Set(['.git', 'node_modules', '.vercel', '.superpowers', 'coverage', 'dist', '.tmp-v47-input']);
const copyTree = async (from, to, rel = '') => {
  for (const entry of await readdir(from, { withFileTypes: true })) {
    const child = path.posix.join(rel, entry.name);
    if (child === 'artifacts') {
      const target = path.join(stage, 'artifacts', 'v47');
      await mkdir(target, { recursive: true });
      const source = path.join(root, 'artifacts', 'v47');
      for (const item of await readdir(source, { withFileTypes: true })) {
        if (item.name === 'package-stage' || item.name.endsWith('.zip') || item.name.endsWith('.tmp')) continue;
        const fromItem = path.join(source, item.name), toItem = path.join(target, item.name);
        if (item.isDirectory()) await cp(fromItem, toItem, { recursive: true });
        else if (item.isFile() && item.name !== 'BUILD.log') await cp(fromItem, toItem);
      }
      continue;
    }
    if (entry.isDirectory()) {
      if (excludedDirs.has(entry.name)) continue;
      await mkdir(path.join(to, entry.name), { recursive: true });
      await copyTree(path.join(from, entry.name), path.join(to, entry.name), child);
    } else if (entry.isFile() && entry.name !== '.git' && !entry.name.endsWith('.zip')
      && !(entry.name.startsWith('.env') && entry.name !== '.env.example')) {
      await mkdir(path.dirname(path.join(to, entry.name)), { recursive: true });
      await cp(path.join(from, entry.name), path.join(to, entry.name));
    }
  }
};

await copyTree(root, stage);
const packageStatus = {
  package: archiveName,
  completionStatus: 'PARTIAL — normal and alternate story routes, the physical printwork puzzle, responsive choices, five-ending causality, and a date-aligned four-day no-player survival replay are verified; 14-day survival, archival page-image collation, and independent human playtest remain open',
  included: ['full source code and Vercel static build dist-v33', 'V47 seed bundle and 36-beat story/role data',
    'maps and role assets', 'source registry, source excerpts, access-date index, and historical claim ledger',
    'current implementation/QA report', '23 seeded browser choice cases and desktop/mobile screenshots',
    'normal and alternate 36-beat full browser campaign logs, with 12 campaign screenshots and the seven-step printwork sequence exercised by real clicks',
    'deterministic date-aligned four-day no-player cholera simulation with 79 meal events, 27 cholera exposures, and zero fictional food-deprivation deaths',
    'resolved alternate navigation diagnosis', 'three autonomous NPC event replay logs',
    'five representative ending regression routes, causal choice-to-ending regression, and exhaustive 121-route ending matrix', 'checksums for all packaged files'],
  browser: { latestRun: 'PASS_NORMAL_AND_ALTERNATE_FULL_ROUTES', freshViewportRecheck: 'PASS', plannedScenarios: 23, completedScenarios: 23,
    fullCampaign: { normal: 'PASS_36_OF_36', alternate: 'PASS_36_OF_36_LATEST_RUN', normalDistinctHosts: { MAIN01: 9, MAIN03: 11, MAIN05: 8 }, alternateDistinctHosts: { MAIN01: 9, MAIN03: 10, MAIN05: 8 },
      residentYieldExitDiagnosis: 'RESOLVED_AT_MAIN01_A05', pageErrors: 0, screenshotsPerRoute: 6,
      currentTransitions: { normal: 95, alternate: 89 },
      fixedHistoricalOutcome: 'COMMUTATION_ANNOUNCED' },
    firstDateAdvance: 'PASS_1849-03-20_TO_1849-04-01', optionalCoda: 'PASS_1849-12-22_TO_1850-01-03',
    seededScenePageErrors: 0, seededViewportOverflow: 0,
    selectedChoiceInViewport: 'PASS_23_OF_23', viewportAssertionRun: 'PASS' },
  chronologicalReplay: { normalBeats: 36, alternateBeats: 36, unattendedNpcEvents: 3,
    npcOutcomes: ['V47_MAIN01_A03', 'V47_MAIN03_P03', 'V47_MAIN05_C01'], fullBrowserTraversal: 'PASS_WITH_ROUTE_QUALIFICATIONS' },
  endings: { distinctEndings: 5, representativeReducerRoutes: 5, representativeStatus: 'PASS', v47ChoiceCausality: 'PASS_ALL_FIVE_ENDINGS', v47ChoiceBranches: ['V47_A01_OPEN_SUBSCRIBER_LEDGER', 'V47_A01_SEND_PAVEL_TO_PRINTSHOP'], v47Report: 'scripts/v47-ending-consequence-test.mjs', exhaustive121VectorMatrix: 'PASS', matrixReport: 'artifacts/v33/ENDING_ROUTE_MATRIX.json', routeCount: 121, legalActionVectorCount: 23 },
  noPlayerSimulation: { days: 4, deterministic: true, datesAlignedToWorldClock: true, foodDeprivationDeaths: 0, totalMeals: 79,
    choleraExposures: 27, choleraDeaths: 0, sevenDayArtifactFoodDeaths: 0,
    fourteenDayArtifactFoodDeaths: 19, fourteenDayArtifactLegacyPassFlagAccepted: false,
    currentFourteenDayRerun: 'INTERRUPTED_BEFORE_RESULT',
    status: 'PARTIAL; FOURTEEN_DAY_SURVIVAL_GATE_OPEN',
    report: 'artifacts/v47/14_DAY_SIMULATION/V47_4_DAY_NO_PLAYER_REPLAY.json',
    accessDiagnostic: 'artifacts/v47/FOOD_TRACE_1D_AFTER_PUBLIC_SOUP.json' },
  historicalSources: { status: 'PARTIAL', pageImageCollationPending: true,
    policy: 'unverified archive/image claims remain explicitly qualified; no complete historical source verification is claimed' },
  secretsExcluded: true,
};
await writeFile(path.join(stage, 'V47_PACKAGE_STATUS.json'), `${JSON.stringify(packageStatus, null, 2)}\n`);
const list = async (directory, prefix = '') => {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await list(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
};
const files = (await list(stage)).sort();
const sums = [];
for (const relative of files) sums.push(`${await sha(path.join(stage, ...relative.split('/')))}  ${relative}`);
await writeFile(path.join(stage, 'SHA256SUMS.txt'), `${sums.join('\n')}\n`);
await mkdir(artifactDir, { recursive: true });
execFileSync('tar.exe', ['-a', '-c', '-f', archivePath, '-C', stage, '.'], { stdio: 'inherit' });

const extractedFiles = await rm(verify, { recursive: true, force: true }).then(async () => {
  await mkdir(verify, { recursive: true });
  execFileSync('tar.exe', ['-xf', archivePath, '-C', verify], { stdio: 'inherit' });
  return (await readFile(path.join(verify, 'SHA256SUMS.txt'), 'utf8')).trim().split(/\r?\n/).filter(Boolean);
});
for (const line of extractedFiles) {
  const [expected, relative] = line.split('  ', 2);
  if (!expected || !relative || path.isAbsolute(relative) || relative.split('/').includes('..')) throw new Error(`Invalid checksum row: ${line}`);
  if (expected !== await sha(path.join(verify, ...relative.split('/')))) throw new Error(`Archive checksum mismatch: ${relative}`);
}
const bytes = (await stat(archivePath)).size;
await rm(tempRoot, { recursive: true, force: true });
console.log(JSON.stringify({ status: 'PASS', archivePath, archiveBytes: bytes, verifiedFiles: extractedFiles.length, secretsExcluded: true, completionStatus: packageStatus.completionStatus }));
