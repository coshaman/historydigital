export const CITY_PRODUCTS = Object.freeze([
  { id: 'newspaper_1847_01', titleKo: '《현대인》 1847년 제1호', priceKopeks: 4, kind: 'periodical', sourceId: 'OBJ-SOV-1847' },
  { id: 'newsprint_sheet', titleKo: '신문용 종이 한 묶음', priceKopeks: 3, kind: 'supply' },
  { id: 'printing_ink', titleKo: '인쇄용 잉크 한 병', priceKopeks: 2, kind: 'supply' },
  { id: 'envelope_bundle', titleKo: '발송용 봉투 묶음', priceKopeks: 2, kind: 'supply' },
]);

export const NEWSPAPER_STORIES = Object.freeze([
  { id: 'MARKET_RUMOR_NOTE_E23', titleKo: '장터의 빵값, 말과 장부', date: '1847-01-01', sourceId: 'V37-E23-MARKET-RUMOR', bodyKo: '가격 확인 신청이 접수된 뒤, 빵을 감췄다는 말이 장터에 퍼졌다. 그 말을 전한 행상 마트료나는 장터에서 들었다고 편집부에 전했다. 알렉세이는 가격 확인 신청만 접수했다. 장부 대조 전이라, 빵을 숨겼다는 말은 아직 확인되지 않은 소문이다.', editorialKo: '소문이 전해진 경로와 확인된 절차를 나누어 싣는다.' },
  { id: 'LITERARY_RURAL_LIFE_1847', titleKo: '농촌의 두 사람을 그린 글', date: '1847-06-01', sourceId: 'LIT-TURGENEV-KHOR-KALYNYCH-1847', bodyKo: '이번 문학면은 지주 폴루티킨과 농노 호리·칼리니치를 그린 투르게네프의 글을 다룹니다. 작품 속 인물의 묘사를 실제 농촌 전체의 증언으로 바꾸지 않고, 문학이 누구의 삶을 보여주며 누구의 말을 대신하지 못하는지 묻습니다.', editorialKo: '소설 속 인물의 모습과 실제 농촌 사람들의 경험을 구분해 싣는다.' },
  { id: 'DELIVERY_NOTICE_1848', titleKo: '지방 구독자에게 늦어진 소식', date: '1848-01-01', sourceId: 'OBJ-WS-NEKRASOV-EDITORIAL-1848', bodyKo: '편집부 공고는 지방 구독자에게 잡지가 도착하는 경로와 수령 확인, 분실 뒤 재발송 절차를 알립니다. 확인된 공고의 범위를 넘어 지연 원인을 추측하지 않고, 편집부와 우체국이 독자에게 무엇을 약속했는지 살핍니다.', editorialKo: '발송 안내에 적힌 절차와 독자에게 한 약속을 나란히 보여준다.' },
  { id: 'CIRCLE_REPORT_1849', titleKo: '보고서에는 누가 말했는가', date: '1849-04-22', sourceId: 'OBJ-WS-PETRASHEVSKY-REPORT-1849', bodyKo: '관청 수사 보고서가 모임과 체포 지시를 어떤 출처로 엮었는지 살펴봅니다. 보고서에 적힌 주장은 보고서가 그렇게 기록했다는 사실과 구분해 싣고, 목격·전달·추정이 한 문장에 섞이지 않았는지 묻습니다.', editorialKo: '주장의 출처와 문서의 기록 방식을 함께 밝힌다.' },
]);

const PRESS_STAFF = new Set(['printer_ekaterina', 'editor_sofia', 'nekrasov_reconstruction']);

export function newspaperAssignment(state, hostId, maps = {}) {
  if (!PRESS_STAFF.has(hostId) || !state?.hosts?.[hostId]) return null;
  const host = state.hosts[hostId], civic = state.player.civic ?? {};
  const circulatedStoryIds = new Set((civic.circulatedIssues ?? []).map(entry => civic.publishedIssues?.find(issue => issue.id === entry.issueId)?.storyId).filter(Boolean));
  const story = NEWSPAPER_STORIES.find(item => item.date <= state.world.date && !circulatedStoryIds.has(item.id)
    && (item.id !== 'MARKET_RUMOR_NOTE_E23' || (state.world.livingEventStates?.E23?.editorialNote?.editorHostId === hostId
      && ['EDITORIAL_NOTE_TAKEN', 'NEWSPAPER_PRINTED'].includes(state.world.livingEventStates.E23.stage))));
  if (!story) return null;
  const issue = (civic.publishedIssues ?? []).find(item => item.storyId === story.id);
  const ownsIssue = issue && hasItem(host, `newspaper_issue:${issue.id}`);
  if (ownsIssue) return { titleKo: '신문을 독자에게 전하기', actionKo: `「${story.titleKo}」 배포`, placeKo: '네프스키 거리 신문 가판', reasonKo: '인쇄한 호외를 거리 독자에게 나누거나 지방행 우편에 맡깁니다.', howKo: '호외를 가진 인물로 신문 가판을 살펴보세요.' };
  if (issue) return { titleKo: '인쇄한 신문을 가판으로 옮기기', actionKo: `「${story.titleKo}」 회수`, placeKo: '호외를 가진 인물', reasonKo: '이 호외는 인쇄됐지만 현재 편집자가 가지고 있지 않습니다.', howKo: '발행한 인물에게 몸을 빌려 가판으로 가져가세요.' };
  const knowsArticleSource = story.id === 'MARKET_RUMOR_NOTE_E23'
    ? state.world.livingEventStates?.E23?.editorialNote?.editorHostId === hostId
      && host.inventory.includes('editorial-note:E23')
    : (host.knownEvidenceIds ?? []).includes(story.sourceId);
  if (!knowsArticleSource) {
    if (state.player.observedEvidenceIds?.includes(story.sourceId)) return { titleKo: '확인한 근거를 편집자에게 전달하기', actionKo: `자료 전달 · ${story.titleKo}`, placeKo: '네프스키 인쇄소 편집대', reasonKo: '당신의 자료철에서 확인한 원문은 편집자가 아직 모릅니다.', howKo: '편집대에서 근거를 공유한 뒤 인쇄하세요.' };
    const sourceMaps = Object.values(maps).filter(map => map.layers?.find(layer => layer.name === 'Interactions')?.objects.some(object => object.properties?.some(property => property.name === 'sourceId' && property.value === story.sourceId)));
    const sourceMap = sourceMaps.find(map => map.mapId === state.world.currentMapId) ?? sourceMaps[0];
    const sourcePlace = sourceMap?.metadata?.displayNameKo ?? '네프스키 인쇄소';
    return { titleKo: '근거를 확인해 신문 만들기', actionKo: `자료 읽기 · ${story.titleKo}`, placeKo: sourcePlace, reasonKo: '편집자가 기사 근거를 직접 확인해야 인쇄할 수 있습니다.', howKo: `「${story.sourceId}」 원문을 읽고 편집대로 돌아오세요.` };
  }
  if (!hasItem(host, 'newsprint_sheet') || !hasItem(host, 'printing_ink')) return { titleKo: '신문 재료를 마련하기', actionKo: `신문용 종이와 인쇄용 잉크 구입 · 「${story.titleKo}」`, placeKo: '네프스키 거리 레프의 가판', reasonKo: `종이 3코페이카와 잉크 2코페이카가 필요합니다. 현재 편집자 소지금은 ${host.money?.amount ?? '기록 없음'} 코페이카입니다.`, howKo: '돈이 있는 인물로 레프에게서 재료를 산 뒤 편집자에게 건네세요.' };
  return { titleKo: '근거를 확인해 신문 만들기', actionKo: `호외 인쇄 · ${story.titleKo}`, placeKo: '네프스키 인쇄소 편집대', reasonKo: `확인한 자료 ${story.sourceId}와 종이, 잉크가 준비됐습니다.`, howKo: '편집대에서 호외를 인쇄한 뒤 가판으로 가져가세요.' };
}

const clone = value => structuredClone(value);
const productById = new Map(CITY_PRODUCTS.map(item => [item.id, item]));
const storyById = new Map(NEWSPAPER_STORIES.map(item => [item.id, item]));
const hasItem = (host, id) => host?.inventory?.includes(id);
function ensureCivic(state) {
  state.player.civic ??= { suspicion: 0, custody: null, publishedIssues: [], readIssueIds: [], circulatedIssues: [] };
  state.player.civic.publishedIssues ??= [];
  state.player.civic.readIssueIds ??= [];
  state.player.civic.circulatedIssues ??= [];
  state.player.civic.suspicion ??= 0;
  return state.player.civic;
}
function record(next, eventType, hostId, details) {
  const event = { eventId: `${eventType}_${next.ledger.length + 1}`, eventType, date: next.world.date, mapId: next.world.currentMapId, hostId, ...details };
  next.ledger.push(event);
}

export function purchaseCityProduct(state, { hostId, productId } = {}) {
  const product = productById.get(productId), host = state?.hosts?.[hostId];
  if (!product || !host) return { ok: false, reason: 'unknown_product_or_host', state };
  if (state.player.civic?.custody?.active) return { ok: false, reason: 'custody_active', state };
  if (!Number.isFinite(host.money?.amount)) return { ok: false, reason: 'money_not_established', state };
  if (host.money.amount < product.priceKopeks) return { ok: false, reason: 'insufficient_funds', state };
  const bookseller = state.hosts.bookseller_lev;
  if (product.kind === 'periodical' && (hostId === 'bookseller_lev' || state.world.currentMapId !== 'nevsky'
    || host.mapId !== 'nevsky' || !bookseller || bookseller.mapId !== 'nevsky'
    || !Number.isFinite(bookseller.money?.amount) || bookseller.money.unit !== 'kopeks'
    || Math.abs(host.position.x - bookseller.position.x) + Math.abs(host.position.y - bookseller.position.y) > 3)) {
    return { ok: false, reason: 'periodical_counter_unavailable', state };
  }
  if (product.kind === 'periodical' && !bookseller.inventory?.includes(product.id)) return { ok: false, reason: 'periodical_out_of_stock', state };
  const next = clone(state);
  next.hosts[hostId].money.amount -= product.priceKopeks;
  next.hosts[hostId].inventory.push(product.id);
  if (product.kind === 'periodical') {
    const seller = next.hosts.bookseller_lev;
    seller.inventory.splice(seller.inventory.indexOf(product.id), 1);
    seller.money.amount += product.priceKopeks;
    next.world.livingEventStates ??= {};
    if (product.id === 'newspaper_1847_01' && !next.world.livingEventStates.E22) {
      const scenePosition = { ...host.position };
      const witnessHostIds = Object.values(next.hosts).filter(person => ![host.id, seller.id].includes(person.id)
        && person.historicalAliveAndPresent !== false && person.mapId === 'nevsky'
        && Math.abs(person.position.x - scenePosition.x) + Math.abs(person.position.y - scenePosition.y) <= 4)
        .map(person => person.id).sort();
      next.world.livingEventStates.E22 = { catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E22',
        status: 'ACTIVE', stage: 'ISSUE_SOLD', trigger: 'verified_1847_periodical_copy_sold_at_nevsky_counter',
        occurrenceType: 'HISTORICALLY_PLAUSIBLE_RECONSTRUCTION', validationStatus: 'DESIGN_SEED_NOT_VERIFIED',
        valueStatus: 'fictional_gameplay_balance', sourceId: product.sourceId, sourceKind: 'PRIMARY_BIBLIOGRAPHIC_RECORD',
        sourceUrl: 'https://rusneb.ru/catalog/000199_000009_007828983/', issueId: product.id,
        issueTitleKo: product.titleKo, sellerHostId: seller.id, buyerHostId: host.id,
        actorHostIds: [seller.id, host.id], witnessHostIds: witnessHostIds,
        scenePosition, startedAtMinute: state.world.clockMinutes, autoResolveAtMinute: state.world.clockMinutes + 60,
        paidAmount: product.priceKopeks, currency: 'kopeks', resolutionActionId: null };
    }
  }
  record(next, 'CITY_PURCHASE', hostId, { productId, priceKopeks: product.priceKopeks });
  if (product.kind === 'periodical') record(next, 'NEWSPAPER_ISSUE_SOLD', 'bookseller_lev', {
    catalogIdSpace: 'V37_EVENT_CATALOG_45', catalogEventId: 'E22', buyerHostId: hostId,
    issueId: product.id, sourceId: product.sourceId, priceKopeks: product.priceKopeks,
    valueStatus: 'fictional_gameplay_balance' });
  return { ok: true, state: next, product };
}

export function publishNewspaperIssue(state, { hostId, storyId, mapId = 'printshop' } = {}) {
  const story = storyById.get(storyId), host = state?.hosts?.[hostId];
  if (!story || !host) return { ok: false, reason: 'unknown_story_or_host', state };
  if (!['printer_ekaterina', 'editor_sofia', 'nekrasov_reconstruction'].includes(hostId)) return { ok: false, reason: 'not_newsroom_staff', state };
  if (state.world.currentMapId !== mapId || host.mapId !== mapId) return { ok: false, reason: 'not_at_newsroom', state };
  if (story.date > state.world.date) return { ok: false, reason: 'story_not_yet_available', state };
  if (story.id === 'MARKET_RUMOR_NOTE_E23') {
    const event = state.world.livingEventStates?.E23;
    if (event?.stage !== 'EDITORIAL_NOTE_TAKEN' || event.editorialNote?.editorHostId !== hostId
      || !hasItem(host, 'editorial-note:E23')) return { ok: false, reason: 'market_interview_note_missing', state };
  }
  if (story.id !== 'MARKET_RUMOR_NOTE_E23' && !(host.knownEvidenceIds ?? []).includes(story.sourceId))
    return { ok: false, reason: 'source_not_read_by_editor', state };
  if (!hasItem(host, 'newsprint_sheet') || !hasItem(host, 'printing_ink')) return { ok: false, reason: 'printing_supplies_missing', state };
  const next = clone(state), civic = ensureCivic(next), nextId = `CITY_ISSUE_${civic.publishedIssues.length + 1}`;
  next.hosts[hostId].inventory.splice(next.hosts[hostId].inventory.indexOf('newsprint_sheet'), 1);
  next.hosts[hostId].inventory.splice(next.hosts[hostId].inventory.indexOf('printing_ink'), 1);
  next.hosts[hostId].inventory.push(`newspaper_issue:${nextId}`);
  const issue = { id: nextId, storyId, titleKo: story.titleKo, bodyKo: story.bodyKo, editorialKo: story.editorialKo,
    sourceId: story.sourceId, publishedDate: state.world.date, publisherHostId: hostId };
  if (story.id === 'MARKET_RUMOR_NOTE_E23') {
    const event = next.world.livingEventStates.E23;
    issue.eventId = 'E23'; issue.sourceEventId = 'E13'; issue.claimStatus = 'UNVERIFIED';
    issue.witnessHostIds = [...event.editorialNote.witnessHostIds];
    event.stage = 'NEWSPAPER_PRINTED'; event.newspaperIssueId = nextId; event.newspaperPublishedAtMinute = next.world.clockMinutes;
    next.hosts[hostId].inventory.splice(next.hosts[hostId].inventory.indexOf('editorial-note:E23'), 1);
  }
  civic.publishedIssues.push(issue);
  record(next, 'NEWSPAPER_PUBLISHED', hostId, { issueId: nextId, storyId, sourceId: story.sourceId,
    ...(issue.eventId ? { eventId: issue.eventId, sourceEventId: issue.sourceEventId, witnessHostIds: [...issue.witnessHostIds], claimStatus: issue.claimStatus } : {}) });
  return { ok: true, state: next, issue };
}

export function shareSourceWithEditor(state, { hostId, sourceId } = {}) {
  const host = state?.hosts?.[hostId];
  if (!PRESS_STAFF.has(hostId) || !host || state.player.embodiment !== hostId || state.world.currentMapId !== 'printshop' || host.mapId !== 'printshop') return { ok: false, reason: 'not_at_newsroom', state };
  if (![...storyById.values()].some(story => story.sourceId === sourceId)) return { ok: false, reason: 'source_not_used_by_current_issue', state };
  if (!(state.player.observedEvidenceIds ?? []).includes(sourceId)) return { ok: false, reason: 'source_not_read_by_player', state };
  if ((host.knownEvidenceIds ?? []).includes(sourceId)) return { ok: true, state, alreadyKnown: true };
  const next = clone(state);
  next.hosts[hostId].knownEvidenceIds.push(sourceId);
  record(next, 'EDITORIAL_SOURCE_SHARED', hostId, { sourceId, from: 'player_archive' });
  return { ok: true, state: next };
}

export function readNewspaperIssue(state, { hostId, issueId } = {}) {
  const host = state?.hosts?.[hostId], civic = state?.player?.civic;
  const issue = civic?.publishedIssues?.find(item => item.id === issueId);
  const owned = Boolean(host && hasItem(host, `newspaper_issue:${issueId}`));
  const publicCopy = Boolean(civic?.circulatedIssues?.some(entry => entry.issueId === issueId && entry.route === 'street')
    && state.world.currentMapId === 'nevsky' && host?.mapId === 'nevsky');
  if (!host || !issue || (!owned && !publicCopy)) return { ok: false, reason: 'issue_not_owned', state };
  if (state.ledger?.some(entry => entry.eventType === 'NEWSPAPER_READ' && entry.issueId === issueId && entry.hostId === hostId)) return { ok: true, state, issue, alreadyRead: true };
  const next = clone(state), nextCivic = ensureCivic(next);
  if (!nextCivic.readIssueIds.includes(issueId)) nextCivic.readIssueIds.push(issueId);
  if (issue.eventId !== 'E23' && !next.hosts[hostId].knownEvidenceIds.includes(issue.sourceId))
    next.hosts[hostId].knownEvidenceIds.push(issue.sourceId);
  if (issue.eventId === 'E23' && issue.sourceEventId === 'E13') {
    const event = next.world.livingEventStates?.E23;
    event.newspaperReaderHostIds ??= [];
    if (!event.newspaperReaderHostIds.includes(hostId)) event.newspaperReaderHostIds.push(hostId);
    next.hosts[hostId].knownRumors ??= [];
    const memory = { eventId: 'E23', sourceEventId: 'E13', status: 'UNVERIFIED', fromHostId: issue.publisherHostId,
      atMinute: next.world.clockMinutes, recordNumber: null, newspaperIssueId: issueId };
    const index = next.hosts[hostId].knownRumors.findIndex(row => row.eventId === 'E23');
    if (index < 0) next.hosts[hostId].knownRumors.push(memory); else next.hosts[hostId].knownRumors[index] = memory;
    next.world.rumorPropagationLog ??= [];
    next.world.rumorPropagationLog.push({ recipientHostId: hostId, ...memory });
  }
  record(next, 'NEWSPAPER_READ', hostId, { issueId, sourceId: issue.sourceId, publicCopy: !owned });
  return { ok: true, state: next, issue, alreadyRead: false };
}

export function circulateNewspaperIssue(state, { hostId, issueId, route = 'street' } = {}) {
  const host = state?.hosts?.[hostId], issue = state?.player?.civic?.publishedIssues?.find(item => item.id === issueId);
  if (!host || !issue || !hasItem(host, `newspaper_issue:${issueId}`)) return { ok: false, reason: 'issue_not_owned', state };
  if (!['street', 'postal'].includes(route)) return { ok: false, reason: 'unknown_circulation_route', state };
  if (route === 'postal' && !hasItem(host, 'envelope_bundle')) return { ok: false, reason: 'envelope_missing', state };
  if (route === 'postal' && (!Number.isFinite(host.money?.amount) || host.money.amount < 4)) return { ok: false, reason: 'insufficient_postage', state };
  const next = clone(state), civic = ensureCivic(next), nextHost = next.hosts[hostId], issueItem = `newspaper_issue:${issueId}`;
  nextHost.inventory.splice(nextHost.inventory.indexOf(issueItem), 1);
  if (route === 'postal') {
    nextHost.inventory.splice(nextHost.inventory.indexOf('envelope_bundle'), 1);
    nextHost.money.amount -= 4;
  }
  civic.circulatedIssues.push({ issueId, route, date: next.world.date, hostId });
  if (issue.eventId === 'E23' && issue.sourceEventId === 'E13') {
    const event = next.world.livingEventStates?.E23;
    if (event) event.newspaperCirculatedAtMinute = next.world.clockMinutes;
  }
  record(next, 'NEWSPAPER_CIRCULATED', hostId, { issueId, route, postageKopeks: route === 'postal' ? 4 : 0 });
  return { ok: true, state: next, issue, route };
}

export function commitSuspiciousAct(state, { hostId, actId, witnessIds = [], maps } = {}) {
  const host = state?.hosts?.[hostId];
  const acts = {
    TAKE_UNPAID_NEWSPAPER: { itemId: 'newspaper_1847_01', titleKo: '신문을 값을 치르지 않고 가져감' },
    OPEN_SEALED_DISPATCH: { itemId: null, titleKo: '봉인된 발송 묶음을 허락 없이 엶' },
    ALTER_CIRCULATION_REGISTER: { itemId: null, titleKo: '발송 장부의 기록을 몰래 고침' },
  };
  const act = acts[actId];
  if (!host || !act || !maps?.['police-station'] || state.player.embodiment !== hostId) return { ok: false, reason: 'invalid_suspicious_act', state };
  if (state.player.civic?.custody?.active) return { ok: false, reason: 'custody_active', state };
  const next = clone(state), civic = ensureCivic(next), witnessed = [...new Set(witnessIds.filter(id => id !== hostId))];
  civic.suspicion = Math.min(3, civic.suspicion + 1);
  if (act.itemId) next.hosts[hostId].inventory.push(act.itemId);
  record(next, 'SUSPICIOUS_ACT', hostId, { actId, witnessedBy: witnessed });
  const arrested = witnessed.length > 0 || civic.suspicion >= 2;
  if (arrested) {
    const station = maps['police-station'], spawn = station.metadata?.detentionArrival ?? station.metadata?.observerStart ?? { x: 3, y: 7 };
    civic.custody = { active: true, hostId, reasonKo: act.titleKo, actId, arrestedAt: next.world.date, witnessedBy: witnessed, stolenItemId: act.itemId };
    next.world.currentMapId = 'police-station';
    next.hosts[hostId].mapId = 'police-station';
    next.hosts[hostId].position = { ...spawn };
    next.player.position = { ...spawn };
    record(next, 'POLICE_CUSTODY', hostId, { actId, witnessedBy: witnessed });
  }
  return { ok: true, state: next, act, witnessed, arrested };
}

export function resolvePoliceCustody(state, { resolution } = {}) {
  const civic = state?.player?.civic, custody = civic?.custody, host = custody?.active && state.hosts[custody.hostId];
  if (!host || state.world.currentMapId !== 'police-station') return { ok: false, reason: 'not_in_custody', state };
  if (!['pay_fine', 'give_statement'].includes(resolution)) return { ok: false, reason: 'unknown_resolution', state };
  if (resolution === 'pay_fine' && (!Number.isFinite(host.money?.amount) || host.money.amount < 8)) return { ok: false, reason: 'insufficient_funds', state };
  const next = clone(state), nextCivic = ensureCivic(next), nextCustody = nextCivic.custody, nextHost = next.hosts[nextCustody.hostId];
  if (resolution === 'pay_fine') nextHost.money.amount -= 8;
  if (nextCustody.stolenItemId) {
    const index = nextHost.inventory.indexOf(nextCustody.stolenItemId);
    if (index >= 0) nextHost.inventory.splice(index, 1);
  }
  nextCustody.active = false;
  nextCustody.resolution = resolution;
  nextCustody.releasedAt = next.world.date;
  nextCivic.suspicion = 0;
  record(next, 'POLICE_RELEASE', nextCustody.hostId, { resolution, fineKopeks: resolution === 'pay_fine' ? 8 : 0, stolenItemReturned: Boolean(nextCustody.stolenItemId) });
  return { ok: true, state: next, resolution };
}

export function productLabel(productId) {
  return productById.get(productId)?.titleKo ?? productById.get(productId.replace(/^newspaper_issue:.+$/, ''))?.titleKo ?? productId;
}

export function publishedIssueLabel(state, itemId) {
  const issueId = String(itemId).match(/^newspaper_issue:(.+)$/)?.[1];
  return state.player.civic?.publishedIssues?.find(item => item.id === issueId)?.titleKo ?? null;
}
