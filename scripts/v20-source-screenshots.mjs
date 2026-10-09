import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const targets=[
  ['source-item-01-moskvityanin.png','https://commons.wikimedia.org/wiki/File:Москвитянин_1847_ч_2.pdf'],
  ['source-item-02-sovremennik.png','https://ru.wikisource.org/wiki/Об_издании_«Современника»_в_1848_году_(Некрасов)'],
  ['source-item-03-otechestvennye.png','https://www.prlib.ru/item/733288']
];
await mkdir('docs/v20/screenshots',{recursive:true});
const browser=await chromium.launch({headless:true});
for(const [file,url] of targets){const page=await browser.newPage({viewport:{width:1440,height:900}});try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await page.screenshot({path:`docs/v20/screenshots/${file}`,fullPage:false});}catch(error){console.error(`${file}: ${error.message}`);}await page.close();}
await browser.close();
