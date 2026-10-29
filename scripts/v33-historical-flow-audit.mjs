import fs from 'node:fs';
import { auditHistoricalClaimLedger } from './v33-historical-claim-ledger.mjs';

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const campaign = read('rpg/quests/campaign.json');
const register = read('rpg/data/source-register.json');
const packets = read('rpg/data/historical-source-packets.json');
const claimLedger = read('rpg/data/historical-claim-ledger.json');
const failures = [];
const expectedArcs = [
  ['V33_1847_PRINT', '1847-06-01'],
  ['V33_1848_PUBLIC', '1848-01-01'],
  ['V33_1849_CIRCLE', '1849-04-22'],
];
const sourceIds = new Set(register.sources.map((source) => source.sourceId));
const records = new Map(packets.records.map((record) => [record.sourceId, record]));
const questFiles = fs.readdirSync('rpg/quests').filter((file) => file.endsWith('.json') && file !== 'campaign.json');
const quests = questFiles.map((file) => ({ file, ...read(`rpg/quests/${file}`) }));
const maps = fs.readdirSync('rpg/maps').filter((file) => file.endsWith('.json')).map((file) => ({ file: `rpg/maps/${file}`, data: read(`rpg/maps/${file}`) }));

if (campaign.schemaVersion !== 'V33_CAMPAIGN_V1') failures.push('RPG campaign schema is not V33_CAMPAIGN_V1');
if (register.schemaVersion !== 'V33_SOURCE_REGISTER_V1') failures.push('RPG source register schema mismatch');
if (packets.schemaVersion !== 'V33_HISTORICAL_SOURCE_PACKETS_V1') failures.push('RPG historical packet schema mismatch');
if (JSON.stringify(campaign.arcs.map(({ id, date }) => [id, date])) !== JSON.stringify(expectedArcs)) failures.push('1847–1849 campaign arc order/date changed');
if (campaign.endings.map((ending) => ending.id).join(',') !== 'UVAROV,BELINSKY,HERZEN,KHOMYAKOV,DOSTOEVSKY_PETRASHEVSKY') failures.push('exact five ending IDs changed');
if (campaign.literaryRealm?.realmClass !== 'LITERARY_REALM' || campaign.literaryRealm.historicalWitness !== false) failures.push('literary realm is not separated from historical witness records');

for (const arc of campaign.arcs) {
  for (const sourceId of arc.sources) if (!sourceIds.has(sourceId)) failures.push(`${arc.id} references unknown source ${sourceId}`);
  for (const questId of arc.questIds) {
    const quest = quests.find((item) => item.id === questId);
    if (!quest) { failures.push(`${arc.id} references missing quest ${questId}`); continue; }
    if (quest.chapterId !== arc.id) failures.push(`${quest.id} chapter does not match ${arc.id}`);
    if (quest.date < arc.date) failures.push(`${quest.id} occurs before its campaign arc`);
    if (!quest.historicalOutcome?.id || !/remains? (?:fixed|unchanged|historically published|historical outcomes)/i.test(quest.historicalOutcome.value ?? '')) failures.push(`${quest.id} lacks an immutable historical outcome`);
    for (const sourceId of quest.historicalOutcome?.sourceIds ?? []) if (!sourceIds.has(sourceId)) failures.push(`${quest.id} outcome references unknown source ${sourceId}`);
  }
}

for (const record of packets.records) {
  if (!sourceIds.has(record.sourceId)) failures.push(`source packet ${record.sourceId} is absent from the register`);
  if (!record.sourceUrl || !record.range || !record.edition || !record.contextKo) failures.push(`${record.sourceId} lacks URL, range, edition, or context`);
  if (!Array.isArray(record.paragraphs) || record.paragraphs.length === 0) failures.push(`${record.sourceId} has no contiguous excerpt paragraphs`);
  for (const [index, paragraph] of (record.paragraphs ?? []).entries()) if (!paragraph.ru?.trim() || !paragraph.ko?.trim()) failures.push(`${record.sourceId} paragraph ${index + 1} lacks aligned RU/KO text`);
}
for (const sourceId of campaign.arcs.flatMap((arc) => arc.sources)) if (sourceId.startsWith('OBJ-') && !records.has(sourceId) && !['OBJ-SOV-1847'].includes(sourceId)) failures.push(`document source ${sourceId} has no aligned historical packet`);
for (const ending of campaign.endings) if (!ending.requiredActions?.length || !ending.epilogueKo || !ending.choiceSubcopyKo) failures.push(`${ending.id} lacks a sourced action route or player-facing consequence copy`);

const claimLedgerAudit = auditHistoricalClaimLedger({ ledger: claimLedger, campaign, register, packets, quests, maps });
failures.push(...claimLedgerAudit.failures);

const report = {
  schemaVersion: 'V33-HISTORICAL-FLOW-AUDIT-2',
  status: failures.length ? 'FAIL' : 'PASS',
  arcOrder: campaign.arcs.map(({ id, date }) => ({ id, date })),
  sourceCount: register.sources.length,
  historicalPacketCount: packets.records.length,
  questCount: quests.length,
  endingIds: campaign.endings.map((ending) => ending.id),
  claimLedger: claimLedgerAudit,
  failures,
};
fs.mkdirSync('docs/v33', { recursive: true });
fs.writeFileSync('docs/v33/HISTORICAL_FLOW_AUDIT.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
