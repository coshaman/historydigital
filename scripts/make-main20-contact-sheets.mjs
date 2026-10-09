import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve('artifacts/main20-browser');
const files = fs.readdirSync(root).filter((name) => /^(desktop-start|mobile-start|ending-|window-open-|reading-).+\.png$/i.test(name));
const html = files.map((name) => `<figure><img src="file://${path.join(root, name).replaceAll('\\', '/')}"/><figcaption>${name}</figcaption></figure>`).join('');
const browser = await chromium.launch({headless:true});
const page = await browser.newPage({viewport:{width:1400,height:1000}, deviceScaleFactor:1});
await page.setContent(`<style>body{margin:0;background:#201711;color:#f4dfb5;font:16px Georgia;padding:18px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}figure{margin:0;background:#38251b;border:1px solid #bd9561;padding:8px}img{display:block;width:100%;height:260px;object-fit:contain;background:#120d0a}figcaption{padding-top:8px;word-break:break-all}</style><main>${html}</main>`);
await page.screenshot({path:'artifacts/main20-browser/CONTACT_SHEET.png',fullPage:true});
await browser.close();
console.log(`CONTACT_SHEET ${files.length}`);
