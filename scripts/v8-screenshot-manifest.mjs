import { chromium } from 'playwright';
import { mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../docs/v8/screenshots/', import.meta.url);
await mkdir(root,{recursive:true});
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
await page.goto('http://127.0.0.1:4173/', {waitUntil:'domcontentloaded',timeout:15000});
await page.waitForFunction(() => window.__goldRuntime && window.__threeRuntime, null, {timeout:15000});
await page.evaluate(() => localStorage.removeItem('chancery-gold-runtime-v1')); await page.reload({waitUntil:'domcontentloaded'}); await page.waitForFunction(() => window.__goldRuntime && window.__threeRuntime);
const shot = async name => page.screenshot({path:fileURLToPath(new URL(name,root)),fullPage:true});
const render = async (id,sub=null) => page.evaluate(({id,sub}) => { const s=window.__goldRuntime.getState(); s.subSceneId=sub; s.phase='reading'; window.__goldRuntime.renderGold(id); },{id,sub});
const openDrawer = async () => { await page.locator('#sourceBtn').click(); await page.waitForTimeout(120); };
const closeDrawer = async () => { await page.locator('#closeDrawer').click(); };

await render('E02'); await shot('E02-desk.png'); await openDrawer(); await page.locator('#scanTab').click(); await shot('E02-original-scan.png'); await page.locator('#transcriptionTab').click(); await shot('E02-reading.png'); await closeDrawer();
await page.locator('#notebookObject').click(); await page.locator('#reply').fill('발행일과 반응일을 분리해 등록부에 남긴다.'); await shot('E02-memo.png'); await page.locator('#submitReply').click(); await shot('E02-choice.png'); await page.locator('#choiceArea button').first().click(); await shot('E02-dialogue.png'); await openDrawer(); await shot('E02-source-folder.png'); await closeDrawer();

await render('E05','E05-A'); await shot('E05-A-desk.png'); await page.locator('#transcriptionTab').count(); await openDrawer(); await page.locator('#transcriptionTab').click(); await shot('E05-A-transcription.png'); await closeDrawer(); await page.locator('#notebookObject').click(); await page.locator('#reply').fill('공개 편지와 사적 답변을 한 문서로 합치지 않는다.'); await page.locator('#submitReply').click(); await shot('E05-A-choice.png'); await page.locator('#choiceArea button').first().click(); await shot('E05-A-dialogue.png');
await render('E05','E05-B'); await shot('E05-B-arrival.png'); await openDrawer(); await page.locator('#transcriptionTab').click(); await shot('E05-B-reading.png'); await closeDrawer(); await page.locator('#notebookObject').click(); await page.locator('#reply').fill('답변 초안은 늦은 시기의 별도 문서로 등록한다.'); await page.locator('#submitReply').click(); await shot('E05-B-choice.png'); await page.locator('#choiceArea button').first().click(); await shot('E05-B-dialogue.png');

await render('E07'); await shot('E07-folder.png'); await openDrawer(); await page.locator('#scanTab').click(); await shot('E07-archive-image.png'); await page.locator('#bibliographyTab').click(); await shot('E07-metadata.png'); await closeDrawer(); await page.locator('#notebookObject').click(); await page.locator('#reply').fill('본문이 확인되지 않은 폴리오는 메타데이터로만 분류한다.'); await page.locator('#submitReply').click(); await shot('E07-choice.png'); await page.locator('#choiceArea button').first().click(); await shot('E07-dialogue.png');

await render('E02'); await shot('desk-clean.png'); await page.locator('#ledgerObject').click(); await shot('ledger-open.png'); await page.locator('#closeLedger').click(); await page.locator('#notebookObject').click(); await shot('notebook-open.png'); await page.locator('#reply').press('Escape'); await page.locator('#docketObject').click(); await shot('docket.png'); await openDrawer(); await shot('drawer-open.png'); await closeDrawer(); await page.locator('.gold-excerpt').nth(1).click(); await shot('document-pickup.png');
await page.locator('#petersburgWindow').click(); await shot('window-focus.png'); await page.locator('#petersburgWindow').click(); await shot('window-close.png'); await render('E02'); await shot('window-normal.png');

const names = ['E02-desk.png','E02-original-scan.png','E02-reading.png','E02-choice.png','E02-memo.png','E02-dialogue.png','E02-source-folder.png','E05-A-desk.png','E05-A-transcription.png','E05-A-choice.png','E05-A-dialogue.png','E05-B-arrival.png','E05-B-reading.png','E05-B-choice.png','E05-B-dialogue.png','E07-folder.png','E07-archive-image.png','E07-metadata.png','E07-choice.png','E07-dialogue.png','desk-clean.png','ledger-open.png','notebook-open.png','docket.png','drawer-open.png','document-pickup.png','window-normal.png','window-focus.png','window-close.png'];
const manifest=[]; for (const name of names) { const file=await stat(new URL(name,root)); if (!file.size) throw new Error(`${name}: empty`); manifest.push({name,size:file.size}); }
console.log(JSON.stringify({count:manifest.length,files:manifest},null,2)); await browser.close();
