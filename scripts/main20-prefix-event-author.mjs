const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;

export function buildPrefixEventNodes(graph, sources = []) {
  const sourceCatalog = new Map(sources.map(source => [source?.sourceId ?? source?.id, source]).filter(([id]) => id));
  const nodes = [];
  const visit = (hubIndex, prefix, predecessorNodeId) => {
    if (hubIndex >= graph.hubs.length) return;
    const hub = graph.hubs[hubIndex];
    const owned = graph.branches.filter(branch => branch.hubId === hub.id);
    for (const branch of owned) {
      const choiceId = branch.choiceId ?? branch.id;
      const requiredPrefix = [...prefix, choiceId];
      const id = `NODE-${requiredPrefix.join('--')}`;
      const allSelected = requiredPrefix.map(selected => graph.branches.find(item => (item.choiceId ?? item.id) === selected));
      if (allSelected.some(selected => !selected)) throw new Error(`${id}: route prefix refers to an unknown choice`);
      const sourceIds = [...new Set(allSelected.flatMap(selected => [
        ...(selected.sourceIds ?? []),
        ...(graph.choiceSourceIds?.[selected.choiceId] ?? []),
        ...(selected.eventSourceIds ?? []),
        ...(graph.eventSourceIdsByChoice?.[selected.choiceId] ?? [])
      ]))];
      for (const sourceId of sourceIds) {
        const source = sourceCatalog.get(sourceId);
        if (!source) throw new Error(`${id}: missing source record ${sourceId}`);
        const availability = source.availabilityDate ?? source.availableDate;
        if (/^\d{4}-\d{2}-\d{2}$/.test(availability ?? '') && availability > hub.date) {
          throw new Error(`${id}: source ${sourceId} is not available until ${availability}`);
        }
      }
      const priorChoiceIds = requiredPrefix.slice(0, -1);
      const interactionLines = priorChoiceIds.map(afterChoiceId => {
        const interaction = graph.pairwiseInteractions?.find(item => item.currentChoiceId === choiceId && item.afterChoiceId === afterChoiceId);
        if (!interaction?.line || !nonEmpty(interaction.line.text)) throw new Error(`${id}: missing authored callback for ${afterChoiceId} -> ${choiceId}`);
        return { ...interaction.line, provenance: 'FICTIONAL_DIALOGUE', dialogueRole: 'route_callback', callbackForChoiceId: afterChoiceId };
      });
      const dialogue = [...interactionLines, ...(branch.speakerLines ?? []).map(line => ({
        speaker: line.speaker,
        situation: line.situation,
        text: line.text,
        provenance: 'FICTIONAL_DIALOGUE',
        dialogueRole: 'branch_scene'
      }))];
      if (!dialogue.length || dialogue.some(line => !nonEmpty(line.speaker) || !nonEmpty(line.text))) throw new Error(`${id}: missing complete authored dialogue`);
      const locationByHub = {
        'H1-CIRCLE': '상트페테르부르크의 사적 독서 모임 — 허구 장면',
        'H2-EXAM': '상트페테르부르크 관청의 시험 공간 — 허구 장면',
        'H3-READING': '상트페테르부르크 동료의 독서방 — 허구 장면',
        'H4-NEWS': '상트페테르부르크 관청 기록실 — 허구 장면'
      };
      nodes.push({
        id,
        requiredPrefix,
        hubId: hub.id,
        predecessorNodeId,
        choiceId,
        date: hub.date,
        location: locationByHub[hub.id] ?? '상트페테르부르크 — 허구 장면',
        settingStatus: 'FICTIONAL_SCENE',
        title: branch.event?.title ?? hub.title,
        description: branch.event?.description ?? hub.prompt,
        fictionalInterpretation: true,
        dialogue,
        sourceIds,
        visibleCallbacks: allSelected.map(selected => selected.callbackKey).filter(nonEmpty),
        immediateDirection: { ...branch.immediateDirection },
        immediateNextAction: hub.nextHubId === 'END' ? 'E07 historical document sequence' : `Open ${hub.nextHubId}`
      });
      visit(hubIndex + 1, requiredPrefix, id);
    }
  };
  visit(0, [], null);
  return nodes;
}
