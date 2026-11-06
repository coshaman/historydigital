import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const port = Number(process.env.CHANCERY_PORT || 4173);
const origin = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ['--env-file-if-exists=.env.local', 'server.mjs'], { stdio: 'ignore', windowsHide: true, env: { ...process.env, CHANCERY_PORT: String(port) } });
let turns = 0;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${origin}/api/rpg/health`)).ok) { ready = true; break; } } catch {}
    await delay(200);
  }
  if (!ready) throw new Error('server_unavailable');
  const started = await fetch(`${origin}/api/rpg/session/start`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hostId: 'printer_ekaterina', actorHostId: 'seamstress_anna' }),
  });
  if (!started.ok) throw new Error(`session_start_${started.status}`);
  const session = await started.json();
  const response = await fetch(`${origin}/api/rpg/dialogue`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionToken: session.sessionToken, requestId: crypto.randomUUID(), playerInput: '그 문장에서 가장 먼저 확인해야 할 대목은 어디인가요?', actorRelations: {}, actorActions: [],
      sceneContext: { date: '1847-06-01', mapId: 'printshop', questId: 'PRINTSHOP_PROOF_1847', activityKo: '교정쇄와 활자를 살핀다',
        currentAimKo: '작업한 교정쇄의 전달처와 책임자를 확인한다', hungerBand: 'HUNGRY', fatigueBand: 'RESTED', healthCondition: 'FIT' } }),
  });
  turns++;
  if (!response.ok) {
    const providerCode = response.headers.get('x-v33-provider-result') || 'unknown';
    throw new Error(`dialogue_${response.status}_${providerCode}`);
  }
  const result = await response.json();
  const generatedText = result.turn?.beats?.map(beat => beat.textKo).filter(text => typeof text === 'string' && text.trim()).join('\n') ?? '';
  if (result.fallback || result.mode !== 'AI' || !generatedText) throw new Error(`provider_${response.headers.get('x-v33-provider-result') || 'response_validation'}`);
  process.stdout.write(JSON.stringify({ status: 'PASS', model: process.env.OPENAI_DIALOGUE_MODEL || 'gpt-5.4-mini', paidGenerations: turns, generatedTextLength: generatedText.length, generatedTextReturned: true }) + '\n');
} catch (error) {
  process.stderr.write(JSON.stringify({ status: 'FAIL', reason: String(error?.message || 'smoke_failed').replace(/[^a-zA-Z0-9_-]/g, '_') }) + '\n');
  process.exitCode = 1;
} finally {
  child.kill();
}
