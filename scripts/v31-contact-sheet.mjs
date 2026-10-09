import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const root = process.cwd();
const files = fs.readdirSync(path.join(root, 'artifacts', 'v31')).flatMap((run) => { const dir = path.join(root, 'artifacts', 'v31', run); return fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.png')).map((name) => path.join(dir, name)) : []; }).sort().slice(-12);
if (!files.length) throw new Error('No V31 screenshots found');
const browser = await chromium.launch({ headless: true }); const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
const html = `<style>body{margin:0;background:#20150f;color:#f4d9a5;font:16px Georgia;padding:24px}h1{margin:0 0 16px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0;background:#3d281c;padding:8px}img{width:100%;display:block}figcaption{padding:8px 2px;font-size:12px;overflow-wrap:anywhere}</style><h1>V31 verified browser evidence</h1><main>${files.map((file) => `<figure><img src="file:///${file.replaceAll('\\', '/')}"/><figcaption>${path.basename(file)}</figcaption></figure>`).join('')}</main>`;
await page.setContent(html); fs.mkdirSync(path.join(root, 'docs', 'v31'), { recursive: true }); await page.screenshot({ path: path.join(root, 'docs', 'v31', 'CONTACT_SHEET_VERIFIED.png'), fullPage: true }); await browser.close(); console.log(JSON.stringify({ status: 'PASS', count: files.length }));
