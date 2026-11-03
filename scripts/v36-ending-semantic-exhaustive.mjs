import fs from 'node:fs';
import { chromium } from 'playwright';

const baseUrl = process.env.CHANCERY_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${baseUrl}/chancery.html?main20=1#v36-exhaustive`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__main20?.resolveEndingDetailedFor));
  const report = await page.evaluate(() => {
    const data = window.__main20.data;
    const scenes = data.scenes;
    const endingIds = data.endings.map(ending => ending.id);
    const counts = Object.fromEntries(endingIds.map(id => [id, 0]));
    const mixed = Object.fromEntries(endingIds.map(id => [id, []]));
    const canonicalRoutes = {};
    const tieReasons = {};
    const tieSamples = {};
    let totalRoutes = 0, noEndingCount = 0, multiEndingCount = 0, arrayOrderFallbackCount = 0;
    const routeSource = route => {
      const source = { history: [], flags: [], relationships: { alexei: 0, ekaterina: 0, pavel: 0 } };
      for (let i = 0; i < scenes.length; i += 1) for (const kind of ['pre_read_choice', 'post_read_choice']) {
        const choice = kind === 'pre_read_choice' ? scenes[i].choices[route[i][0]] : scenes[i].postChoices[route[i][1]];
        source.history.push({ sceneId: scenes[i].id, kind, action: choice.action, flags: choice.flagsAdd || [], endingAffinity: choice.endingAffinity || {}, actor: choice.actor, witnesses: choice.witnesses, visibility: choice.visibility });
        source.flags.push(...(choice.flagsAdd || []));
        for (const [person, amount] of Object.entries(choice.relationship || {})) source.relationships[person] += amount;
      }
      source.flags = [...new Set(source.flags)];
      return source;
    };
    const visit = (depth, route) => {
      if (depth < scenes.length) {
        for (let first = 0; first < scenes[depth].choices.length; first += 1) {
          for (let post = 0; post < scenes[depth].postChoices.length; post += 1) visit(depth + 1, [...route, [first, post]]);
        }
        return;
      }
      totalRoutes += 1;
      const detail = window.__main20.resolveEndingDetailedFor(routeSource(route));
      if (!detail?.endingId) { noEndingCount += 1; return; }
      if ((detail.strongMatches || []).length > 1) multiEndingCount += 1;
      if (detail.arrayOrderFallback) arrayOrderFallbackCount += 1;
      counts[detail.endingId] += 1;
      const isCanonical = !canonicalRoutes[detail.endingId];
      canonicalRoutes[detail.endingId] ??= route;
      if (detail.tieBreak) {
        tieReasons[detail.tieBreak] = (tieReasons[detail.tieBreak] || 0) + 1;
        tieSamples[detail.tieBreak] ??= [];
        if (tieSamples[detail.tieBreak].length < 5) tieSamples[detail.tieBreak].push({ route, endingId: detail.endingId, tieProfile: detail.tieProfile, scores: detail.scores, supportCounts: detail.supportCounts, e07Affinity: detail.e07Affinity, supportingActions: detail.supportingActions });
      }
      if (!isCanonical && mixed[detail.endingId].length < 10) mixed[detail.endingId].push({ route, endingId: detail.endingId, tieBreak: detail.tieBreak, supportingActions: detail.supportingActions });
    };
    visit(0, []);
    return { sceneIds: scenes.map(scene => scene.id), choiceShape: scenes.map(scene => [scene.choices.length, scene.postChoices.length]), endingIds, totalRoutes, counts, noEndingCount, multiEndingCount, arrayOrderFallbackCount, tieReasons, tieSamples, mixedCounts: Object.fromEntries(endingIds.map(id => [id, mixed[id].length])), mixed, canonicalRoutes };
  });
  report.schemaVersion = 'V36-ENDING-SEMANTIC-EXHAUSTIVE-2';
  report.status = report.totalRoutes > 0 && report.noEndingCount === 0 && report.multiEndingCount === 0 && report.arrayOrderFallbackCount === 0
    && report.endingIds.every(id => report.counts[id] > 0 && report.mixedCounts[id] >= 10 && report.canonicalRoutes[id]);
  fs.mkdirSync('docs/v36', { recursive: true });
  fs.writeFileSync('docs/v36/ENDING_SEMANTIC_EXHAUSTIVE.json', `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status ? 'PASS' : 'FAIL', scenes: report.sceneIds, totalRoutes: report.totalRoutes, counts: report.counts, noEnding: report.noEndingCount, multiEnding: report.multiEndingCount, arrayOrderFallback: report.arrayOrderFallbackCount, mixedCounts: report.mixedCounts }, null, 2));
  if (!report.status) process.exitCode = 1;
} finally {
  await browser.close();
}
