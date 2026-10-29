export function auditHistoricalClaimLedger({ ledger, campaign, register, packets, quests, maps }) {
  const failures = [];
  const records = new Map((packets.records ?? []).map((record) => [record.sourceId, record]));
  const sources = new Map((register.sources ?? []).map((source) => [source.sourceId, source]));
  const questById = new Map((quests ?? []).map((quest) => [quest.id, quest]));
  const arcs = new Map((campaign.arcs ?? []).map((arc) => [arc.id, arc]));
  const sourceMapByFile = new Map((maps ?? []).map((map) => [map.file, map.data]));
  const ids = new Set();
  const excerpts = new Set();
  const claims = Array.isArray(ledger?.claims) ? ledger.claims : [];

  if (ledger?.schemaVersion !== 'V33_HISTORICAL_CLAIM_LEDGER_V1') failures.push('historical claim ledger schema mismatch');
  if (!Number.isInteger(ledger?.minimumUniqueExcerpts) || ledger.minimumUniqueExcerpts < 12) failures.push('minimum unique excerpts must be at least 12');
  for (const claim of claims) {
    if (!claim.claimId || ids.has(claim.claimId)) failures.push(`duplicate or missing claimId ${claim.claimId ?? ''}`);
    ids.add(claim.claimId);
    if (!claim.claimKo?.trim() || claim.claimKo.trim().length < 20 || !claim.useKo?.trim() || claim.useKo.trim().length < 12) failures.push(`${claim.claimId} is not a meaningful claim/use pair`);
    if (!['CONTEMPORARY_RECORD', 'SOURCE_ASSERTION', 'BIBLIOGRAPHIC_FACT', 'LITERARY_TEXT'].includes(claim.claimClass)) failures.push(`${claim.claimId} has an invalid claimClass`);
    const excerptKey = `${claim.sourceId}#${claim.paragraphIndex}`;
    if (excerpts.has(excerptKey)) failures.push(`duplicate excerpt ${excerptKey}`);
    excerpts.add(excerptKey);
    const record = records.get(claim.sourceId);
    const source = sources.get(claim.sourceId);
    if (!record || !source) { failures.push(`${claim.claimId} references a source without a verified packet/register entry`); continue; }
    let validSourceUrl = false;
    try { const url = new URL(record.sourceUrl); validSourceUrl = ['http:', 'https:'].includes(url.protocol); } catch {}
    if (!validSourceUrl || record.sourceUrl !== source.url) failures.push(`${claim.claimId} sourceUrl is missing, invalid, or mismatched with the register`);
    if (typeof record.range !== 'string' || !record.range.trim()) failures.push(`${claim.claimId} source range must be nonempty text`);
    if (typeof record.edition !== 'string' || !record.edition.trim()) failures.push(`${claim.claimId} source edition must be nonempty text`);
    if (typeof record.contextKo !== 'string' || !record.contextKo.trim()) failures.push(`${claim.claimId} source contextKo must be nonempty text`);
    const paragraph = record.paragraphs?.[claim.paragraphIndex - 1];
    if (!Number.isInteger(claim.paragraphIndex) || !paragraph) failures.push(`${claim.claimId} references a missing paragraph`);
    else if (!paragraph.ru?.trim() || !paragraph.ko?.trim()) failures.push(`${claim.claimId} paragraph is not aligned RU/KO`);
    const arc = arcs.get(claim.arcId);
    if (!arc || !arc.sources.includes(claim.sourceId)) failures.push(`${claim.claimId} source is not present in its campaign arc`);
    const useRef = claim.useRef;
    const mapData = sourceMapByFile.get(useRef?.file);
    const mapObject = findSourceMapObject(mapData, useRef?.objectId, claim.sourceId, claim.arcId);
    if (!mapObject) failures.push(`${claim.claimId} does not resolve to an in-game map source object`);
    if (claim.questId) {
      const quest = questById.get(claim.questId);
      if (!quest || !arc?.questIds.includes(claim.questId)) failures.push(`${claim.claimId} quest is not part of its campaign arc`);
      else if (!questUsesSource(quest, claim.sourceId)) failures.push(`${claim.claimId} cited quest does not use ${claim.sourceId}`);
    }
  }
  if (excerpts.size < (ledger?.minimumUniqueExcerpts ?? Infinity)) failures.push(`only ${excerpts.size} unique excerpts; minimum is ${ledger?.minimumUniqueExcerpts}`);
  return { status: failures.length ? 'FAIL' : 'PASS', claimCount: claims.length, uniqueExcerptCount: excerpts.size, minimumUniqueExcerpts: ledger?.minimumUniqueExcerpts ?? null, failures };
}

function findSourceMapObject(mapData, objectId, sourceId, arcId) {
  if (!mapData || !Number.isInteger(objectId)) return null;
  const visit = (value) => {
    if (Array.isArray(value)) return value.find((entry) => visit(entry)) ?? null;
    if (!value || typeof value !== 'object') return null;
    const properties = value.properties ?? [];
    if (value.id === objectId
      && value.type === 'source'
      && value.visible !== false
      && properties.some((property) => property.name === 'sourceId' && property.value === sourceId)
      && properties.some((property) => property.name === 'availableChapterId' && property.value === arcId)) return value;
    for (const child of Object.values(value)) { const found = visit(child); if (found) return found; }
    return null;
  };
  return visit(mapData);
}

function questUsesSource(quest, sourceId) {
  return quest.historicalOutcome?.sourceIds?.includes(sourceId)
    || quest.actions?.some((action) => action.requiredKnowledgeId === sourceId)
    || quest.actions?.some((action) => action.sourceIds?.includes(sourceId));
}
