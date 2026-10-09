import fs from 'node:fs';
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4173/?main20=1#v35-migration', { waitUntil: 'domcontentloaded' });
const legacy = { schemaVersion: 'MAIN-20MIN-DIALOGUE-V34', sceneIndex: 4, phase: 'ending', endingId: 'BELINSKY', history: [], flags: [], relationships: { alexei: 0, ekaterina: 0, pavel: 0 }, readExcerptIdsByScene: {}, readEventsByScene: {}, readingScrollByScene: {} };
await page.evaluate((value) => { localStorage.clear(); localStorage.setItem('chancery-main20-v34', JSON.stringify(value)); location.reload(); }, legacy);
await page.waitForFunction(() => Boolean(window.__main20));
const state = await page.evaluate(() => window.__main20.getState());
const report = { schemaVersion: 'V35-SAVE-MIGRATION-1', status: state.schemaVersion === 'MAIN-20MIN-DIALOGUE-V35' && state.legacyEndingTitle === 'BELINSKY' && state.endingId === null && state.phase === 'legacy_recovery', legacyEndingTitle: state.legacyEndingTitle, migratedSchema: state.schemaVersion, phase: state.phase, endingId: state.endingId };
fs.mkdirSync('docs/v35', { recursive: true });
fs.writeFileSync('docs/v35/SAVE_MIGRATION.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (!report.status) process.exit(1);
