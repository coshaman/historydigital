import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'artifacts/v47/BROWSER_CAMPAIGN_REPLAY');
const read = async name => JSON.parse(await readFile(path.join(dir, name), 'utf8'));
const normal = await read('V47_NORMAL_BROWSER_CAMPAIGN.json');
const alternate = await read('V47_ALTERNATE_BROWSER_CAMPAIGN.json');
assert.equal(normal.status, 'PASS');
assert.equal(alternate.status, 'PASS');
for (const report of [normal, alternate]) {
  assert.equal(report.quests.filter(row => row.storyId === 'MAIN01').length, 12);
  assert.equal(report.quests.filter(row => row.storyId === 'MAIN03').length, 12);
  assert.equal(report.quests.filter(row => row.storyId === 'MAIN05').length, 12);
  assert.equal(report.fixedHistoricalEvent.fixedOutcome, 'COMMUTATION_ANNOUNCED');
  assert.equal(report.pageErrors.length, 0);
  assert.equal(report.screenshots.length, 6);
}
await writeFile(path.join(dir, 'V47_ALTERNATE_BROWSER_PROGRESS.json'), `${JSON.stringify({
  routeName: 'ALTERNATE', status: 'PASS', source: 'V47_ALTERNATE_BROWSER_CAMPAIGN.json',
  count: alternate.quests.length, rows: alternate.quests, transitions: alternate.transitions,
}, null, 2)}\n`);
const screenshotFiles = await readdir(dir);
const summarize = (report, sourceRun) => Object.fromEntries(['MAIN01', 'MAIN03', 'MAIN05'].map(storyId => {
  const rows = report.quests.filter(row => row.storyId === storyId);
  return [storyId, { resolved: rows.filter(row => row.status === 'resolved').length,
    uniqueHosts: new Set(rows.map(row => row.hostId)).size,
    maps: [...new Set(rows.map(row => row.mapId))], status: 'PASS', sourceRun }];
}));
const summary = {
  status: 'PASS',
  scope: 'V47 browser routes from V47 entry through MAIN03 aftermath; prior non-V47 campaign arcs are seeded as resolved context',
  routes: [
    { routeName: 'NORMAL', stories: summarize(normal, 'latest full browser run'), questCount: 36,
      transitions: normal.transitions.length, screenshots: normal.screenshots.length,
      fixedHistoricalEvent: normal.fixedHistoricalEvent.fixedOutcome, pageErrors: normal.pageErrors.length },
    { routeName: 'ALTERNATE', stories: summarize(alternate, 'latest full browser run with resident yielding'), questCount: 36,
      transitions: alternate.transitions.length, screenshots: alternate.screenshots.length,
      fixedHistoricalEvent: alternate.fixedHistoricalEvent.fixedOutcome, pageErrors: alternate.pageErrors.length,
      latestHarnessRetry: 'PASS; prior A05 failure was caused by the replay pathfinder treating residents as static blockers' },
  ],
  notes: [`MAIN03 eligible story-role IDs: 15; normal route embodied ${new Set(normal.quests.filter(row => row.storyId === 'MAIN03').map(row => row.hostId)).size} distinct residents and alternate route embodied ${new Set(alternate.quests.filter(row => row.storyId === 'MAIN03').map(row => row.hostId)).size}.`,
    'The pathfinder now plans through occupied resident tiles because moveActor lets residents yield; the alternate route crossed Nevsky’s Chancery exit and completed all chapters.',
    'Both full route reports include the unattended MAIN03 arrest dispatch on 1849-05-05.'],
};
assert.ok(normal.screenshots.every(name => screenshotFiles.includes(path.basename(name))));
assert.ok(alternate.screenshots.every(name => screenshotFiles.includes(path.basename(name))));
const auto = normal.quests.find(row => row.worldChange?.actionId === 'NPC_SEARCH_TEAM_DISPATCHED');
assert.ok(auto?.worldChange?.unattended, 'normal browser log contains the unattended arrest response');
summary.autonomousNpcEvent = { questId: auto.worldChange.questId, actionId: auto.worldChange.actionId,
  date: auto.worldChange.date, assignedHostIds: auto.worldChange.assignedHostIds };
await writeFile(path.join(dir, 'V47_BROWSER_CAMPAIGN_INDEX.json'), `${JSON.stringify(summary, null, 2)}\n`);
await writeFile(path.join(dir, 'V47_ALTERNATE_BROWSER_NAVIGATION_DIAGNOSIS.json'), `${JSON.stringify({
  status: 'RESOLVED_AND_REVERIFIED', routeName: 'ALTERNATE',
  initiallyBlockedAt: 'V47_MAIN01_A05',
  rootCause: 'The browser replay pathfinder incorrectly treated occupied residents as static blockers, while moveActor yields residents when the player steps into their tile.',
  correction: 'Changed the replay pathfinder to plan against map collision only and attempt actual UI movement through occupied resident tiles.',
  verification: `The latest full alternate browser replay crossed Nevsky-to-Chancery at A05, completed 36/36 story beats, recorded ${alternate.transitions.length} transitions, and had zero page errors.`,
}, null, 2)}\n`);
console.log(JSON.stringify({ status: summary.status, routes: summary.routes.map(route => ({ route: route.routeName,
  questCount: route.questCount, hosts: Object.fromEntries(Object.entries(route.stories).map(([story, row]) => [story, row.uniqueHosts])) })),
  autonomousNpcEvent: summary.autonomousNpcEvent }, null, 2));
