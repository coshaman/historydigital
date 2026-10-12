import fs from 'node:fs';
import { spawn } from 'node:child_process';
import graph from '../narrative/ACT_III_BRANCH_ROUTE.json' with { type: 'json' };

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const port = Number(process.env.MAIN20_81_PORT || 4185);
const baseUrl = process.env.MAIN20_81_BASE_URL || `http://127.0.0.1:${port}/?main20=1`;
const reportPath = process.env.MAIN20_81_REPORT || 'artifacts/main20-81-routes/report.json';
const browserPath = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, CHANCERY_PORT: String(port) }, stdio: 'ignore' });
const failures = [];
let browser;

async function untilServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try { const response = await fetch(baseUrl); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`local worktree server did not start at ${baseUrl}`);
}

function interactionText(line) { return typeof line === 'string' ? line : line?.text || ''; }

try {
  await untilServer();
  browser = await chromium.launch({ headless: true, executablePath: browserPath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(5000);
  page.on('pageerror', error => failures.push(`browser error: ${error.message}`));
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(window.__main20?.getState && window.__main20?.getBranchGraph));
  const runtimeGraph = await page.evaluate(() => window.__main20.getBranchGraph());
  if (runtimeGraph.hubs.length !== 4 || runtimeGraph.endingRoutes.length !== 5) throw new Error('active runtime graph lost the four-hub/five-ending contract');
  const vectors = await page.evaluate(() => window.__main20.enumerateRouteVectors());
  if (vectors.length !== 81 || new Set(vectors.map(item => item.choiceIds.join('|'))).size !== 81) throw new Error(`expected 81 distinct vectors, received ${vectors.length}`);

  const seenNodes = new Set();
  const seenPairs = new Set();
  const endingIds = new Set();
  const replayedPrefixes = new Set();
  const branchByChoice = new Map(runtimeGraph.branches.map(branch => [branch.choiceId, branch]));
  for (const { choiceIds } of vectors) {
    if (choiceIds.length !== 4 || choiceIds.some((id, index) => branchByChoice.get(id)?.hubId !== runtimeGraph.hubs[index]?.id)) throw new Error(`invalid four-hub route vector ${choiceIds.join(' / ')}`);
    const routeReplay = await page.evaluate(ids => window.__main20.replayRouteVector(ids), choiceIds);
    if (routeReplay.routeChoices.join('|') !== choiceIds.join('|') || routeReplay.events.length !== 8) throw new Error(`route helper failed to preserve all four acknowledged actions: ${choiceIds.join(' / ')}`);

    const history = choiceIds.map((choiceId, index) => ({
      sceneId: runtimeGraph.hubs[index].id, kind: 'branch_choice', choiceId, action: choiceId,
      choiceKind: 'ACTION', witnesses: [branchByChoice.get(choiceId).immediateDirection.audience],
      visibility: branchByChoice.get(choiceId).immediateDirection.recordMode,
      callbackKey: branchByChoice.get(choiceId).callbackKey,
      sourceIds: branchByChoice.get(choiceId).sourceIds,
      endingAffinity: runtimeGraph.choiceEndingAffinity?.[choiceId] || {}, flags: []
    }));
    const ending = await page.evaluate(candidate => window.__main20.resolveEndingDetailedFor(candidate), {
      history, relationships: { alexei: 0, ekaterina: 0, pavel: 0 }, flags: [], ideology: {}, ideologyEvidence: [], visibleCallbacks: history.map(item => item.callbackKey)
    });
    if (!ending?.endingId || ending.unresolvedSemanticTie) throw new Error(`route has no unambiguous ending: ${choiceIds.join(' / ')}`);
    endingIds.add(ending.endingId);

    for (let hubIndex = 0; hubIndex < 4; hubIndex += 1) {
      const prefix = choiceIds.slice(0, hubIndex);
      const prefixNow = choiceIds.slice(0, hubIndex + 1);
      const prefixKey = prefixNow.join('|');
      if (replayedPrefixes.has(prefixKey)) continue;
      replayedPrefixes.add(prefixKey);
      const snapshot = await page.evaluate(({ hubIndex, prefix, graph }) => {
        const current = window.__main20.getState();
        let replay = { routeChoices: [], branchState: {}, historicalAnchors: graph.anchors };
        const resolvedNodes = [];
        for (let index = 0; index < prefix.length; index += 1) {
          replay = window.Main20BranchGraph.resolveBranchEvent(graph, graph.hubs[index].id, prefix[index], replay).nextState;
          resolvedNodes.push(window.Main20BranchGraph.resolvePrefixEventNode(graph, prefix.slice(0, index + 1)).id);
        }
        current.phase = 'branch_hub'; current.branchHubIndex = hubIndex; current.routeChoices = prefix;
        current.branchState = replay.branchState; current.activeBranchEventId = null; current.activeBranchEventNodeId = null;
        current.resolvedBranchEventNodeIds = resolvedNodes; current.activeBranchInteractionLines = []; current.activeBranchLineIndex = 0;
        current.activeBranchReadHub = null; current.actions = [...prefix]; current.visibleCallbacks = prefix.map(id => graph.branches.find(branch => branch.choiceId === id)?.callbackKey).filter(Boolean);
        current.history = prefix.map((id, index) => ({ sceneId: graph.hubs[index].id, kind: 'branch_choice', choiceId: id, action: id, choiceKind: 'ACTION', callbackKey: graph.branches.find(branch => branch.choiceId === id)?.callbackKey, endingAffinity: graph.choiceEndingAffinity?.[id] || {}, flags: [] }));
        localStorage.setItem('chancery-main20-v35', JSON.stringify(current));
        return { state: current, expectedSourceIds: [...new Set(graph.branches.filter(branch => branch.hubId === graph.hubs[hubIndex].id).flatMap(branch => [...branch.sourceIds, ...(graph.choiceSourceIds?.[branch.choiceId] || [])]))] };
      }, { hubIndex, prefix, graph: runtimeGraph });
      await page.locator('#loadBtn').click();
      let current = await page.evaluate(() => window.__main20.getState());
      if (current.phase !== 'branch_hub' || current.branchHubIndex !== hubIndex || current.routeChoices.join('|') !== prefix.join('|')) throw new Error(`hub ${hubIndex + 1} did not restore its selected prefix`);
      const newspaperBefore = await page.locator('#paperColumns').innerText();
      if (!snapshot.expectedSourceIds.every(id => newspaperBefore.includes(id))) throw new Error(`hub ${hubIndex + 1} newspaper omitted source gate material`);
      if (await page.locator('#choiceArea').isVisible()) throw new Error(`hub ${hubIndex + 1} exposed choices before newspaper reading`);
      await page.getByRole('button', { name: '신문에서 읽고 선택지를 연다', exact: true }).click();
      const cards = page.locator('#choiceArea .main20-choice-card');
      if (await cards.count() !== 3) throw new Error(`hub ${hubIndex + 1} must expose exactly three readable choices`);
      for (let index = 0; index < 3; index += 1) {
        const disclosure = await cards.nth(index).innerText();
        if (!disclosure.includes('·')) throw new Error(`${runtimeGraph.hubs[hubIndex].id} option ${index + 1} lacks immediate action/audience/risk disclosure`);
      }
      const selectedBranchIndex = runtimeGraph.branches.filter(branch => branch.hubId === runtimeGraph.hubs[hubIndex].id).findIndex(branch => branch.choiceId === choiceIds[hubIndex]);
      if (selectedBranchIndex < 0) throw new Error(`unknown choice ${choiceIds[hubIndex]}`);
      await cards.nth(selectedBranchIndex).click();
      current = await page.evaluate(() => window.__main20.getState());
      const expectedNode = runtimeGraph.eventNodes.find(node => JSON.stringify(node.requiredPrefix) === JSON.stringify(prefixNow));
      if (current.phase !== 'branch_event' || current.routeChoices.join('|') !== prefixNow.join('|') || current.activeBranchEventNodeId !== expectedNode?.id) throw new Error(`choice did not open its exact route event node at ${prefixNow.join(' / ')}`);
      seenNodes.add(expectedNode.id);
      for (const interaction of current.activeBranchInteractionLines || []) {
        const lineText = interactionText(interaction);
        if (lineText && !expectedNode.dialogue.some(line => line.text === lineText)) throw new Error(`${expectedNode.id} lacks earlier-choice interaction ${lineText}`);
        seenPairs.add(`${prefix.join('|')}→${choiceIds[hubIndex]}`);
      }
      const sourcesInEvent = await page.locator('#paperColumns').innerText();
      const missingSources = (expectedNode.sourceIds || []).filter(id => !sourcesInEvent.includes(id));
      if (missingSources.length) throw new Error(`${expectedNode.id} newspaper omits linked sources ${missingSources.join(', ')}; rendered=${sourcesInEvent.slice(0, 700)}`);
      for (const line of expectedNode.dialogue) {
        const visible = await page.locator('#paperDialogue .paper-dialogue-line').innerText();
        if (!visible.includes(line.text)) throw new Error(`${expectedNode.id} fails to render authored dialogue line: ${line.text}`);
        await page.getByRole('button', { name: '다음 말을 듣는다', exact: true }).click();
      }
      await page.getByRole('button', { name: '이 선택의 뒷말을 듣는다', exact: true }).click();
      const chosen = branchByChoice.get(choiceIds[hubIndex]);
      const callback = runtimeGraph.eventPredicates.nextHubAcknowledgements.map(group => group.reactionTexts?.[chosen.nextHubReactionId]).find(Boolean);
      const callbackLine = await page.locator('#paperDialogue .paper-dialogue-line').innerText();
      if (callback?.text && !callbackLine.includes(callback.text)) throw new Error(`choice ${chosen.choiceId} callback is not visible in the paper dialogue`);
      if (callback?.text) await page.getByRole('button', { name: hubIndex === 3 ? '1849년 사건철을 펼친다' : '다음 기록을 펼친다', exact: true }).click();
      const afterCallback = await page.evaluate(() => window.__main20.getState());
      if (!['branch_hub', 'intro', 'ending'].includes(afterCallback.phase)) throw new Error(`callback left a dead-end phase: ${afterCallback.phase}`);
      if (seenNodes.size % 10 === 0) console.log(`played ${seenNodes.size}/120 unique branch event nodes`);
    }
  }
  if (seenNodes.size !== 120) throw new Error(`browser played ${seenNodes.size}/120 route event nodes`);
  if (endingIds.size !== 5) throw new Error(`only ${endingIds.size}/5 endings resolved: ${[...endingIds].join(', ')}`);
  if (failures.length) throw new Error(`browser emitted uncaught page errors: ${failures.join(' | ')}`);
  const report = { status: true, vectorCount: vectors.length, browserChoiceReplays: replayedPrefixes.size, routeEventNodesPlayed: seenNodes.size, distinctCrossHubPrefixes: seenPairs.size, endingIds: [...endingIds].sort(), viewport: { width: 1440, height: 900 } };
  fs.mkdirSync(reportPath.slice(0, reportPath.lastIndexOf('/')), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  failures.push(error.stack || error.message);
  console.error(JSON.stringify({ status: false, failures }, null, 2));
  process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill();
}
