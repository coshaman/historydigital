(function attachMain20AiState(root) {
  const RELATIONSHIP_MIN = -3;
  const RELATIONSHIP_MAX = 3;
  const RUN_CAP = 2;

  const SIGNAL_EFFECTS = Object.freeze({
    CIRCLE_PUBLIC_CRITIQUE: { ideology: ['publicLiteraryCriticism', 1], relationship: ['ekaterina', 1], rationale: '원문을 두고 공개적인 문학 비평을 이어 갔다.' },
    CIRCLE_DEFEND_STATE_ORDER: { ideology: ['stateOrder', 1], relationship: ['alexei', 1], rationale: '절차와 질서의 역할을 함께 살폈다.' },
    CIRCLE_SOCIAL_REFORM: { ideology: ['socialReform', 1], relationship: ['pavel', 1], rationale: '사람들의 생활 조건을 대화의 중심에 두었다.' },
    CIRCLE_RADICAL_DISCUSSION: { ideology: ['radicalDiscussion', 1], exposure: 1, rationale: '위험을 감수하는 공개 토론을 택했다.' },
    SOURCE_SKEPTICISM: { ideology: ['evidentialSkepticism', 1], rationale: '주장과 확인된 근거를 구분했다.' },
    BOOKSHOP_BUY: { branchState: ['bookshopChoice', 'bought'], exclusiveGroup: 'BOOKSHOP_CHOICE', rationale: '책을 사기로 했다.' },
    BOOKSHOP_BORROW: { branchState: ['bookshopChoice', 'borrowed'], exclusiveGroup: 'BOOKSHOP_CHOICE', rationale: '책을 빌리기로 했다.' },
    BOOKSHOP_LEAVE: { branchState: ['bookshopChoice', 'left'], exclusiveGroup: 'BOOKSHOP_CHOICE', rationale: '책을 고르지 않고 서점을 나왔다.' },
    LITERATURE_INTEREST: { ideology: ['publicLiteraryCriticism', 1], rationale: '문학을 더 읽어 보려는 관심을 보였다.' },
    SUPPER_SUPPORT: { ideology: ['socialReform', 1], rationale: '동료의 사정을 듣고 곁을 내주었다.' },
    SUPPER_DISAGREE: { branchState: ['supperDisagreement', 1], rationale: '식사 자리에서 의견 차이를 드러냈다.' },
    SUPPER_AVOID_NAME: { branchState: ['protectedNames', 1], rationale: '이름을 거론하지 않고 대화를 이어 갔다.' },
    RELATIONSHIP_WARMTH: { rationale: '둘 사이의 신뢰를 보이는 말로 답했다.' },
    READING_INTERPRETATION: { ideology: ['publicLiteraryCriticism', 1], rationale: '작품의 문장을 구체적으로 해석했다.' },
    READER_EMPATHY: { ideology: ['socialReform', 1], rationale: '인물의 처지를 함께 살폈다.' },
    READING_CAUTION: { ideology: ['stateOrder', 1], rationale: '해석과 확인된 내용을 나누어 말했다.' },
    EXAM_DILIGENCE: { flag: 'late_game_exam_diligence', rationale: '시험 준비 내용을 확인했다.' },
    EXAM_INTEGRITY: { flag: 'late_game_exam_integrity', rationale: '답안의 근거를 확인했다.' },
  });

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizedSnapshot(input) {
    return String(input ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 360);
  }

  function applySceneTurn(previous, turn, scene, playerInput = '') {
    const state = clone(previous ?? {});
    state.ideology = { ...(state.ideology ?? {}) };
    state.relationships = { alexei: 0, ekaterina: 0, pavel: 0, ...(state.relationships ?? {}) };
    state.branchState = { ...(state.branchState ?? {}) };
    state.aiSignalCounts = { ...(state.aiSignalCounts ?? {}) };
    state.aiSceneSignalCaps = clone(state.aiSceneSignalCaps ?? {});
    state.aiAuditLog = Array.isArray(state.aiAuditLog) ? state.aiAuditLog.slice(-99) : [];
    state.flags = Array.isArray(state.flags) ? [...state.flags] : [];
    state.history = Array.isArray(state.history) ? [...state.history] : [];

    const sceneId = scene?.id;
    const allowed = new Set(Array.isArray(scene?.allowedSignals) ? scene.allowedSignals : []);
    const sceneCaps = { ...(state.aiSceneSignalCaps[sceneId] ?? {}) };
    state.aiSceneSignalCaps[sceneId] = sceneCaps;
    const acceptedSignalIds = [];
    const effects = [];
    const relationshipsChanged = new Set();
    const exclusiveGroups = { ...(state.aiExclusiveGroups ?? {}) };
    state.aiExclusiveGroups = exclusiveGroups;

    for (const signal of Array.isArray(turn?.semanticSignals) ? turn.semanticSignals : []) {
      const mapping = SIGNAL_EFFECTS[signal];
      if (!mapping || !allowed.has(signal) || (sceneCaps[signal] ?? 0) >= 1 || (state.aiSignalCounts[signal] ?? 0) >= RUN_CAP) continue;
      if (mapping.exclusiveGroup && exclusiveGroups[mapping.exclusiveGroup]) continue;
      acceptedSignalIds.push(signal);
      sceneCaps[signal] = (sceneCaps[signal] ?? 0) + 1;
      state.aiSignalCounts[signal] = (state.aiSignalCounts[signal] ?? 0) + 1;
      if (mapping.exclusiveGroup) exclusiveGroups[mapping.exclusiveGroup] = sceneId;
      if (mapping.ideology) {
        const [dimension, delta] = mapping.ideology;
        state.ideology[dimension] = Number(state.ideology[dimension] ?? 0) + delta;
        effects.push({ target: `ideology.${dimension}`, delta, reason: mapping.rationale });
      }
      if (mapping.relationship && (scene?.cast ?? []).includes(mapping.relationship[0])) {
        const [characterId, delta] = mapping.relationship;
        state.relationships[characterId] = Math.max(RELATIONSHIP_MIN, Math.min(RELATIONSHIP_MAX, Number(state.relationships[characterId] ?? 0) + delta));
        relationshipsChanged.add(characterId);
        effects.push({ target: `relationships.${characterId}`, delta: state.relationships[characterId] - Number(previous?.relationships?.[characterId] ?? 0), reason: mapping.rationale });
      }
      if (mapping.exposure) {
        state.branchState.exposure = Math.max(0, Number(state.branchState.exposure ?? 0) + mapping.exposure);
        effects.push({ target: 'branchState.exposure', delta: mapping.exposure, reason: mapping.rationale });
      }
      if (mapping.branchState) {
        const [key, value] = mapping.branchState;
        state.branchState[key] = typeof value === 'number' ? Number(state.branchState[key] ?? 0) + value : value;
        effects.push({ target: `branchState.${key}`, value: state.branchState[key], reason: mapping.rationale });
      }
      if (mapping.flag && !state.flags.includes(mapping.flag)) {
        state.flags.push(mapping.flag);
        effects.push({ target: 'flags', value: mapping.flag, reason: mapping.rationale });
      }
    }

    if (allowed.has('RELATIONSHIP_WARMTH')) {
      for (const signal of Array.isArray(turn?.relationshipSignals) ? turn.relationshipSignals : []) {
        if (!['alexei', 'ekaterina', 'pavel'].includes(signal?.characterId) || !(scene?.cast ?? []).includes(signal.characterId) || !['TRUST_UP', 'TRUST_DOWN'].includes(signal?.signal)) continue;
        if (relationshipsChanged.has(signal.characterId)) continue;
        const capId = `RELATIONSHIP:${signal.characterId}:${signal.signal}`;
        if ((sceneCaps[capId] ?? 0) >= 1) continue;
        sceneCaps[capId] = 1;
        const delta = signal.signal === 'TRUST_UP' ? 1 : -1;
        const oldValue = Number(state.relationships[signal.characterId] ?? 0);
        state.relationships[signal.characterId] = Math.max(RELATIONSHIP_MIN, Math.min(RELATIONSHIP_MAX, oldValue + delta));
        relationshipsChanged.add(signal.characterId);
        effects.push({ target: `relationships.${signal.characterId}`, delta: state.relationships[signal.characterId] - oldValue, reason: '관계 신호는 인물별 장면당 한 번만 반영한다.' });
      }
    }

    const turnIndex = Number.isInteger(scene?.turnIndex) ? scene.turnIndex : state.aiAuditLog.length + 1;
    const auditEvent = {
      sceneId: String(sceneId ?? 'UNKNOWN'),
      turnIndex,
      normalizedInputSnapshot: normalizedSnapshot(playerInput),
      acceptedSignalIds,
      effects,
      relevantState: {
        ideology: Object.fromEntries(effects.filter(effect => effect.target.startsWith('ideology.')).map(effect => [effect.target.slice(9), state.ideology[effect.target.slice(9)]])),
        relationships: Object.fromEntries(effects.filter(effect => effect.target.startsWith('relationships.')).map(effect => [effect.target.slice(14), state.relationships[effect.target.slice(14)]])),
        exposure: Number(state.branchState.exposure ?? 0),
      },
    };
    state.aiAuditLog.push(auditEvent);
    state.history.push({ sceneId: auditEvent.sceneId, kind: 'AI_SCENE_SIGNAL', acceptedSignalIds: [...acceptedSignalIds], effects: clone(effects) });
    return { state, auditEvent };
  }

  const api = Object.freeze({ applySceneTurn, normalizedSnapshot, signalIds: Object.keys(SIGNAL_EFFECTS) });
  root.Main20AiStateEngine = api;
  if (typeof module !== 'undefined' && module.exports) {
    exports.applySceneTurn = applySceneTurn;
    exports.normalizedSnapshot = normalizedSnapshot;
    exports.signalIds = Object.keys(SIGNAL_EFFECTS);
  }
})(globalThis);
