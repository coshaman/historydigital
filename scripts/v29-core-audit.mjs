import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const graph = JSON.parse(await fs.readFile('narrative/VN_DIALOGUE_GRAPH.json', 'utf8'));
const bundle = JSON.parse(await fs.readFile('data/v27-case-bundle.json', 'utf8'));
const coreIds = ['C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C14', 'C17', 'C21', 'C19', 'C24'];
const authoredIds = ['C01', 'C07', 'C17', 'C24'];
const caseById = new Map(graph.cases.map(item => [item.caseId, item]));
const failures = [];
const core = coreIds.map(id => {
  const item = caseById.get(id);
  if (!item) { failures.push(`${id}: missing graph case`); return { caseId: id, status: 'FAIL' }; }
  const authored = item.nodes.filter(node => String(node.id).startsWith('V29-') && node.utteranceKo);
  const spoken = item.nodes.filter(node => node.speakerId !== 'NARRATION_MINIMAL' && node.utteranceKo).map(node => node.utteranceKo);
  const choiceTargets = item.choices.every(choice => item.nodes.some(node => node.id === choice.edgeTo));
  const excerptCount = (bundle.cases?.find(entry => entry.caseId === id)?.excerpts || []).length;
  if (authored.length < 14) failures.push(`${id}: ${authored.length} V29 authored dialogue nodes < 14`);
  if (!choiceTargets) failures.push(`${id}: dangling choice target`);
  return { caseId: id, authoredDialogueNodes: authored.length, choiceCount: item.choices.length, excerptCount, status: authored.length >= 14 && choiceTargets ? 'PASS' : 'FAIL' };
});
const c24 = bundle.cases?.find(entry => entry.caseId === 'C24');
const c24DirectItems = (c24?.excerpts || []).filter(item => item.quotationStatus === 'DIRECT' || item.evidence === 'DIRECT');
const c24Direct = c24DirectItems.length;
const c24UnsafeDirect = c24DirectItems.filter(item => item.evidence !== 'DIRECT_PRIMARY_SCAN' || !item.scanUrl || item.materialStatus !== 'PRIMARY_ARCHIVAL_SCAN').length;
if (c24UnsafeDirect) failures.push(`C24: ${c24UnsafeDirect} direct excerpts lack scan-backed provenance`);
const normalOrder = [...new Set(coreIds)].join(',');
if (graph.endings?.length !== 5) failures.push(`ending count ${graph.endings?.length} !== 5`);
const report = {
  schemaVersion: 'V29-CORE-AUDIT-1',
  generatedAt: new Date().toISOString(),
  status: failures.length ? 'FAIL' : 'PASS',
  coreCaseIds: coreIds,
  normalRouteOrder: normalOrder,
  authoredSlice: core,
  caseCount: graph.cases.length,
  nodeCount: graph.cases.reduce((sum, item) => sum + item.nodes.length, 0),
  choiceCount: graph.cases.reduce((sum, item) => sum + item.choices.length, 0),
  endingCount: graph.endings?.length || 0,
  c24DirectExcerptCount: c24Direct,
  c24UnsafeDirectExcerptCount: c24UnsafeDirect,
  failures
};
await fs.mkdir('docs/v29', { recursive: true });
await fs.writeFile('docs/v29/CORE_AUDIT.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
