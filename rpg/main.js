import { createRenderer } from './engine/renderer.js';
import './engine/game-state.js';
const { createInitialState, moveActor, possessHost, releaseHost, transitionMap, performQuestAction, saveGame, loadGame, nearTile, knowledgeForHost, recordSourceRead, recordEvidenceRead, recordDialogueTurn, enterLiteraryRealm, leaveLiteraryRealm, advanceChapter, advanceCampaignDate, resolveEnding } = globalThis.V33GameState;

const readJson = async path => (await fetch(path)).json();
const [street, shop, chancery, courtyard, literaryMap, firstQuest, source, firstIssue, historicalSources, literarySource, campaign, publicQuest, circleQuest, letterQuest, literaryQuest, sceneObservations, aiScenes] = await Promise.all([readJson('./rpg/maps/nevsky.json'), readJson('./rpg/maps/printshop.json'), readJson('./rpg/maps/chancery.json'), readJson('./rpg/maps/courtyard.json'), readJson('./rpg/maps/dead-souls.json'), readJson('./rpg/quests/printshop-article.json'), readJson('./rpg/data/khor-kalynych-source.json'), readJson('./rpg/data/sovremennik-1847-issue.json'), readJson('./rpg/data/historical-source-packets.json'), readJson('./rpg/data/dead-souls-source.json'), readJson('./rpg/quests/campaign.json'), readJson('./rpg/quests/public-discourse-1848.json'), readJson('./rpg/quests/circle-investigation-1849.json'), readJson('./rpg/quests/circle-letter-1849-may.json'), readJson('./rpg/quests/literary-dead-souls.json'), readJson('./rpg/data/scene-observations.json'), readJson('./rpg/ai/scenes.json')]);
const cards = await Promise.all(['clerk_alexei','printer_ekaterina','courier_pavel','seamstress_anna','tenant_mikhail','bookseller_lev','nekrasov_reconstruction','literary_chichikov'].map(id => readJson(`./rpg/characters/${id}.json`)));
const maps = { nevsky: street, printshop: shop, chancery, courtyard, 'dead-souls': literaryMap }, hostCards = cards;
const questList = [firstQuest, publicQuest, circleQuest, letterQuest, literaryQuest];
const questsById = new Map(questList.map(item => [item.id, item]));
const sourceRecords = new Map([source, firstIssue, ...historicalSources.records, literarySource].map(record => [record.sourceId, record]));
const initial = () => createInitialState({ maps, hostCards, quests: questList });
let state;
try { state = localStorage.getItem('v33-rpg-save') ? loadGame(localStorage.getItem('v33-rpg-save'), { maps, hostCards, quests: questList }) : initial(); }
catch { state = initial(); }
const canvas = document.querySelector('#world'), renderer = createRenderer(canvas, { hostCards });
const $ = selector => document.querySelector(selector);
let lastMoveAt = 0, renderFrame = null, renderTimer = null, activeDialogueHost = null, activeDialogueController = null;
const dialogueSessions = new Map(), dialogueTranscripts = new Map();
const aiBaseUrl = String(window.V33_RPG_AI_API_BASE_URL ?? '').replace(/\/$/, '');
function classifyTypedResponse(input) {
  const text = String(input).toLocaleLowerCase('ko-KR');
  if (/출처|사료|원문|자료|문서|근거/.test(text)) return 'SOURCE_REQUEST';
  if (/누가|보여|공개|들키|위험|문책|비밀|기밀/.test(text)) return 'RISK_QUESTION';
  if (/해\s*줘|보내|전달|옮기|적어|기록하|보류|멈추|도와/.test(text)) return 'ACTION_REQUEST';
  if (/왜|어떻|느끼|가족|좋아|싫어|걱정|이름/.test(text)) return 'PERSONAL_QUESTION';
  return 'GENERAL_CONVERSATION';
}
const intentLabels = { SOURCE_REQUEST: '자료 확인', ACTION_REQUEST: '행동 요청', RISK_QUESTION: '공개·위험 질문', PERSONAL_QUESTION: '개인 질문', GENERAL_CONVERSATION: '일반 대화' };
const relationLabels = { editorial_office: '편집부', workshop: '작업장 동료', source_readers: '출처를 확인하는 독자', postal_route: '우편 경로', local_readers: '가게의 독자들', office_supervisor: '상급자', archive_keeper: '문서 담당자' };
function render(now) {
  renderFrame = null;
  renderer.draw(state, currentMap(), now, lastMoveAt);
  if (now - lastMoveAt < 360) renderTimer = window.setTimeout(() => { renderTimer = null; requestRender(); }, 40);
}
function requestRender() {
  if (renderTimer !== null) { window.clearTimeout(renderTimer); renderTimer = null; }
  if (renderFrame === null) renderFrame = requestAnimationFrame(render);
}
window.addEventListener('resize', requestRender, { passive: true });
const say = (title, text, actions = []) => { $('#headline').textContent = title; $('#journal-text').textContent = text; $('#actions').replaceChildren(...actions.map(({ label, subcopy, run }) => { const button = document.createElement('button'); button.type = 'button'; const heading = document.createElement('span'); heading.textContent = label; button.append(heading); if (subcopy) { const detail = document.createElement('small'); detail.textContent = subcopy; button.append(detail); } button.addEventListener('click', run); return button; })); };
const setState = next => { state = next; updateHud(); requestRender(); };
function currentMap() { return maps[state.world.currentMapId]; }
function actor() { return state.player.embodiment ? state.hosts[state.player.embodiment] : state.player; }
function updateHud() {
  const map = currentMap(), host = state.player.embodiment ? cards.find(card => card.id === state.player.embodiment) : null;
  $('#place').textContent = map.metadata.displayNameKo; $('#mapname').textContent = map.metadata.displayNameKo;
  document.body.classList.toggle('literary-world', Boolean(state.world.activeRealm));
  const [year, month, day] = state.world.date.split('-').map(Number);
  $('#world-date').textContent = state.world.activeRealm ? '문학 속 1842년' : `${year}년 ${month}월`;
  $('#calendar-date').textContent = state.world.activeRealm ? '소설 속 장면' : `${year}년 ${month}월 ${day}일`;
  const dayMinute = ((state.world.clockMinutes ?? 540) % 1440 + 1440) % 1440;
  $('#clock').textContent = state.world.activeRealm ? '문학 세계 · 1842' : `${String(Math.floor(dayMinute / 60)).padStart(2, '0')}:${String(dayMinute % 60).padStart(2, '0')}`;
  $('#bodyname').textContent = host ? `몸을 빌림 · ${host.displayNameKo}` : '바깥에서 바라보는 중';
  $('#coins').textContent = host ? (state.hosts[host.id].money.amount == null ? '자금 기록 없음' : `${state.hosts[host.id].money.amount} 코페이카`) : '몸을 빌리면 주머니를 확인할 수 있습니다';
  $('#release').disabled = !host || Boolean(activeDialogueHost);
  $('#talk').disabled = !host || Boolean(activeDialogueHost);
  document.querySelectorAll('.touch-pad button').forEach(button => { button.disabled = Boolean(activeDialogueHost); });
  $('#load').disabled = !localStorage.getItem('v33-rpg-save');
  const notebook = $('#host-notebook'), facts = $('#host-facts');
  notebook.hidden = !host; facts.replaceChildren();
  if (host) {
    const live = state.hosts[host.id], known = host.secretKnowledge.filter(item => live.privateKnowledgeIds.includes(item.id)).map(item => item.summaryKo);
    if (live.knownEvidenceIds.includes(source.sourceId)) known.push('투르게네프의 작품 원문과 번역을 읽었다.');
    for (const record of historicalSources.records) if (live.knownEvidenceIds.includes(record.sourceId)) known.push(`${record.documentDate}년 자료를 읽었다 · ${record.titleKo}`);
    for (const id of live.knownEvidenceIds) {
      const clue = sceneObservations.entries[id];
      if (clue) known.push(`허구 소품 조사 · ${clue.titleKo}`);
    }
    for (const fact of [`현재 일과 · ${live.currentActivityKo || host.personalObjective}`, `오늘 할 일 · ${host.personalObjective}`, `신분/직업 · ${host.socialEstate} · ${host.occupation}`, `갈 수 있는 곳 · ${live.allowedMaps.map(id => maps[id].metadata.displayNameKo).join(', ')}`, `다닐 수 없는 곳 · ${host.legalMobility}`, `가진 물건 · ${live.inventory.join(', ')}`, `아는 것 · ${known.join(' ') || '아직 기록된 정보가 없다.'}`]) {
      const item = document.createElement('li'); item.textContent = fact; facts.append(item);
    }
    for (const [group, status] of Object.entries(live.relations ?? {})) { const item = document.createElement('li'); item.textContent = `관계 · ${relationLabels[group] ?? group} · ${status}`; facts.append(item); }
    for (const situation of live.situationNotes ?? []) { const item = document.createElement('li'); item.textContent = `상황 변화 · ${situation}`; facts.append(item); }
  }
}
function sayRecord(text) { $('#record').textContent = text; }
function currentNearby() {
  const at = actor().position;
  const interactables = [...currentMap().layers.find(layer => layer.name === 'Interactions').objects, ...currentMap().layers.find(layer => layer.name === 'NPCs').objects];
  return interactables.filter(object => {
    const props = Object.fromEntries((object.properties ?? []).map(p => [p.name, p.value]));
    const host = object.type === 'npc' ? state.hosts[props.hostId] : null;
    if (object.type === 'npc' && (!host || host.mapId !== currentMap().mapId)) return false;
    if (object.type === 'npc' && props.hostId === state.player.embodiment) return false;
    const position = object.type === 'npc' ? host.position : { x: Math.floor(object.x / 16), y: Math.floor(object.y / 16) };
    return nearTile(at, position, object.type === 'npc' ? 2 : 1);
  });
}
function sourceRead(sourceId, archiveSourceIds = []) {
  const record = sourceRecords.get(sourceId);
  if (!record) { sayRecord('자료 목록에서 확인되지 않는 문서다.'); return; }
  const recorded = recordSourceRead(state, sourceId, maps, archiveSourceIds);
  if (recorded.ok) setState(recorded.state);
  else { sayRecord(recorded.reason === 'source_not_present' ? '이 장소나 시점에는 아직 열람할 수 없는 자료다.' : '이 자료를 지금은 읽을 수 없다.'); return; }
  showSourceSummary(record);
  sayRecord(`자료 읽음 · ${record.creator ?? record.author} · 원문과 번역을 기록`);
}
function showSourceSummary(record = source) {
  const isTurgenev = record.sourceId === source.sourceId;
  const context = isTurgenev ? '1847년 《Современник》 첫 호에 실린 「호리와 칼리니치」의 도입부다. 화자는 지주 폴루티킨을 따라 그의 농노 호리 집으로 향한다. 작품 속 서술이며 역사적 증언이 아니다.' : record.contextKo;
  const provenance = isTurgenev ? `${record.witness.edition}\n\n위치: ${record.witness.range}\n\n첫 간행물: ${record.firstPublication}\n\n${record.witness.note}\n\n${record.translationNoteKo}` : `${record.edition}\n\n문서 시점: ${record.documentDate}\n위치: ${record.range}\n자료 성격: ${record.type}\n\n${record.translationNoteKo}`;
  const url = isTurgenev ? record.witness.stableRevisionUrl : record.sourceUrl;
  say(record.titleKo, context, [{ label: '원문과 번역 펼치기', run: () => {
    const body = record.paragraphs.map((paragraph, index) => `(${index + 1}) ${paragraph.ru}\n${paragraph.ko}`).join('\n\n');
    say(record.titleKo, `${context}\n\n${body}`, [{ label: '판본과 출처 보기', run: () => { say('판본과 출처', provenance, [
      { label: '확인한 원문 열기', subcopy: record.range ?? record.witness.range, run: () => window.open(url, '_blank', 'noopener,noreferrer') },
      ...(isTurgenev ? [{ label: '작품의 첫 간행 기록 열기', subcopy: '투르게네프 전자도서관', run: () => window.open(record.firstPublicationSourceUrl, '_blank', 'noopener,noreferrer') }, { label: '《Современник》 1847년 제1호 서지 열기', subcopy: '러시아 국립전자도서관', run: () => window.open(record.catalogUrl, '_blank', 'noopener,noreferrer') }] : []),
      { label: '자료 목록으로', run: () => openSourceDrawer() },
    ]); } }]);
  } }]);
}
function openSourceDrawer() {
  const available = state.world.activeRealm ? [...(state.world.activeRealm.sourceIds ?? [])] : campaign.arcs.filter(arc => arc.id === state.world.chapterId || state.world.completedChapterIds?.includes(arc.id)).flatMap(arc => arc.sources);
  const unlocked = [...new Set(available)].filter(id => {
    if (!sourceRecords.has(id)) return false;
    const sourceObject = Object.values(maps).flatMap(map => map.layers.find(layer => layer.name === 'Interactions')?.objects ?? []).find(object => object.properties?.some(property => property.name === 'sourceId' && property.value === id));
    const availableDate = sourceObject?.properties?.find(property => property.name === 'availableDate')?.value;
    return !availableDate || availableDate <= state.world.date;
  });
  const sourceButtons = unlocked.map(id => sourceRecords.get(id)).map(record => ({ label: record.titleKo, subcopy: `${record.documentDate ?? '1847'} · ${record.type ?? '문학 원문'} · ${record.range ?? record.witness.range}`, run: () => sourceRead(record.sourceId, unlocked) }));
  const realmActions = state.world.activeRealm
    ? [{ label: '문학 세계에서 돌아오기', subcopy: '1847–1849 역사 연표로 돌아갑니다 · 문학 속 사건은 역사 기록에 합쳐지지 않습니다', run: () => { const result = leaveLiteraryRealm(state, maps); if (result.ok) { setState(result.state); say('현실의 거리로 돌아오다', '도청 소재지의 여관은 소설 속에 남아 있다. 이곳에서 본 것은 역사 속 사람의 기억이 되지 않는다.', [{ label: '자료철 열기', run: openSourceDrawer }]); } } }]
    : [{ label: '《죽은 혼》의 문학 세계로 들어가기', subcopy: '1842년 소설의 별도 장면입니다 · 역사 연표와 인물의 지식은 섞이지 않습니다 · 몸을 놓은 뒤 들어갑니다', run: () => { const card = cards.find(item => item.id === campaign.literaryRealm.hostId); const result = enterLiteraryRealm(state, maps[campaign.literaryRealm.mapId], card); if (result.ok) { setState(result.state); say('《죽은 혼》의 여관', '소설 제1장에 나오는 도청 소재지 여관이다. 여기의 장부와 인물은 문학 세계에만 속한다.', [{ label: '자료철 열기', run: openSourceDrawer }]); } else sayRecord('먼저 빌린 몸을 놓아주고 다시 시도하자.'); } }];
  say(state.world.activeRealm ? '문학 세계의 자료' : '지금까지 열린 자료', state.world.activeRealm ? '읽은 문장은 소설 속 인물의 지식으로만 기록된다.' : '읽은 문서는 현재 몸의 지식에만 기록된다. 아직 날짜가 오지 않은 자료는 연표가 진행된 뒤 열린다.', [...sourceButtons, ...realmActions]);
}
function continuationFor(activeQuest) {
  if (activeQuest.chapterId === 'LITERARY_DEAD_SOULS') return [{ label: '문학 세계 자료철 열기', run: openSourceDrawer }];
  const arcIndex = campaign.arcs.findIndex(arc => arc.id === state.world.chapterId), arc = campaign.arcs[arcIndex];
  const questIndex = arc?.questIds.indexOf(activeQuest.id) ?? -1;
  const laterQuest = arc?.questIds.slice(questIndex + 1).map(id => questsById.get(id)).find(quest => state.quests[quest.id]?.status !== 'resolved');
  if (laterQuest) { const [nextMonth, nextDay] = laterQuest.date.slice(5).split('-').map(Number); return [{ label: laterQuest.date > state.world.date ? `${nextMonth}월 ${nextDay}일 자료로 이어가기` : '다음 자료 열기', subcopy: `연표 ${state.world.date} → ${laterQuest.date} · 다음 문서가 만들어진 뒤로 진행합니다`, run: () => {
    const advanced = advanceCampaignDate(state, laterQuest.date, campaign, questList);
    if (!advanced.ok) { sayRecord(`날짜를 진행할 수 없음 · ${advanced.reason}`); return; }
    setState(advanced.state);
    say(laterQuest.titleKo, laterQuest.premiseKo, [{ label: '열람 가능한 자료 확인', run: openSourceDrawer }]);
  } }]; }
  const nextArc = arcIndex >= 0 ? campaign.arcs[arcIndex + 1] : null;
  if (nextArc) return [{ label: `${nextArc.date.slice(0, 4)}년으로 이어가기`, subcopy: '다음 장을 시작합니다 · 역사 연표가 앞으로 이동합니다', run: () => {
    const advanced = advanceChapter(state, nextArc.id, campaign, maps);
    if (!advanced.ok) { sayRecord(`다음 장을 열 수 없음 · ${advanced.reason}`); return; }
    setState(advanced.state);
    say(nextArc.titleKo, `기록은 다음 연도로 이어졌다. ${nextArc.date.slice(0, 4)}년의 거리에서 새 사건을 살펴보자.`, [{ label: '자료철 열기', run: openSourceDrawer }]);
  } }];
  return [{ label: '마지막 기록을 정리한다', run: showEndingChoices }];
}
function inspect(object) {
  const props = Object.fromEntries((object.properties ?? []).map(p => [p.name, p.value]));
  if (object.type === 'npc') {
    const card = cards.find(item => item.id === props.hostId), host = state.hosts[props.hostId];
    say(card.displayNameKo, `${card.occupation}. ${card.personalObjective} 가까이에서 그 사람의 시야로 들어갈 수 있다.`, [{ label: '몸을 빌린다', run: () => { const result = possessHost(state, card.id, currentMap()); if (result.ok) { setState(result.state); say(card.displayNameKo, `눈높이가 달라졌다. ${card.speechRhythm} 주머니에는 ${host.money.amount}코페이카가 있다.`, []); sayRecord(`시야 전환 · ${card.displayNameKo}`); } else sayRecord(result.reason === 'already_embodied' ? '먼저 현재 몸을 놓아주자.' : '한두 걸음 더 가까이 가 보자.'); } }]);
  } else if (object.type === 'map-exit') {
    const result = transitionMap(state, props.exitId, maps);
    if (result.ok) { setState(result.state); say('문을 나서다', `${currentMap().metadata.displayNameKo}의 공기와 소리가 바뀐다. 다른 사람들은 각자 있던 자리에 남아 있다.`, []); sayRecord('직접 문을 지나 장소를 옮겼다.'); }
    else if (result.reason === 'host_lacks_access') { say('이 몸으로는 들어갈 수 없다', '맡은 일과 신분에 따라 드나들 수 있는 곳이 다르다. 다른 공개 길을 찾아보자.', []); sayRecord('현재 인물에게 이 장소의 출입 권한이 없다.'); }
    else if (result.reason === 'person_required') { say('사람을 통해서만 들어갈 수 있다', '이 문은 관찰자 혼자 통과할 수 없다. 이곳을 오갈 수 있는 사람을 찾아보자.', []); sayRecord('이 출입문은 특정 인물의 권한이 필요하다.'); }
    else { say('문까지 아직 남았다', '문이 보이지만 가까이 가야 한다. 길을 따라 걸어가 보자.', []); sayRecord('출구와 한 타일 거리까지 이동해야 한다.'); }
  } else if (object.type === 'source') sourceRead(props.sourceId);
  else if (props.evidenceId) {
    const clue = sceneObservations.entries[props.evidenceId];
    const recorded = recordEvidenceRead(state, props.evidenceId, maps);
    if (!clue || !recorded.ok) { say('아직 손이 닿지 않는다', '한 걸음 가까이 가서 살펴보자.', []); return; }
    setState(recorded.state);
    const hostLine = state.player.embodiment ? clue.hostLines[state.player.embodiment] : null;
    say(clue.titleKo, `${hostLine ?? clue.textKo}\n\n${clue.textKo}\n\n${sceneObservations.disclaimerKo}`, []);
    sayRecord(`허구 소품 조사 · ${clue.titleKo} · ${state.player.embodiment ? '현재 몸의 수첩에 기록' : '관찰 기록에만 저장'}`);
  }
  else if (props.questId) {
    const activeQuest = questsById.get(props.questId);
    const questIsAvailable = activeQuest && (activeQuest.chapterId === state.world.chapterId || (activeQuest.chapterId === 'LITERARY_DEAD_SOULS' && state.world.activeRealm?.id === campaign.literaryRealm.id)) && (!activeQuest.date || activeQuest.date <= state.world.date || activeQuest.chapterId === 'LITERARY_DEAD_SOULS');
    if (!questIsAvailable) { say('아직 시작할 때가 아니다', '이 장의 사건이 열리면 여기서 이어진다.', []); return; }
    if (state.quests[activeQuest.id]?.status === 'resolved') {
      say(activeQuest.titleKo, '이 장의 선택은 이미 기록되어 있다. 다음으로 이어갈 수 있다.', continuationFor(activeQuest));
      return;
    }
    const actionSpecs = activeQuest.actions.filter(action => action.hostIds.includes(state.player.embodiment) && (!action.requiredKnowledgeId || knowledgeForHost(state, state.player.embodiment).includes(action.requiredKnowledgeId)));
    const opts = actionSpecs.map(action => ({ label: action.labelKo, subcopy: action.subcopyKo, run: () => {
      const result = performQuestAction(state, { questId: activeQuest.id, hostId: state.player.embodiment, actionId: action.id, objectId: object.id }, { quests: questList, maps });
      if (!result.ok) { sayRecord(`처리할 수 없음 · ${result.reason}`); return; }
      setState(result.state);
      const actions = continuationFor(activeQuest);
      say(action.followupTitleKo ?? activeQuest.titleKo, `${action.resultKo}${action.followupKo ? `\n\n${action.followupKo}` : ''}`, actions);
      sayRecord('현장 행동을 장부에 기록했다.');
    } }));
    say(activeQuest.titleKo, activeQuest.premiseKo, opts);
  } else {
    const title = object.name || '작업장';
    say(title, '종이와 활자에 손이 닿은 흔적이 남아 있다. 여기서 보이는 물건은 한 사람이 확인한 만큼만 기록할 수 있다.', []);
    sayRecord('살펴본 물건을 현장 기록에 남겼다.');
  }
}
function showEndingChoices() {
  const options = campaign.endings.filter(ending => resolveEnding(state, ending.id, campaign).ok).map(ending => ({ label: ending.titleKo, subcopy: ending.choiceSubcopyKo, run: () => {
    const result = resolveEnding(state, ending.id, campaign);
    if (!result.ok) { sayRecord(`이 결말을 기록하려면 아직 확인할 자료가 있다 · ${result.reason}`); return; }
    setState(result.state);
    renderEnding(ending);
  } }));
  if (!options.length) { say('아직 기록을 닫을 수 없다', '세 시기의 선택과 자료를 확인한 뒤 다시 정리하자.', []); return; }
  say('마지막 기록을 정리하다', '남겨 둔 행동과 읽은 문서를 살펴보고, 그중 하나를 기록의 끝에 둔다.', options);
}
function renderEnding(ending) {
  $('#ending-date').textContent = `${state.world.date.replaceAll('-', '.')} · 보존 기록`;
  $('#ending-title').textContent = ending.titleKo;
  $('#ending-epilogue').textContent = ending.epilogueKo;
  $('#ending-history').textContent = campaign.endingHistoryNoteKo;
  const actionLines = state.ledger.filter(item => item.actionId).map(item => {
    const quest = questsById.get(item.questId), action = quest?.actions.find(entry => entry.id === item.actionId);
    const card = cards.find(entry => entry.id === item.hostId);
    return { text: `${card?.displayNameKo ?? '이름 없는 인물'} · ${action?.resultKo ?? item.actionId}` };
  });
  const journey = $('#ending-journey'); journey.replaceChildren();
  for (const line of actionLines) { const item = document.createElement('li'); item.textContent = line.text; journey.append(item); }
  const hostList = $('#ending-hosts'); hostList.replaceChildren(); hostList.classList.add('ending-host-list');
  const witnessedHosts = [...new Set(state.world.possessionHistory.map(item => item.hostId))].map(id => cards.find(card => card.id === id)).filter(card => card && card.kind !== 'LITERARY');
  for (const card of witnessedHosts) { const item = document.createElement('li'); item.textContent = `${card.displayNameKo} · ${card.occupation}`; hostList.append(item); }
  const sourceList = $('#ending-sources'); sourceList.replaceChildren();
  const readIds = [...new Set(state.ledger.flatMap(item => item.sourceIds ?? (item.sourceId ? [item.sourceId] : [])))];
  for (const id of readIds) {
    const record = sourceRecords.get(id), url = record?.sourceUrl ?? record?.witness?.stableRevisionUrl;
    if (!record || !url) continue;
    const item = document.createElement('li'), link = document.createElement('a');
    link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = `${record.titleKo} · ${record.documentDate ?? '문학 원문'}`;
    item.append(link); sourceList.append(item);
  }
  document.body.classList.add('ending-active');
  $('#ending-screen').hidden = false;
  $('#ending-restart').focus();
}
function interact() {
  if (activeDialogueHost) return;
  const near = currentNearby();
  if (!near.length) { say('아직 손이 닿지 않는다', '주변을 조금 더 걸어 가까이 가 보자. 사람에게 다가가면 그 사람의 자리에서 도시를 볼 수 있다.', []); return; }
  const object = state.player.embodiment
    ? near.find(item => item.type === 'quest-object') ?? near.find(item => item.type === 'map-exit') ?? near.find(item => item.type === 'source') ?? near[0]
    : near.find(item => item.type === 'source') ?? near.find(item => item.type === 'map-exit') ?? near.find(item => item.type === 'npc') ?? near[0];
  inspect(object);
}
function move(direction) {
  if (activeDialogueHost) return;
  const result = moveActor(state, direction, currentMap(), maps);
  if (result.moved) { setState(result.state); lastMoveAt = performance.now(); }
  else sayRecord('벽이나 가구가 길을 막고 있다.');
}
function finishConversation(hostId) {
  activeDialogueController?.abort(); activeDialogueController = null; activeDialogueHost = null; updateHud();
  $('.lower').classList.remove('is-talking');
  if (dialogueSessions.get(hostId)?.mode === 'BLOCKED_LIMIT') { dialogueSessions.delete(hostId); sessionStorage.removeItem(`v33-rpg-session:${hostId}`); }
  const card = cards.find(item => item.id === hostId);
  say(card.displayNameKo, '대화를 마쳤다. 그 사람은 지금 하던 일을 이어간다.', []);
  sayRecord('대화 기록을 남기고 현장으로 돌아왔다.');
}
function showConversation(card, promptText, replies, statusText = '') {
  $('.lower').classList.add('is-talking');
  $('#host-notebook').open = false; $('#host-notebook').hidden = true;
  const lines = dialogueTranscripts.get(card.id) ?? [];
  const text = lines.length ? lines.slice(-12).map(line => `${line.speaker} · ${line.text}`).join('\n\n') : promptText;
  const replyActions = replies.slice(0, 3).map((label, index) => ({ label, run: () => sendConversation(card, label, `R${index + 1}`) }));
  replyActions.push({ label: '대화 마치기', run: () => finishConversation(card.id) });
  say(card.displayNameKo, text, replyActions);
  const form = document.createElement('form'); form.className = 'dialogue-input';
  const input = document.createElement('input'); input.type = 'text'; input.maxLength = 800; input.autocomplete = 'off'; input.placeholder = '하고 싶은 말을 적어보세요'; input.setAttribute('aria-label', '대사 입력');
  const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = '말하기';
  form.append(input, submit); form.addEventListener('submit', event => { event.preventDefault(); const value = input.value.trim(); if (value) sendConversation(card, value); });
  $('#actions').append(form);
  $('.journal').scrollTop = 0;
  if (statusText) sayRecord(statusText);
}
async function startConversation(card) {
  if (state.player.embodiment !== card.id) { sayRecord('이야기를 나누려면 먼저 이 사람의 몸을 빌려야 한다.'); return; }
  activeDialogueHost = card.id; updateHud();
  let session = dialogueSessions.get(card.id);
  if (!session && aiBaseUrl) {
    showConversation(card, '대화를 준비하고 있다…', [], '서버 연결을 확인하는 중');
    const controller = new AbortController(); activeDialogueController = controller;
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const saved = sessionStorage.getItem(`v33-rpg-session:${card.id}`);
      if (saved) session = { token: saved };
      else {
        const response = await fetch(`${aiBaseUrl}/api/rpg/session/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ hostId: card.id }), signal: controller.signal });
        if (!response.ok) throw new Error('session unavailable');
        const result = await response.json(); session = { token: result.sessionToken, mode: result.mode };
        if (!session.token) throw new Error('session token missing');
        sessionStorage.setItem(`v33-rpg-session:${card.id}`, session.token);
      }
      dialogueSessions.set(card.id, session);
    } catch { session = null; }
    finally { clearTimeout(timer); activeDialogueController = null; }
    if (activeDialogueHost !== card.id) return;
  }
  const mode = !aiBaseUrl ? '오프라인 대사로 진행한다' : session?.mode === 'BLOCKED_NO_KEY' ? 'BLOCKED_NO_KEY · 인물별 오프라인 대사로 진행한다' : session ? '대화 세션이 준비됐다' : '연결할 수 없어 오프라인 대사로 진행한다';
  showConversation(card, '그 사람이 맡은 일과 알고 있는 범위 안에서 이야기를 나눌 수 있다. 대화만으로 돈이나 퀘스트 결과가 바뀌지는 않는다.', aiScenes.sessions[card.id].fallbackReplies, mode);
}
async function sendConversation(card, playerText, replyId = null) {
  if (activeDialogueHost !== card.id || state.player.embodiment !== card.id) return;
  const intentClass = classifyTypedResponse(playerText);
  const lines = dialogueTranscripts.get(card.id) ?? []; lines.push({ speaker: '나', text: playerText });
  const session = dialogueSessions.get(card.id); let turn = null, fallbackReason = '';
  if (session?.token && !['BLOCKED_NO_KEY', 'BLOCKED_LIMIT'].includes(session.mode) && aiBaseUrl) {
    const controller = new AbortController(); activeDialogueController = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    showConversation(card, '', [], '잠시 생각하는 중…');
    try {
      const response = await fetch(`${aiBaseUrl}/api/rpg/dialogue`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionToken: session.token, requestId: crypto.randomUUID(), playerInput: playerText }), signal: controller.signal });
      if (!response.ok) {
        if (response.status === 429) {
          session.mode = 'BLOCKED_LIMIT'; dialogueSessions.set(card.id, session); sessionStorage.removeItem(`v33-rpg-session:${card.id}`);
          fallbackReason = '대화 요청 한도에 도달해 오프라인 대사로 이어간다';
        }
        throw new Error('dialogue unavailable');
      }
      const data = await response.json(), candidate = data.turn;
      if (candidate?.sceneId !== aiScenes.sessions[card.id].sceneId || !Array.isArray(candidate.beats) || candidate.beats.length < 1 || candidate.beats.length > 2 || !candidate.beats.every(beat => beat && [card.id, 'NARRATION'].includes(beat.speakerId) && typeof beat.textKo === 'string' && beat.textKo.length <= 420) || !Array.isArray(candidate.suggestedReplies) || candidate.suggestedReplies.length < 2 || candidate.suggestedReplies.length > 3 || !candidate.suggestedReplies.every(reply => reply && typeof reply.textKo === 'string' && reply.textKo.length <= 80)) throw new Error('invalid dialogue response');
      turn = candidate; fallbackReason = data.fallback ? data.mode : '';
    } catch { fallbackReason ||= '연결이 늦어 오프라인 대사로 이어간다'; }
    finally { clearTimeout(timer); activeDialogueController = null; }
    if (activeDialogueHost !== card.id) return;
  }
  const local = aiScenes.sessions[card.id];
  if (!turn) turn = { beats: [{ speakerId: card.id, textKo: local.fallbackKo, emotion: 'neutral' }], suggestedReplies: local.fallbackReplies.map((textKo, index) => ({ id: `R${index + 1}`, textKo })) };
  for (const beat of turn.beats) lines.push({ speaker: beat.speakerId === 'NARRATION' ? '기록' : card.displayNameKo, text: beat.textKo });
  dialogueTranscripts.set(card.id, lines.slice(-24));
  const recorded = recordDialogueTurn(state, { hostId: card.id, sceneId: local.sceneId, intentClass }, maps);
  if (recorded.ok) setState(recorded.state);
  const replies = (turn.suggestedReplies ?? []).slice(0, 3);
  showConversation(card, '', replies.map(reply => reply.textKo), `${replyId ? `선택한 말 · ${replyId} · ` : ''}입력 분류 · ${intentLabels[intentClass]} · ${fallbackReason || (session ? '대화 내용을 이 인물의 세션에만 남겼다' : '오프라인 대사 · 게임 진행은 계속할 수 있다')}`);
  $('.journal').scrollTop = $('.journal').scrollHeight;
}
document.addEventListener('keydown', event => {
  const direction = ({ ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' })[event.key];
  if (direction) { event.preventDefault(); move(direction); }
  if (!activeDialogueHost && (event.key === 'e' || event.key === 'E' || event.key === 'Enter')) { event.preventDefault(); interact(); }
  if (!activeDialogueHost && (event.key === 'h' || event.key === 'H')) { event.preventDefault(); openSourceDrawer(); }
  if (event.key === 'Escape' && activeDialogueHost) { finishConversation(activeDialogueHost); return; }
  if (event.key === 'Escape' && state.player.embodiment) { const released = releaseHost(state, currentMap()); if (released.ok) { setState(released.state); say('몸을 놓아주다', '그 사람은 자기 자리에서 계속 살아간다. 네가 본 것과 그 사람이 아는 것은 섞이지 않는다.', []); } }
});
document.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => move(button.dataset.move)));
$('#use').addEventListener('click', interact);
$('#talk').addEventListener('click', () => { const host = cards.find(card => card.id === state.player.embodiment); if (host) startConversation(host); });
$('#release').addEventListener('click', () => { const result = releaseHost(state, currentMap()); if (result.ok) { setState(result.state); say('몸을 놓아주다', '그 사람은 자기 자리에서 계속 살아간다. 네가 본 것과 그 사람이 아는 것은 섞이지 않는다.', []); } });
$('#save').addEventListener('click', () => { localStorage.setItem('v33-rpg-save', saveGame(state)); sayRecord('기록을 저장했다.'); });
$('#load').addEventListener('click', () => {
  const saved = localStorage.getItem('v33-rpg-save');
  if (!saved) return;
  try { setState(loadGame(saved, { maps, hostCards, quests: questList })); restoreJournal(); sayRecord('저장한 현장으로 돌아왔다.'); }
  catch { sayRecord('저장 기록을 읽지 못했다. 새 기록으로 시작해 주세요.'); }
});
$('#ending-restart').addEventListener('click', () => { localStorage.removeItem('v33-rpg-save'); location.reload(); });
function restoreJournal() {
  const latest = state.ledger.at(-1);
  if (latest?.questId && latest.actionId) {
    const action = questsById.get(latest.questId)?.actions.find(item => item.id === latest.actionId);
    if (action) { say('교정쇄에 남긴 결정', action.resultKo, []); return; }
  }
  if (latest?.evidenceId) {
    const clue = sceneObservations.entries[latest.evidenceId];
    if (clue) {
      const hostLine = latest.hostId ? clue.hostLines[latest.hostId] : null;
      say(clue.titleKo, `${hostLine ?? clue.textKo}\n\n${clue.textKo}\n\n${sceneObservations.disclaimerKo}`, []);
      sayRecord('저장한 허구 소품 관찰을 불러왔다.');
      return;
    }
  }
  if (latest?.sourceId) showSourceSummary(sourceRecords.get(latest.sourceId) ?? source);
}
restoreJournal();
updateHud();
requestRender();
$('#record').insertAdjacentHTML('afterend', '<button id="source-drawer-open" type="button">자료철 열기</button>');
$('#source-drawer-open').addEventListener('click', openSourceDrawer);
