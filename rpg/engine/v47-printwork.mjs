const stageRows = [
  {
    title: '활자 상자', prompt: '활자함에서 한 글자씩 골라 표제란을 채운다. 교정 인쇄에서 예고 목차와 맞는지 확인한다.',
    choices: [
      ['V47_PRINT_TITLE_TALNIKOVY', 'Семейство Тальниковых', '예고 목차와 같은 제목으로 활자를 맞춘다.', true],
      ['V47_PRINT_TITLE_WRONG_CASE', 'Семейство Тальникова', '끝 글자를 바꾸어 조판한다.', false],
      ['V47_PRINT_TITLE_SHORT', 'Тальниковы', '제목을 줄여 조판한다.', false],
    ],
  },
  {
    title: '교정쇄와 납기', prompt: '교정할 시간을 더 쓸지, 현재 쇄를 바로 인쇄대로 보낼지 정한다.',
    choices: [
      ['V47_PRINT_CHECK_PROOF', '교정쇄를 다시 대조한다', '작업이 늦어지고 종이 한 장을 더 쓰지만 수정 흔적을 남긴다.', true],
      ['V47_PRINT_RUSH_PROOF', '지금 인쇄대로 보낸다', '납기는 지키기 쉽지만 잘못된 글자가 남을 수 있다.', true],
    ],
  },
  {
    title: '종이와 잉크', prompt: '남은 작업 재료를 어떤 상태로 쓸지 고른다.',
    choices: [
      ['V47_PRINT_USE_DRY_STOCK', '마른 종이와 얇은 잉크를 쓴다', '종이를 아끼려면 인쇄 속도를 늦춰야 한다.', true],
      ['V47_PRINT_USE_DAMP_STOCK', '젖은 종이에 잉크를 더 올린다', '빨리 찍을 수 있지만 번진 장이 생길 수 있다.', true],
    ],
  },
  {
    title: '구독 주문 묶음', prompt: '기다리는 구독자 몫을 먼저 어떻게 처리할까?',
    choices: [
      ['V47_PRINT_SEND_SUBSCRIPTIONS', '구독자에게 지연을 알린다', '주문 장부를 정리해 알림을 보낸다. 인쇄된 책은 작업장에 남는다.', true],
      ['V47_PRINT_HOLD_SUBSCRIPTIONS', '주문 장부를 편집실에 둔다', '주문을 보류하고 인쇄분과 함께 편집부에서 관리한다.', true],
    ],
  },
  {
    title: '서점에 출고 보류 알리기', prompt: '인쇄분을 보내지 않고 서점에 주문 처리 방침을 전한다.',
    choices: [
      ['V47_PRINT_CONSIGN_BOOKSHOP', '레프에게 출고 보류 통지를 보낸다', '파벨이 통지만 서점에 전한다. 책은 인쇄소를 떠나지 않고 대금도 오가지 않는다.', true],
      ['V47_PRINT_RETURN_BOOKSHOP', '서점 주문을 취소하고 장부를 정리한다', '주문을 취소한다. 인쇄분은 편집부가 계속 보관한다.', true],
    ],
  },
  {
    title: '작업자 확인본', prompt: '인쇄 작업자가 완성된 한 부를 볼 수 있게 할까?',
    choices: [
      ['V47_PRINT_SHARE_WORKER_COPY', '스테판에게 확인본을 건넨다', '작업자 한 명이 책을 읽고 인쇄소 동료도 그 사실을 알 수 있다.', true],
      ['V47_PRINT_KEEP_EDITOR_COPY', '확인본을 편집부에 둔다', '작업자는 책을 보지 못하고 확인본은 편집실에 남는다.', true],
    ],
  },
  {
    title: '남은 종이', prompt: '남은 낱장을 재료로 돌릴지, 제본 전 사본으로 남길지 정한다.',
    choices: [
      ['V47_PRINT_RECYCLE_REMAINDER', '남은 종이를 재료로 돌린다', '종이 조각은 다음 작업에 쓰고, 별도 사본은 남지 않는다.', true],
      ['V47_PRINT_SAVE_UNBOUND_COPY', '제본 전 사본을 남긴다', '완성되지 않은 인쇄지가 편집부에 남고 보관 사실을 알게 된다.', true],
    ],
  },
];

const almanacTitle = 'Семейство Тальниковых';
const typeTiles = [
  ...[...almanacTitle].map((glyph, index) => ({ id: `sort-${String(index).padStart(2, '0')}`, glyph })),
  ...['я', 'д', 'э'].map((glyph, index) => ({ id: `sort-decoy-${index}`, glyph })),
];

export function createMain01PrintworkState() {
  return { schemaVersion: 'V47_PRINTWORK_V2', step: 0, status: 'IN_PROGRESS', decisions: [], allocations: [], outgoingItems: [],
    distributionInvariantVersion: 1, publicDistributionOccurred: false, proofChecked: false, spoiledSheets: 0, workMinutes: 0, risk: 0,
    inventory: { dryPaper: 4, dampPaper: 4, ink: 8 } };
}

const legacyDistributionItems = new Set(['구독자 주문용 연감 묶음', '서점 위탁 연감 묶음']);
const legacyDistributionActions = new Set(['V47_PRINT_SEND_SUBSCRIPTIONS', 'V47_PRINT_CONSIGN_BOOKSHOP']);

export function migrateMain01DistributionState(campaignState) {
  const currentPrintwork = campaignState?.world?.v47?.printwork;
  if (!currentPrintwork || currentPrintwork.distributionInvariantVersion >= 1) return campaignState;
  const next = structuredClone(campaignState);
  const printwork = next.world.v47.printwork;
  const packages = (printwork.outgoingItems ?? []).filter(item => legacyDistributionItems.has(item.itemKo));
  const recoveredCount = packages.length;
  printwork.outgoingItems = (printwork.outgoingItems ?? []).filter(item => !legacyDistributionItems.has(item.itemKo));
  printwork.publicDistributionOccurred = false;
  printwork.distributionInvariantVersion = 1;

  for (const host of Object.values(next.hosts ?? {}))
    if (Array.isArray(host.inventory)) host.inventory = host.inventory.filter(item => !legacyDistributionItems.has(item));
  const editor = next.hosts?.editor_sofia;
  if (editor && Array.isArray(editor.inventory))
    editor.inventory.push(...Array.from({ length: recoveredCount }, () => '회수한 연감 인쇄분'));

  let refund = 0;
  for (const entry of next.ledger ?? []) {
    if (entry.eventType !== 'V47_PRINTWORK_STEP' || !legacyDistributionActions.has(entry.actionId)) continue;
    const effects = entry.effects ?? {};
    for (const transfer of effects.money ?? [])
      if (transfer.fromHostId === 'bookseller_lev' && transfer.toHostId === 'editor_sofia') refund += transfer.amount;
    entry.effects = {
      ...effects,
      items: (effects.items ?? []).filter(item => !legacyDistributionItems.has(item.itemKo)),
      money: (effects.money ?? []).filter(transfer => !(transfer.fromHostId === 'bookseller_lev' && transfer.toHostId === 'editor_sofia')),
      moves: (effects.moves ?? []).filter(move => !(move.hostId === 'courier_pavel' && move.mapId === 'bookshop-interior')),
    };
    entry.historicalCorrectionKo = '배포 금지 전에는 책을 서점이나 구독자에게 보내지 않았다. 인쇄분은 회수해 보관하고 배송 대금은 취소했다.';
  }
  if (refund && next.hosts?.bookseller_lev?.money && editor?.money) {
    next.hosts.bookseller_lev.money.amount += refund;
    editor.money.amount -= refund;
  }

  for (const change of next.world.v47.worldChanges ?? []) {
    if (change.questId !== 'V47_MAIN01_PERMISSION' || !legacyDistributionActions.has(change.actionId)) continue;
    change.items = (change.items ?? []).filter(item => !legacyDistributionItems.has(item.itemKo));
    change.money = (change.money ?? []).filter(transfer => !(transfer.fromHostId === 'bookseller_lev' && transfer.toHostId === 'editor_sofia'));
    change.moves = (change.moves ?? []).filter(move => !(move.hostId === 'courier_pavel' && move.mapId === 'bookshop-interior'));
    change.historicalCorrectionKo = '인쇄분의 발송을 취소하고 작업장 보관으로 되돌렸다.';
  }
  for (const consequence of next.world.v47.stories?.MAIN01?.consequences ?? []) {
    if (!legacyDistributionActions.has(consequence.actionId)) continue;
    consequence.itemRecipients = (consequence.itemRecipients ?? []).filter(id => id !== 'courier_pavel');
    consequence.money = [];
    consequence.historicalCorrectionKo = '서점 출고를 취소하고 인쇄분을 회수했다.';
  }
  const travel = next.hosts?.courier_pavel?.v47TravelGoal;
  if (travel?.questId === 'V47_MAIN01_PERMISSION' && legacyDistributionActions.has(travel.actionId))
    delete next.hosts.courier_pavel.v47TravelGoal;
  return next;
}

export function main01PrintworkStage(state) {
  const stage = stageRows[state?.step];
  if (!stage || state?.status === 'COMPLETE') return null;
  return {
    title: stage.title,
    prompt: stage.prompt,
    choices: stage.choices.map(([id, label, detail, valid]) => ({ id, label, detail, valid })),
    ...(state.step === 0 ? { typeSetter: {
      composition: [...(state.composition ?? [])],
      targetLength: [...almanacTitle].length,
      canImpress: (state.composition?.length ?? 0) === [...almanacTitle].length,
      rack: typeTiles.filter(tile => !(state.usedTypeTiles ?? []).includes(tile.id)),
    } } : {}),
  };
}

function choiceEffects(state, id) {
  const effects = { items: [], money: [], relationships: [], moves: [], riskDelta: 0, wasteDelta: 0 };
  if (id === 'V47_PRINT_CHECK_PROOF') {
    state.proofChecked = true; state.workMinutes += 20; state.inventory.dryPaper -= 1; state.inventory.ink -= 1;
    effects.items.push({ hostId: 'editor_sofia', itemKo: '대조한 연감 교정쇄' });
  }
  if (id === 'V47_PRINT_RUSH_PROOF') {
    state.workMinutes += 5; state.spoiledSheets += 1; state.inventory.dryPaper -= 1; state.inventory.ink -= 1; effects.wasteDelta += 1;
    effects.items.push({ hostId: 'editor_sofia', itemKo: '미대조 연감 교정쇄' });
  }
  if (id === 'V47_PRINT_USE_DRY_STOCK') {
    state.inventory.dryPaper -= 1; state.inventory.ink -= 1;
    effects.items.push({ hostId: 'editor_sofia', itemKo: '마른 종이로 찍은 연감 인쇄지' });
  }
  if (id === 'V47_PRINT_USE_DAMP_STOCK') {
    state.inventory.dampPaper -= 1; state.inventory.ink -= 2;
    state.spoiledSheets += 2; effects.wasteDelta += 2;
    effects.items.push({ hostId: 'editor_sofia', itemKo: '번진 연감 인쇄지' });
  }
  const producedItem = (hostId, itemKo) => effects.items.push({ hostId, itemKo });
  switch (id) {
    case 'V47_PRINT_SEND_SUBSCRIPTIONS':
      producedItem('editor_sofia', '구독자 주문 확인표'); break;
    case 'V47_PRINT_HOLD_SUBSCRIPTIONS': producedItem('editor_sofia', '보류한 구독자 주문 묶음'); break;
    case 'V47_PRINT_CONSIGN_BOOKSHOP':
      producedItem('courier_pavel', '서점 출고 보류 통지');
      effects.moves.push({ hostId: 'courier_pavel', mapId: 'bookshop-interior', x: 7, y: 9, activityKo: '연감 출고를 보류한다는 통지를 서점에 전한다' }); break;
    case 'V47_PRINT_RETURN_BOOKSHOP': producedItem('editor_sofia', '반품 대비 연감 묶음'); break;
    case 'V47_PRINT_SHARE_WORKER_COPY':
      producedItem('print_apprentice_stepan', '작업자 확인용 연감 한 부');
      effects.relationships.push({ fromHostId: 'print_apprentice_stepan', toHostId: 'editor_sofia', trustDelta: 1 }); break;
    case 'V47_PRINT_KEEP_EDITOR_COPY': producedItem('editor_sofia', '편집부 확인용 연감 한 부'); break;
    case 'V47_PRINT_RECYCLE_REMAINDER': producedItem('printer_ekaterina', '종이 조각'); break;
    case 'V47_PRINT_SAVE_UNBOUND_COPY': producedItem('editor_sofia', '제본 전 연감 인쇄지'); effects.riskDelta += 1; break;
  }
  return effects;
}

export function resolveMain01Printwork(previousState, actionId) {
  const state = structuredClone(previousState ?? createMain01PrintworkState());
  if (state.step === 0 && actionId.startsWith('V47_PRINT_TYPE_TILE:')) {
    const tileId = actionId.slice('V47_PRINT_TYPE_TILE:'.length);
    const tile = typeTiles.find(row => row.id === tileId);
    if (!tile || (state.usedTypeTiles ?? []).includes(tileId) || (state.composition?.length ?? 0) >= [...almanacTitle].length) {
      return { accepted: false, state, reason: 'type_unavailable' };
    }
    state.composition ??= [];
    state.usedTypeTiles ??= [];
    state.composition.push(tile.glyph);
    state.usedTypeTiles.push(tileId);
    return { accepted: true, state, effects: { items: [], money: [], relationships: [], moves: [], riskDelta: 0, wasteDelta: 0 } };
  }
  if (state.step === 0 && ['V47_PRINT_TYPE_UNDO', 'V47_PRINT_TYPE_RESET'].includes(actionId)) {
    state.composition ??= [];
    state.usedTypeTiles ??= [];
    if (actionId === 'V47_PRINT_TYPE_RESET') {
      state.composition = [];
      state.usedTypeTiles = [];
    } else if (state.composition.length) {
      state.composition.pop();
      state.usedTypeTiles.pop();
    }
    return { accepted: true, state, effects: { items: [], money: [], relationships: [], moves: [], riskDelta: 0, wasteDelta: 0 } };
  }
  if (state.step === 0 && actionId === 'V47_PRINT_IMPRESS_TITLE') {
    if ((state.composition?.length ?? 0) !== [...almanacTitle].length) {
      return { accepted: false, state, reason: 'incomplete_typesetting' };
    }
    const composedTitle = state.composition.join('');
    if (composedTitle !== almanacTitle) {
      state.miscomposedTitles = (state.miscomposedTitles ?? 0) + 1;
      state.spoiledSheets += 1;
      state.workMinutes += 4;
      state.inventory.dryPaper = Math.max(0, state.inventory.dryPaper - 1);
      state.composition = [];
      state.usedTypeTiles = [];
      return { accepted: false, state, reason: 'title_mismatch', effects: { wasteDelta: 1 } };
    }
    state.titleSet = true;
    state.decisions.push('V47_PRINT_TITLE_TALNIKOVY');
    state.step = 1;
    return { accepted: true, state, effects: { items: [], money: [], relationships: [], moves: [], riskDelta: 0, wasteDelta: 0 } };
  }
  const stage = stageRows[state.step];
  const option = stage?.choices.find(([id]) => id === actionId);
  if (!option || state.status === 'COMPLETE') return { accepted: false, state, reason: 'choice_unavailable' };
  const effects = { items: [], money: [], relationships: [], moves: [], riskDelta: 0, wasteDelta: 0 };
  if (state.step === 0 && !option[3]) {
    state.miscomposedTitles = (state.miscomposedTitles ?? 0) + 1;
    state.spoiledSheets += 1; state.workMinutes += 10; state.inventory.dryPaper -= 1;
    return { accepted: false, state, reason: 'title_mismatch', effects: { ...effects, wasteDelta: 1 } };
  }
  if ((['V47_PRINT_CHECK_PROOF', 'V47_PRINT_RUSH_PROOF'].includes(actionId)
      && (state.inventory.dryPaper < 1 || state.inventory.ink < 1))
    || (actionId === 'V47_PRINT_USE_DRY_STOCK' && (state.inventory.dryPaper < 1 || state.inventory.ink < 1))
    || (actionId === 'V47_PRINT_USE_DAMP_STOCK' && (state.inventory.dampPaper < 1 || state.inventory.ink < 2))) {
    return { accepted: false, state, reason: 'materials_unavailable' };
  }
  state.decisions.push(actionId);
  if (state.step >= 3) state.allocations.push({ stage: state.step, actionId });
  const applied = choiceEffects(state, actionId);
  state.outgoingItems.push(...applied.items.map(item => ({ ...item, toHostId: item.hostId, stage: state.step })));
  effects.items.push(...applied.items); effects.money.push(...applied.money);
  effects.moves.push(...applied.moves);
  effects.relationships.push(...applied.relationships); effects.riskDelta += applied.riskDelta;
  effects.wasteDelta += applied.wasteDelta;
  state.risk = (state.risk ?? 0) + applied.riskDelta;
  state.step += 1;
  if (state.step >= stageRows.length) state.status = 'COMPLETE';
  return { accepted: true, state, effects };
}
