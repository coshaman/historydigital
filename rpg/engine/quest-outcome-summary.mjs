export function questOutcomeSummary(action, { hostNames = new Map(), mapNames = new Map() } = {}) {
  const lines = [];
  const changes = action.effects?.v47WorldChange ?? action;
  const nameOf = id => hostNames.get(id) ?? id;
  for (const transfer of changes.money ?? []) {
    lines.push(`돈 ${nameOf(transfer.fromHostId)} → ${nameOf(transfer.toHostId)} · ${transfer.amount}코페이카`);
  }
  for (const transfer of changes.inventory ?? []) {
    lines.push(`물건 ${transfer.itemKo} ×${transfer.quantity} · ${nameOf(transfer.fromHostId)} → ${nameOf(transfer.toHostId)}`);
  }
  for (const relation of changes.relationships ?? []) {
    const direction = relation.trustDelta > 0 ? '신뢰가 쌓임' : relation.trustDelta < 0 ? '신뢰가 줄어듦' : null;
    if (direction) lines.push(`관계 ${nameOf(relation.fromHostId)} · ${nameOf(relation.toHostId)} · ${direction}`);
  }
  for (const move of changes.moves ?? []) {
    lines.push(`이동 ${nameOf(move.hostId)} · ${mapNames.get(move.mapId) ?? move.mapId}`);
  }
  return lines.length ? `\n\n바뀐 것\n${lines.join('\n')}` : '';
}
