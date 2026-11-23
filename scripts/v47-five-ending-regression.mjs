import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { additionalEndingRoutes, buildRoute } from './v33-ending-route-matrix.mjs';

const root = process.cwd();
const endingIds = ['UVAROV', 'BELINSKY', 'HERZEN', 'KHOMYAKOV', 'DOSTOEVSKY_PETRASHEVSKY'];
const routes = endingIds.map(endingId => {
  const result = buildRoute(endingId, 0);
  assert.equal(result.endingState.endingId, endingId, `${endingId} resolves to its authored ending`);
  assert.equal(result.endingState.world.immutableOutcomes.PETRASHEVSKY_ARRESTS_1849,
    'the documented arrests and sentences remain fixed historical outcomes', `${endingId} preserves fixed history`);
  assert.ok(result.summary.hosts.length >= 4, `${endingId} carries multi-possession history`);
  assert.ok(result.summary.sourcesRead.length >= 3, `${endingId} retains source reads`);
  return { endingId, routeVariant: 0, resultingEnding: result.endingState.endingId,
    hostCount: result.summary.hosts.length, sourceCount: result.summary.sourcesRead.length,
    circleLearning: result.summary.circleLearning, examOutcome: result.summary.examOutcome,
    promotionStatus: result.summary.promotionStatus, finalDate: result.summary.date };
});
assert.deepEqual(new Set(routes.map(route => route.resultingEnding)), new Set(endingIds));
const restoredRoutes = additionalEndingRoutes.map(({ endingId, choices }) => {
  const { endingState, summary } = buildRoute(endingId, 0, choices);
  assert.deepEqual(summary.actions, [choices.action1, choices.action2, choices.action4, choices.action3]);
  assert.equal(endingState.endingId, endingId);
  return { endingId, actions: summary.actions, sourcesRead: summary.sourcesRead, finalDate: summary.date };
});
const report = { schemaVersion: 'V47_FIVE_ENDING_REGRESSION_V2', status: 'PASS',
  scope: 'one reducer route per authored ending and the four restored decision sequences', routes, restoredRoutes };
await mkdir(path.join(root, 'artifacts/v47/ENDING_REGRESSION'), { recursive: true });
await writeFile(path.join(root, 'artifacts/v47/ENDING_REGRESSION/V47_FIVE_ENDING_REGRESSION.json'),
  `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
