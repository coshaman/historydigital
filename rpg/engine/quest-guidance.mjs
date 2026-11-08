import { questPrerequisitesMet } from './world-presentation.mjs';

const propsOf = object => Object.fromEntries((object?.properties ?? []).map(item => [item.name, item.value]));
const tileOf = object => ({ x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) });
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const questLabel = quest => quest?.socialChain ? `이웃 연쇄 · ${quest.titleKo}` : quest?.titleKo;
const DIRECTIONS = [{ id: 'left', dx: -1, dy: 0, ko: '왼쪽' }, { id: 'right', dx: 1, dy: 0, ko: '오른쪽' }, { id: 'up', dx: 0, dy: -1, ko: '위' }, { id: 'down', dx: 0, dy: 1, ko: '아래' }];

function walkPath(state, map, target, { radius = 1, targetHostId = null } = {}) {
  if (!map || !target) return null;
  const actor = state.player.embodiment ? state.hosts[state.player.embodiment] : state.player;
  const start = actor?.position;
  if (!start) return null;
  const collision = map.layers?.find(layer => layer.name === 'Collision');
  const blocked = new Set(Object.values(state.hosts).filter(person => person.historicalAliveAndPresent && person.mapId === map.mapId && person.id !== state.player.embodiment && person.id !== targetHostId).map(person => `${person.position.x},${person.position.y}`));
  const isOpen = (x, y) => x >= 0 && y >= 0 && x < map.width && y < map.height && collision?.data?.[y * map.width + x] === 0 && !blocked.has(`${x},${y}`);
  const key = point => `${point.x},${point.y}`;
  const queue = [{ x: start.x, y: start.y, path: [] }], seen = new Set([key(start)]);
  while (queue.length) {
    const point = queue.shift();
    if (distance(point, target) <= radius) return point.path;
    for (const direction of DIRECTIONS) {
      const next = { x: point.x + direction.dx, y: point.y + direction.dy }, nextKey = key(next);
      if (seen.has(nextKey) || !isOpen(next.x, next.y)) continue;
      seen.add(nextKey); queue.push({ ...next, path: [...point.path, direction] });
    }
  }
  return null;
}
function pathKo(path) {
  if (!path?.length) return '목적지 곁에 있습니다.';
  const groups = [];
  for (const direction of path) {
    const last = groups.at(-1);
    if (last?.id === direction.id) last.count++;
    else groups.push({ id: direction.id, ko: direction.ko, count: 1 });
  }
  return `${groups.map(item => `${item.ko} ${item.count}칸`).join(' → ')} 이동한 뒤 E를 누르세요.`;
}

function routeFrom(startMapId, targetMapId, host, maps) {
  if (startMapId === targetMapId) return [];
  const queue = [[startMapId, []]], visited = new Set([startMapId]);
  while (queue.length) {
    const [mapId, path] = queue.shift(), map = maps[mapId];
    for (const exit of map?.layers?.find(layer => layer.name === 'Interactions')?.objects ?? []) {
      if (exit.type !== 'map-exit') continue;
      const props = propsOf(exit), nextId = props.targetMapId;
      if (!maps[nextId] || visited.has(nextId) || (host && !host.allowedMaps.includes(nextId))) continue;
      if (props.requiredHostId && (!host || props.requiredHostId !== host.id)) continue;
      if (!host && props.publicAccess === false) continue;
      const nextPath = [...path, { mapId, objectId: exit.id, name: exit.name, x: tileOf(exit).x, y: tileOf(exit).y, targetMapId: nextId }];
      if (nextId === targetMapId) return nextPath;
      visited.add(nextId); queue.push([nextId, nextPath]);
    }
  }
  return null;
}

function findSource(sourceId, host, maps, currentMapId) {
  const found = [];
  for (const [mapId, map] of Object.entries(maps)) {
    if (host && !host.allowedMaps.includes(mapId)) continue;
    for (const object of map.layers?.find(layer => layer.name === 'Interactions')?.objects ?? []) {
      const props = propsOf(object);
      if (props.sourceId !== sourceId) continue;
      found.push({ mapId, objectId: object.id, name: object.name, x: tileOf(object).x, y: tileOf(object).y,
        availableChapterId: props.availableChapterId ?? null, availableDate: props.availableDate ?? null });
    }
  }
  return found.sort((a, b) => Number(b.mapId === currentMapId) - Number(a.mapId === currentMapId))[0] ?? null;
}

function destination({ state, maps, host, target }) {
  if (!target) return { target: null, route: [], blocked: true, blockedReasonKo: '목적지 기록을 찾지 못했습니다.' };
  const path = routeFrom(state.world.currentMapId, target.mapId, host, maps);
  if (path === null) return { target: null, route: [], blocked: true, blockedReasonKo: `현재 인물은 ${maps[target.mapId]?.metadata.displayNameKo ?? target.mapId}에 갈 수 없습니다. 몸을 놓아주고 출입할 수 있는 인물을 찾아보세요.` };
  if (path.length) {
    const exitTarget = path[0], exitMap = maps[exitTarget.mapId];
    const directions = walkPath(state, exitMap, exitTarget, { radius: 1 });
    if (!directions) return { target: null, route: path, blocked: true, blockedReasonKo: '출구까지 갈 수 있는 길을 찾지 못했습니다.' };
    return { target: { ...exitTarget, kind: 'exit', finalMapId: target.mapId }, route: path, walkDirections: directions, blocked: false, placeKo: `${maps[target.mapId]?.metadata.displayNameKo ?? target.mapId}로 가는 길` };
  }
  const objectMap = maps[target.mapId], directions = walkPath(state, objectMap, target, { radius: target.kind === 'npc' ? 2 : 1, targetHostId: target.npcId });
  if (!directions) return { target: null, route: [], blocked: true, blockedReasonKo: '목적지까지 이어지는 걸을 수 있는 길이 없습니다.' };
  return { target: { ...target, kind: target.kind ?? 'object' }, route: [], walkDirections: directions, blocked: false, placeKo: maps[target.mapId]?.metadata.displayNameKo ?? target.mapId };
}

export function guideToResident({ state, maps, hostCards, targetHostId }) {
  const person = state?.hosts?.[targetHostId];
  const actorCard = hostCards.find(card => card.id === state?.player?.embodiment) ?? null;
  if (!person?.historicalAliveAndPresent || !maps?.[person.mapId]) return { target: null, route: [], blocked: true, blockedReasonKo: '질문할 인물의 위치를 확인할 수 없습니다.' };
  const target = { mapId: person.mapId, kind: 'npc', npcId: person.id, x: person.position.x, y: person.position.y };
  const place = destination({ state, maps, host: actorCard, target });
  if (place.blocked && actorCard) {
    const publicPlace = destination({ state, maps, host: null, target });
    if (!publicPlace.blocked) return { ...publicPlace, target: null, requiresRelease: true, blocked: false,
      howKo: `현재 몸으로는 이 인물에게 갈 수 없습니다. 몸을 놓아준 뒤 관찰자의 길을 이용해 이동하세요. ${publicPlace.howKo ?? pathKo(publicPlace.walkDirections)}` };
  }
  if (place.blocked) return place;
  return { ...place, howKo: `${pathKo(place.walkDirections)}${place.target?.kind === 'exit' ? ' 출구를 지나 표시된 구역으로 가세요.' : ' 인물 곁에서 말을 거세요.'}` };
}

export function resolveQuestGuidance({ state, quests, maps, hostCards }) {
  if (state.endingId) return { taskType: 'COMPLETE', actionKo: '기록을 읽고 새로 시작하세요', reasonKo: '이번 기록은 끝났습니다.', howKo: '새 기록 시작을 누르세요.', target: null, progress: { completedSteps: 1, totalSteps: 1 }, known: true, blocked: false };
  const mapId = state.world.currentMapId, map = maps[mapId];
  const embodied = state.player.embodiment ? state.hosts[state.player.embodiment] : null;
  const host = embodied ? hostCards.find(card => card.id === embodied.id) : null;
  if (!host) {
    const availableQuests = quests.filter(item => item.chapterId === state.world.chapterId && (!item.date || item.date <= state.world.date)
      && (!item.requiresLivingEventId || state.world.livingEventStates?.[item.requiresLivingEventId]?.status === 'ACTIVE')
      && state.quests[item.id]?.status !== 'resolved' && questPrerequisitesMet(state, item)).sort((a,b)=>(a.date??'').localeCompare(b.date??''));
    const observerQuest = availableQuests.find(item => item.entry?.mapId === mapId) ?? availableQuests[0];
    const eligibleIds = observerQuest ? new Set(observerQuest.actions.flatMap(action => action.hostIds)) : null;
    const candidates = Object.values(state.hosts).filter(person => person.historicalAliveAndPresent && (!eligibleIds || eligibleIds.has(person.id)))
      .map(person => {
        const route = routeFrom(mapId, person.mapId, null, maps);
        const walkDirections = route?.length ? walkPath(state, map, route[0], { radius: 1 }) : route ? walkPath(state, map, person.position, { radius: 2, targetHostId: person.id }) : null;
        return { person, card: hostCards.find(item => item.id === person.id), route, walkDirections };
      })
      .filter(item => item.card && item.route !== null && item.walkDirections !== null)
      .sort((a, b) => (a.route.length * 1000 + a.walkDirections.length) - (b.route.length * 1000 + b.walkDirections.length));
    const next = candidates[0];
    const traveling = Boolean(next?.route.length);
    const immediate = traveling ? { ...next.route[0], kind: 'exit' } : next ? { mapId, kind: 'npc', npcId: next.person.id, x: next.person.position.x, y: next.person.position.y } : null;
    const walkDirections = next?.walkDirections ?? null;
    const targetPlace = traveling ? maps[next.person.mapId]?.metadata.displayNameKo : map.metadata.displayNameKo;
    return { questId: observerQuest?.id ?? null, phaseId: 'choose-host', hostId: next?.person.id ?? null, taskType: traveling ? 'TRAVEL' : next ? 'POSSESS' : 'TRAVEL',
      questTitleKo: questLabel(observerQuest) ?? '먼저 한 사람의 시야로', actionKo: !next ? '가까운 사람을 찾아보세요' : traveling ? `${next.route[0].name}으로 가서 ${next.card.displayNameKo}를 만나세요` : `${next.card.displayNameKo}에게 다가가 살펴보세요`,
      reasonKo: next ? observerQuest ? `${observerQuest.titleKo}은(는) ${next.card.displayNameKo}가 맡을 수 있습니다.` : `${next.card.displayNameKo}의 일과 아는 것을 직접 확인할 수 있습니다.` : '이 거리에서 만날 수 있는 사람을 찾고 있습니다.',
      howKo: traveling ? `${pathKo(walkDirections)} 관찰자는 공개된 길을 이용할 수 있습니다.` : pathKo(walkDirections),
      placeKo: targetPlace, target: immediate,
      progress: { completedSteps: 0, totalSteps: observerQuest ? Math.max(1,observerQuest.actions.length) : 1 }, known: Boolean(next), blocked: !next, blockedReasonKo: next ? null : '지금 만날 수 있는 인물이 없습니다.' };
  }

  const candidates = quests.filter(quest => (quest.realmId || quest.chapterId?.startsWith('LITERARY_'))
    ? state.world.activeRealm?.id === (quest.realmId ?? quest.chapterId)
    : quest.chapterId === state.world.chapterId)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const playableCandidates = candidates.filter(item => (!item.date || item.date <= state.world.date)
    && (!item.requiresLivingEventId || state.world.livingEventStates?.[item.requiresLivingEventId]?.status === 'ACTIVE')
    && state.quests[item.id]?.status !== 'resolved' && questPrerequisitesMet(state, item));
  const linkedLifeStage = playableCandidates.find(item => item.lifeChain
    && item.actions?.some(action => action.hostIds.includes(host.id))
    && (state.world.lifeChains?.[item.lifeChain.id]
      || (item.lifeChain.previousQuestId && state.quests[item.lifeChain.previousQuestId]?.status === 'resolved')
      || candidates.some(anchor => !anchor.lifeChain && anchor.entry?.mapId === item.entry?.mapId
        && anchor.entry?.objectId === item.entry?.objectId && state.quests[anchor.id]?.status === 'resolved')));
  // A resident who belongs to a later stage of a personal chain should be
  // directed to the next stage owner, instead of receiving an unrelated
  // fallback campaign objective that makes the chain look broken.
  const lockedChain = candidates.find(item => item.lifeChain
    && item.actions?.some(action => action.hostIds.includes(host.id))
    && state.quests[item.id]?.status !== 'resolved'
    && (!item.date || item.date <= state.world.date)
    && !questPrerequisitesMet(state, item));
  if (lockedChain) {
    const chain = candidates.filter(item => item.lifeChain?.id === lockedChain.lifeChain.id);
    const nextStage = chain.find(item => state.quests[item.id]?.status !== 'resolved' && questPrerequisitesMet(state, item))
      ?? chain.find(item => state.quests[item.id]?.status !== 'resolved');
    const ownerId = nextStage?.actions?.flatMap(action => action.hostIds).find(id => id !== host.id);
    const owner = ownerId ? state.hosts[ownerId] : null;
    const ownerCard = hostCards.find(item => item.id === ownerId);
    if (owner && ownerCard && owner.historicalAliveAndPresent) {
      const route = routeFrom(mapId, owner.mapId, embodied, maps);
      if (route?.length) {
        const exit = route[0], exitMap = maps[exit.mapId];
        const directions = walkPath(state, exitMap, exit, { radius: 1 });
        if (directions) return { questId: nextStage.id, phaseId: 'life-chain-switch', hostId: owner.id,
          questTitleKo: `${nextStage.socialChain ? '이웃 연쇄 · ' : ''}${lockedChain.lifeChain.titleKo} · ${nextStage.lifeChain.stage}/${nextStage.lifeChain.stageCount}`,
          taskType: 'TRAVEL', actionKo: `${ownerCard.displayNameKo}가 있는 ${maps[owner.mapId]?.metadata.displayNameKo}로 가세요`,
          reasonKo: `이 연속 퀘스트는 ${ownerCard.displayNameKo}의 선택에서 시작합니다. 앞 단계를 마치면 다음 사람의 일이 열립니다.`,
          howKo: `${pathKo(directions)} 현재 몸이 통과할 수 있는 길입니다.`, placeKo: `${maps[owner.mapId]?.metadata.displayNameKo}로 가는 길`,
          target: { ...exit, kind: 'exit', finalMapId: owner.mapId }, route, progress: { completedSteps: 0, totalSteps: chain.length }, known: true, blocked: false };
      }
      if (owner.mapId === mapId) {
        const directions = walkPath(state, map, owner.position, { radius: 2, targetHostId: owner.id });
        if (directions) return { questId: nextStage.id, phaseId: 'life-chain-switch', hostId: owner.id,
          questTitleKo: `${nextStage.socialChain ? '이웃 연쇄 · ' : ''}${lockedChain.lifeChain.titleKo} · ${nextStage.lifeChain.stage}/${nextStage.lifeChain.stageCount}`,
          taskType: 'SWITCH', actionKo: `${ownerCard.displayNameKo}에게 몸을 맡기세요`,
          reasonKo: `이 연속 퀘스트는 ${ownerCard.displayNameKo}의 선택에서 시작합니다. 앞 단계를 마치면 다음 사람의 일이 열립니다.`,
          howKo: `${pathKo(directions)} 가까이서 E를 눌러 살펴보세요.`, placeKo: maps[mapId].metadata.displayNameKo,
          target: { mapId, kind: 'npc', npcId: owner.id, ...owner.position }, progress: { completedSteps: 0, totalSteps: chain.length }, known: true, blocked: false };
      }
    }
  }
  const canHostQuest = item => item.actions?.some(action => action.hostIds.includes(host.id));
  const quest = linkedLifeStage ?? playableCandidates.find(item => item.entry?.mapId === mapId && canHostQuest(item))
    ?? playableCandidates.find(canHostQuest) ?? playableCandidates[0];
  if (!quest) {
    const nextDateQuest = candidates.find(item => item.date > state.world.date && state.quests[item.id]?.status !== 'resolved');
    return { questId: null, hostId: host.id, questTitleKo: '오늘 맡은 일', taskType: nextDateQuest ? 'WAIT' : 'COMPLETE',
      actionKo: nextDateQuest ? `${Number(nextDateQuest.date.slice(5,7))}월 ${Number(nextDateQuest.date.slice(8,10))}일 자료가 올 때까지 기다리세요` : '오늘 맡은 기록을 마쳤습니다 · 남은 관점 질문을 골라 보세요',
      reasonKo: nextDateQuest ? '아직 도착하지 않은 자료는 미리 열 수 없습니다.' : `${host.displayNameKo}가 맡은 기록은 끝났습니다. 사건·이념 임무에서 질문을 고르면 다음에 만날 사람과 물을 내용이 표시됩니다.`,
      howKo: nextDateQuest ? '거리와 작업장을 둘러보거나 연표를 이어가세요.' : '질문을 담고 표시된 인물에게 가세요. 가까이서 E를 눌러 빙의한 다음 말 걸기를 누르면 됩니다. 다른 인물의 관점도 들으면 수첩에 비교 메모가 남습니다.', placeKo: map.metadata.displayNameKo,
      target: null, progress: { completedSteps: 0, totalSteps: 0 }, known: true, blocked: false };
  }

  const allowed = (quest.actions ?? []).filter(action => action.hostIds.includes(host.id));
  const entryMapId = quest.entry?.mapId, entryMap = maps[entryMapId];
  const entryObject = entryMap?.layers?.find(layer => layer.name === 'Interactions')?.objects.find(item => item.id === quest.entry?.objectId);
  const entryTarget = entryObject ? { mapId: entryMapId, objectId: entryObject.id, name: entryObject.name, ...tileOf(entryObject), kind: 'object' } : null;
  const completed = state.ledger.filter(entry => entry.questId === quest.id && ['HISTORICAL_ACTION','LITERARY_ACTION'].includes(entry.eventType)).length;
  const total = (quest.actions ?? []).length;
  const chain = quest.lifeChain;
  const base = { questId: quest.id, phaseId: state.quests[quest.id]?.status ?? 'open', hostId: host.id, questTitleKo: chain ? `${quest.socialChain ? '이웃 연쇄 · ' : ''}${chain.titleKo} · ${chain.stage}/${chain.stageCount} — ${quest.titleKo}` : questLabel(quest),
    progress: { completedSteps: Math.min(completed, total), totalSteps: Math.max(1,total) }, known: true };

  if (!allowed.length) {
    const requiredIds = [...new Set((quest.actions ?? []).flatMap(action => action.hostIds))];
    const available = requiredIds.map(id => {
      const person = state.hosts[id], directions = person?.mapId === mapId ? walkPath(state, map, person.position, { radius: 2, targetHostId: id }) : null;
      return { person, card: hostCards.find(item => item.id === id), walkDirections: directions };
    })
      .filter(item => item.person?.historicalAliveAndPresent && item.card && item.person.mapId === mapId && item.walkDirections !== null)
      .sort((a,b)=>a.walkDirections.length-b.walkDirections.length)[0];
    const reachableHosts = requiredIds.map(id => ({ person: state.hosts[id], card: hostCards.find(item => item.id === id) }))
      .filter(item => item.person && item.card && item.person.historicalAliveAndPresent)
      .map(item => {
        const route = routeFrom(mapId,item.person.mapId,embodied,maps), publicRoute = routeFrom(mapId,item.person.mapId,null,maps);
        const walkDirections = route?.length ? walkPath(state, map, route[0], { radius: 1 }) : route ? walkPath(state, map, item.person.position, { radius: 2, targetHostId: item.person.id }) : null;
        return { ...item, route, publicRoute, walkDirections };
      })
      .filter(item => item.route === null || item.walkDirections !== null)
      .sort((a,b)=>((a.route?.length ?? Infinity)*1000+(a.walkDirections?.length ?? Infinity))-((b.route?.length ?? Infinity)*1000+(b.walkDirections?.length ?? Infinity)));
    const futureHost = reachableHosts.find(item => item.route !== null) ?? reachableHosts[0];
    const targetHost = available ?? futureHost;
    if (targetHost && available) return { ...base, taskType: 'SWITCH', actionKo: `${targetHost.card.displayNameKo}에게 몸을 맡기세요`, reasonKo: `${quest.titleKo}은(는) ${targetHost.card.displayNameKo}가 맡을 수 있습니다.`, howKo: `${pathKo(available.walkDirections)} 가까이서 E로 살펴보세요.`, placeKo: map.metadata.displayNameKo, target: { mapId, kind: 'npc', npcId: targetHost.person.id, x: targetHost.person.position.x, y: targetHost.person.position.y }, blocked: false };
    if (targetHost?.person && targetHost.person.mapId !== mapId) {
      const route = targetHost.route ?? routeFrom(mapId, targetHost.person.mapId, embodied, maps);
      if (route?.length && targetHost.walkDirections) return { ...base, taskType: 'TRAVEL', actionKo: `${targetHost.card.displayNameKo}가 있는 ${maps[targetHost.person.mapId]?.metadata.displayNameKo}로 가세요`, reasonKo: `${quest.titleKo}은(는) ${targetHost.card.displayNameKo}가 맡을 수 있습니다.`, howKo: `${pathKo(targetHost.walkDirections)} 현재 몸이 통과할 수 있는 길입니다.`, placeKo: `${maps[targetHost.person.mapId]?.metadata.displayNameKo}로 가는 길`, target: { ...route[0], kind: 'exit', finalMapId: targetHost.person.mapId }, route, blocked: false };
      const publicRoute = targetHost.publicRoute ?? routeFrom(mapId, targetHost.person.mapId, null, maps);
      if (publicRoute?.length) return { ...base, taskType: 'RELEASE', actionKo: `현재 몸을 놓아주세요`, reasonKo: `${quest.titleKo}은(는) ${targetHost.card.displayNameKo}가 맡을 수 있습니다.`, howKo: '화면의 놓아주기를 누르세요. 관찰자가 되면 공개된 길로 그 사람을 찾아갈 수 있습니다.', placeKo: maps[targetHost.person.mapId]?.metadata.displayNameKo, target: null, blocked: false };
    }
    return { ...base, taskType: 'SWITCH', actionKo: `${targetHost?.card.displayNameKo ?? requiredIds.map(id=>hostCards.find(c=>c.id===id)?.displayNameKo).filter(Boolean).join(' 또는 ')}의 시야로 바꾸세요`, reasonKo: `이 단계는 현재 몸으로 처리할 수 없습니다.`, howKo: '몸을 놓아준 뒤 해당 인물을 찾아가세요. 수첩의 목적지는 허용된 길만 표시합니다.', placeKo: targetHost?.person ? maps[targetHost.person.mapId]?.metadata.displayNameKo : map.metadata.displayNameKo, target: null, blocked: true, blockedReasonKo: '이 인물은 이 기록을 처리할 권한이 없습니다.' };
  }

  const known = new Set([...(embodied.privateKnowledgeIds ?? []), ...(embodied.knownEvidenceIds ?? [])]);
  const sourceActions = allowed.filter(action => action.requiredKnowledgeId && !known.has(action.requiredKnowledgeId));
  const feasibleAction = allowed.find(action => !action.requiredKnowledgeId || known.has(action.requiredKnowledgeId));
  if (!feasibleAction && sourceActions.length) {
    const source = findSource(sourceActions[0].requiredKnowledgeId, host, maps, mapId);
    if (source) {
      const place = destination({ state, maps, host: embodied, target: source });
      return { ...base, taskType: place.target?.kind === 'exit' ? 'TRAVEL' : 'READ', actionKo: place.target?.kind === 'exit' ? `자료가 있는 ${place.placeKo}로 가세요` : `${source.name}에서 자료를 읽으세요`,
        reasonKo: '이 자료를 읽어야 다음 선택지를 판단할 수 있습니다.', howKo: `${pathKo(place.walkDirections)}${place.target?.kind === 'exit' ? ' 문서를 살펴보세요.' : ' E를 누른 뒤 열린 문서에서 읽기를 선택하세요.'}`,
        placeKo: place.placeKo, target: place.target, blocked: place.blocked, blockedReasonKo: place.blockedReasonKo, requiredKnowledgeId: sourceActions[0].requiredKnowledgeId };
    }
  }
  if (!entryTarget) return { ...base, taskType: 'COMPLETE', actionKo: '이 사건 자료를 열 수 없습니다', reasonKo: '목표 문서가 지도에 연결되지 않았습니다.', howKo: '수첩에서 다른 인물의 일을 확인하세요.', placeKo: map.metadata.displayNameKo, target: null, blocked: true };
  const place = destination({ state, maps, host: embodied, target: entryTarget });
  const stepAction = place.target?.kind === 'exit' ? `표시된 출구로 가서 ${place.placeKo}로 이동하세요` : `「${entryTarget.name}」 곁에서 E를 눌러 살펴보세요`;
  return { ...base, taskType: place.target?.kind === 'exit' ? 'TRAVEL' : 'INSPECT', actionKo: stepAction,
    reasonKo: '이 자료를 확인해야 이 사건에서 할 수 있는 선택을 알 수 있습니다.',
    howKo: place.target?.kind === 'exit' ? `${pathKo(place.walkDirections)} 인물이 갈 수 있는 곳만 이동합니다.` : `${pathKo(place.walkDirections)}${place.target?.kind === 'object' ? ' E를 누르세요.' : ''}`,
    placeKo: place.placeKo, target: place.target, blocked: place.blocked, blockedReasonKo: place.blockedReasonKo, actionId: feasibleAction.id };
}
