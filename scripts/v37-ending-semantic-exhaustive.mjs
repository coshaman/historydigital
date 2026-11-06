import fs from 'node:fs';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4173/chancery.html?main20=1#v37-exhaustive', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => Boolean(window.__main20?.resolveEndingDetailedFor));
const report = await page.evaluate(() => {
  const data = window.__main20.data;
  const ids = data.scenes.map((scene) => scene.id);
  const shape = data.scenes.map((scene) => [scene.choices.length, scene.postChoices.length]);
  const endingIds = data.endings.map((ending) => ending.id);
  const actionChoices = new Map(data.scenes.flatMap((scene) => [...scene.choices, ...scene.postChoices].map((choice) => [choice.action, choice])));
  const routeKey = (route) => route.map((pair, index) => {
    if (!Array.isArray(pair)) throw new Error(`Invalid route pair at ${index}: ${JSON.stringify(route)}`);
    return pair.join(':');
  }).join('|');
  const sourceFor = (route) => {
    const source = { history: [], flags: [], relationships: { alexei: 0, ekaterina: 0, pavel: 0 } };
    for (let i = 0; i < data.scenes.length; i += 1) for (const kind of ['pre_read_choice', 'post_read_choice']) {
      const choice = kind === 'pre_read_choice' ? data.scenes[i].choices[route[i][0]] : data.scenes[i].postChoices[route[i][1]];
      source.history.push({ sceneId: ids[i], kind, action: choice.action, flags: choice.flagsAdd || [], endingAffinity: choice.endingAffinity || {} });
      source.flags.push(...(choice.flagsAdd || []));
      for (const [person, value] of Object.entries(choice.relationship || {})) source.relationships[person] += value;
    }
    source.flags = [...new Set(source.flags)];
    return source;
  };
  const satisfies = (rule, source) => {
    const actions = new Set(source.history.map((entry) => entry.action));
    const required = rule.requiredActions || rule.actionsAll || [];
    const forbidden = rule.forbiddenActions || rule.noneFlags || [];
    const gate = rule.relationshipGate || rule.minRelationships || {};
    return (!rule.allFlags || rule.allFlags.every((flag) => source.flags.includes(flag))) &&
      (!rule.noneFlags || rule.noneFlags.every((flag) => !source.flags.includes(flag))) &&
      (!rule.anyFlags || rule.anyFlags.some((flag) => source.flags.includes(flag))) &&
      required.every((action) => actions.has(action)) &&
      !forbidden.some((value) => actions.has(value) || source.flags.includes(value)) &&
      Object.entries(gate).every(([person, amount]) => (source.relationships[person] || 0) >= amount) &&
      (!rule.minScenes || source.history.filter((entry) => entry.kind === 'post_read_choice').length >= rule.minScenes);
  };
  // Independent oracle: compute its own scores, candidate set and sequential set-wise reductions.
  const independentResolve = (source) => {
    const score = Object.fromEntries(endingIds.map((id) => [id, 0]));
    const positiveCount = Object.fromEntries(endingIds.map((id) => [id, 0]));
    const positiveStrength = Object.fromEntries(endingIds.map((id) => [id, 0]));
    const relation = Object.fromEntries(endingIds.map((id) => [id, 0]));
    const finalSceneSupport = Object.fromEntries(endingIds.map((id) => [id, 0]));
    for (const entry of source.history) {
      const affinity = entry.endingAffinity || actionChoices.get(entry.action)?.endingAffinity || {};
      for (const id of endingIds) {
        const amount = Number(affinity[id] || 0);
        score[id] += amount;
        if (amount > 0) { positiveCount[id] += 1; positiveStrength[id] += amount; if (entry.sceneId === 'E07') finalSceneSupport[id] += amount; }
      }
    }
    for (const ending of data.endings) {
      const gate = ending.rule.relationshipGate || ending.rule.minRelationships || {};
      const ratios = Object.entries(gate).map(([person, amount]) => Math.min(1, (source.relationships[person] || 0) / Math.max(1, amount)));
      relation[ending.id] = ratios.length ? ratios.reduce((sum, value) => sum + value, 0) / ratios.length : 0;
      if (ratios.every((value) => value >= 1)) score[ending.id] += 2;
      else for (const [person, amount] of Object.entries(gate)) score[ending.id] += Math.min(1, (source.relationships[person] || 0) / Math.max(1, amount));
      const forbidden = ending.rule.forbiddenActions || ending.rule.noneFlags || [];
      for (const entry of source.history) if (forbidden.some((value) => value === entry.action || (entry.flags || []).includes(value))) score[ending.id] -= 2;
    }
    const eligible = data.endings.filter((ending) => satisfies(ending.rule, source)).map((ending) => ending.id);
    const pool = eligible.length ? eligible : endingIds;
    const bestScore = Math.max(...pool.map((id) => score[id]));
    let remaining = pool.filter((id) => Math.abs(score[id] - bestScore) < 1e-9);
    const topScoreCandidates = [...remaining];
    let reason = remaining.length === 1 ? 'score-unique' : null;
    const narrow = (metric, why) => {
      if (remaining.length < 2) return;
      const max = Math.max(...remaining.map(metric));
      const filtered = remaining.filter((id) => Math.abs(metric(id) - max) < 1e-9);
      if (filtered.length !== remaining.length) { remaining = filtered; reason = why; }
    };
    narrow((id) => positiveCount[id], 'support-count');
    narrow((id) => positiveStrength[id], 'support-strength');
    narrow((id) => relation[id], 'relationship-evidence');
    narrow((id) => finalSceneSupport[id], 'e07-affinity');
    for (let index = source.history.length - 1; index >= 0 && remaining.length > 1; index -= 1) {
      const entry = source.history[index];
      const affinity = entry.endingAffinity || actionChoices.get(entry.action)?.endingAffinity || {};
      const max = Math.max(...remaining.map((id) => Number(affinity[id] || 0)));
      if (max <= 0) continue;
      const filtered = remaining.filter((id) => Math.abs(Number(affinity[id] || 0) - max) < 1e-9);
      if (filtered.length !== remaining.length) { remaining = filtered; reason = 'recent-observable-action'; }
    }
    let profile = null;
    if (remaining.length > 1) {
      const set = new Set(remaining);
      profile = (data.endingTieProfiles || []).find((item) => item.candidates.length === set.size && item.candidates.every((id) => set.has(id)));
      if (profile && set.has(profile.chosenEnding)) { remaining = [profile.chosenEnding]; reason = 'explicit-profile'; }
    }
    const pairwise = (a, b) => {
      if (positiveCount[a] !== positiveCount[b]) return positiveCount[a] > positiveCount[b] ? a : b;
      if (Math.abs(positiveStrength[a] - positiveStrength[b]) > 1e-9) return positiveStrength[a] > positiveStrength[b] ? a : b;
      if (Math.abs(relation[a] - relation[b]) > 1e-9) return relation[a] > relation[b] ? a : b;
      if (Math.abs(finalSceneSupport[a] - finalSceneSupport[b]) > 1e-9) return finalSceneSupport[a] > finalSceneSupport[b] ? a : b;
      for (let index = source.history.length - 1; index >= 0; index -= 1) {
        const entry = source.history[index];
        const affinity = entry.endingAffinity || actionChoices.get(entry.action)?.endingAffinity || {};
        const positive = topScoreCandidates.filter((id) => Number(affinity[id] || 0) > 0);
        if (positive.length === 1) return positive[0];
      }
      const tiedProfile = (data.endingTieProfiles || []).find((item) => item.candidates.length === topScoreCandidates.length && item.candidates.every((id) => topScoreCandidates.includes(id)));
      return tiedProfile?.chosenEnding || a;
    };
    return { endingId: remaining.length === 1 ? remaining[0] : null, legacyPairwiseEnding: topScoreCandidates.length > 1 ? pairwise(topScoreCandidates[0], topScoreCandidates[1]) : topScoreCandidates[0], unresolvedSemanticTie: remaining.length > 1, tieBreak: reason, topScoreCandidates, finalCandidates: remaining, tieProfile: profile?.profile || null };
  };
  const counts = Object.fromEntries(endingIds.map((id) => [id, 0]));
  const mixed = Object.fromEntries(endingIds.map((id) => [id, null]));
  const representativeRoutes = Object.fromEntries(endingIds.map((id) => [id, null]));
  let totalRoutes = 0, semanticMismatch = 0, noEnding = 0, multiEnding = 0, unresolvedSemanticTie = 0, arrayOrderFallback = 0;
  const mismatches = [], legacyMismatchRoutes = [], tieSamples = { first: null, threeWay: null };
  const visit = (depth, route) => {
    if (depth < ids.length) {
      for (let first = 0; first < shape[depth][0]; first += 1) for (let post = 0; post < shape[depth][1]; post += 1) visit(depth + 1, [...route, [first, post]]);
      return;
    }
    totalRoutes += 1;
    const source = sourceFor(route);
    const actual = window.__main20.resolveEndingDetailedFor(source);
    const expected = independentResolve(source);
    if (actual?.endingId !== expected.endingId) { semanticMismatch += 1; if (mismatches.length < 20) mismatches.push({ route, actual: actual?.endingId || null, expected: expected.endingId, remaining: expected.finalCandidates, tieProfile: expected.tieProfile }); }
    if (expected.legacyPairwiseEnding !== expected.endingId && legacyMismatchRoutes.length < 11) legacyMismatchRoutes.push({ route, legacy: expected.legacyPairwiseEnding, expected: expected.endingId, topScoreCandidates: expected.topScoreCandidates });
    if (!actual?.endingId) noEnding += 1;
    if ((actual?.strongMatches || []).length > 1) multiEnding += 1;
    if (expected.unresolvedSemanticTie) unresolvedSemanticTie += 1;
    if (actual?.arrayOrderFallback) arrayOrderFallback += 1;
    if (actual?.endingId) {
      counts[actual.endingId] += 1;
      const key = routeKey(route);
      if (!representativeRoutes[actual.endingId]) representativeRoutes[actual.endingId] = route;
      else if (routeKey(representativeRoutes[actual.endingId]) !== key && !mixed[actual.endingId]) mixed[actual.endingId] = { route, endingId: actual.endingId };
    }
    if (expected.topScoreCandidates.length > 1 && !tieSamples.first) tieSamples.first = { route, candidates: expected.topScoreCandidates, result: expected.endingId };
    if (expected.topScoreCandidates.length >= 3 && !tieSamples.threeWay) tieSamples.threeWay = { route, candidates: expected.topScoreCandidates, result: expected.endingId };
  };
  visit(0, []);
  const expectedRouteCount = shape.reduce((count, [first, post]) => count * first * post, 1);
  return { totalRoutes, expectedRouteCount, sceneIds: ids, semanticMismatch, noEnding, multiEnding, unresolvedSemanticTie, arrayOrderFallback, counts, mixed, representativeRoutes, mismatches, legacyMismatchRoutes, tieSamples };
});
report.schemaVersion = 'V37-INDEPENDENT-ENDING-SEMANTICS-2';
report.status = report.totalRoutes === report.expectedRouteCount && report.semanticMismatch === 0 && report.noEnding === 0 && report.multiEnding === 0 && report.unresolvedSemanticTie === 0 && report.arrayOrderFallback === 0 && Object.values(report.counts).every((count) => count > 0) && Object.values(report.representativeRoutes).every(Boolean) && Object.values(report.mixed).every(Boolean);
fs.mkdirSync('docs/v37', { recursive: true });
fs.writeFileSync('docs/v37/ENDING_SEMANTIC_EXHAUSTIVE.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, sceneIds: report.sceneIds, totalRoutes: report.totalRoutes, semanticMismatch: report.semanticMismatch, noEnding: report.noEnding, multiEnding: report.multiEnding, unresolvedSemanticTie: report.unresolvedSemanticTie, arrayOrderFallback: report.arrayOrderFallback, legacyMismatchRouteCount: report.legacyMismatchRoutes.length, counts: report.counts, mixedRoutes: Object.fromEntries(Object.entries(report.mixed).map(([id, item]) => [id, Boolean(item)])), representativeRoutes: report.representativeRoutes, tieSamples: report.tieSamples, examples: report.mismatches.slice(0, 5) }, null, 2));
await browser.close();
if (!report.status) process.exit(1);
