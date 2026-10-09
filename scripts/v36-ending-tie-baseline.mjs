import fs from 'node:fs';

const data = JSON.parse(fs.readFileSync('narrative/MAIN_20MIN_DIALOGUE.json', 'utf8'));
const ids = data.scenes.map((scene) => scene.id);
const shape = data.scenes.map((scene) => [scene.choices.length, scene.postChoices.length]);
const allChoices = data.scenes.flatMap((scene) => [...scene.choices, ...scene.postChoices]);
const choiceForAction = (action) => allChoices.find((choice) => choice.action === action);
const matches = (rule, source) => {
  const actions = new Set(source.history.map((item) => item.action));
  const requiredActions = rule.requiredActions || rule.actionsAll || [];
  const forbiddenActions = rule.forbiddenActions || rule.noneFlags || [];
  const gate = rule.relationshipGate || rule.minRelationships;
  const relationshipsOk = !gate || Object.entries(gate).every(([person, amount]) => (source.relationships[person] || 0) >= amount);
  return (!rule.allFlags || rule.allFlags.every((flag) => source.flags.includes(flag))) && (!rule.noneFlags || !rule.noneFlags.some((flag) => source.flags.includes(flag))) && (!rule.anyFlags || rule.anyFlags.some((flag) => source.flags.includes(flag))) && requiredActions.every((action) => actions.has(action)) && !forbiddenActions.some((item) => actions.has(item) || source.flags.includes(item)) && relationshipsOk && (!rule.minScenes || source.history.filter((item) => item.kind === 'post_read_choice').length >= rule.minScenes);
};
const sourceFor = (route) => {
  const source = { history: [], flags: [], relationships: { alexei: 0, ekaterina: 0, pavel: 0 } };
  for (let i = 0; i < data.scenes.length; i += 1) for (const kind of ['pre_read_choice', 'post_read_choice']) {
    const choice = kind === 'pre_read_choice' ? data.scenes[i].choices[route[i][0]] : data.scenes[i].postChoices[route[i][1]];
    source.history.push({ sceneId: ids[i], kind, action: choice.action, flags: choice.flagsAdd || [], endingAffinity: choice.endingAffinity || {} });
    source.flags.push(...(choice.flagsAdd || []));
    for (const [person, amount] of Object.entries(choice.relationship || {})) source.relationships[person] += amount;
  }
  source.flags = [...new Set(source.flags)];
  return source;
};
const currentResolve = (source) => {
  const endingIds = data.endings.map((ending) => ending.id);
  const scores = Object.fromEntries(endingIds.map((id) => [id, 0]));
  const supporting = Object.fromEntries(endingIds.map((id) => [id, []]));
  for (const item of source.history) for (const id of endingIds) {
    const value = Number((item.endingAffinity || choiceForAction(item.action)?.endingAffinity || {})[id] || 0);
    scores[id] += value;
    if (value > 0) supporting[id].push(item.action);
  }
  for (const ending of data.endings) {
    const gate = ending.rule.relationshipGate || ending.rule.minRelationships || {};
    const satisfied = Object.entries(gate).every(([person, amount]) => (source.relationships[person] || 0) >= amount);
    if (satisfied) scores[ending.id] += 2;
    else for (const [person, amount] of Object.entries(gate)) scores[ending.id] += Math.min(1, (source.relationships[person] || 0) / Math.max(1, amount));
    for (const item of source.history) if ((ending.rule.forbiddenActions || ending.rule.noneFlags || []).some((value) => value === item.action || (item.flags || []).includes(value))) scores[ending.id] -= 2;
  }
  const strongMatches = data.endings.filter((ending) => matches(ending.rule, source)).map((ending) => ending.id);
  const pool = strongMatches.length ? strongMatches : endingIds;
  const recent = source.history.at(-1)?.action;
  const ranked = [...pool].sort((a, b) => (scores[b] - scores[a]) || ((supporting[b].at(-1) === recent ? 1 : 0) - (supporting[a].at(-1) === recent ? 1 : 0)) || endingIds.indexOf(a) - endingIds.indexOf(b));
  return { endingId: ranked[0], scores, supporting, strongMatches, pool };
};
const stats = { totalRoutes: 0, noEnding: 0, strongGateRoutes: 0, multiStrongGate: 0, scoreUnique: 0, recentObservableTie: 0, arrayOrderOnly: 0, tieSize: {} };
const samples = { arrayOrderOnly: [], recentObservableTie: [] };
const visit = (depth, route) => {
  if (depth === data.scenes.length) {
    stats.totalRoutes += 1;
    const source = sourceFor(route); const detail = currentResolve(source);
    if (!detail.endingId) stats.noEnding += 1;
    if (detail.strongMatches.length) stats.strongGateRoutes += 1;
    if (detail.strongMatches.length > 1) stats.multiStrongGate += 1;
    const top = Math.max(...detail.pool.map((id) => detail.scores[id])); const tied = detail.pool.filter((id) => detail.scores[id] === top);
    let category = 'scoreUnique';
    if (tied.length > 1) {
      stats.tieSize[tied.length] = (stats.tieSize[tied.length] || 0) + 1;
      const recent = source.history.at(-1)?.action;
      const recentCandidates = tied.filter((id) => detail.supporting[id].at(-1) === recent);
      category = recentCandidates.length === 1 ? 'recentObservableTie' : 'arrayOrderOnly';
    }
    stats[category] += 1;
    if (category !== 'scoreUnique' && samples[category].length < 5) samples[category].push({ route, endingId: detail.endingId, pool: detail.pool, scores: detail.scores, supporting: detail.supporting, recentAction: source.history.at(-1)?.action });
    return;
  }
  for (let first = 0; first < shape[depth][0]; first += 1) for (let post = 0; post < shape[depth][1]; post += 1) visit(depth + 1, [...route, [first, post]]);
};
visit(0, []);
const report = { schemaVersion: 'V36-TIE-BASELINE-1', status: stats.noEnding === 0 && stats.totalRoutes === 104976 ? 'PASS' : 'FAIL', stats, samples };
fs.mkdirSync('docs/v36', { recursive: true });
fs.writeFileSync('docs/v36/ENDING_TIE_BASELINE.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
