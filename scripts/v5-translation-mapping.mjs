import { chromium } from 'playwright';
import runtime from '../data/runtime-dialogue.json' with {type:'json'};
import candidates from '../data/excerpt-candidates.json' with {type:'json'};
import review from '../data/excerpt-translation-review.json' with {type:'json'};

const failures=[]; const ids=new Set();
for(const unit of [...candidates.filter(x=>x.ru_excerpt),...review]){
  if(!unit.id||ids.has(unit.id)) continue; ids.add(unit.id);
  const ko=unit.natural_ko || review.find(x=>x.id===unit.id)?.natural_ko;
  if(!ko) failures.push(`${unit.id}: missing Korean translation`);
}
const duplicate=new Map();
for(const unit of review){const key=unit.natural_ko?.trim();if(!key)continue;if(!duplicate.has(key))duplicate.set(key,[]);duplicate.get(key).push(unit.id);}
for(const [ko,unitIds] of duplicate) if(unitIds.length>1 && new Set(unitIds.map(id=>candidates.find(x=>x.id===id)?.ru_excerpt)).size>1) failures.push(`common translation fallback: ${unitIds.join(',')}`);
const browser=await chromium.launch({headless:true}); const page=await browser.newPage({viewport:{width:1366,height:768}});
await page.goto(process.env.CHANCERY_BASE||'http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:20000});
const visible=await page.evaluate(()=>{const instructionNodes=[...document.querySelectorAll('button,label,.instruction,.current-task,.dialogue-strip p')];return {translationVisible:!document.querySelector('#paperTranslation')?.hidden,translationText:document.querySelector('#paperTranslation p')?.textContent||'',untranslatedInstructions:instructionNodes.filter(el=>/[А-Яа-яЁё]/.test(el.textContent)&&!/[가-힣]/.test(el.textContent)).map(el=>el.textContent.trim()).filter(Boolean)};});
if(!visible.translationVisible||!visible.translationText) failures.push('paper translation is not visible by default');
if(visible.untranslatedInstructions.length) failures.push(`visible Russian-only instruction nodes: ${visible.untranslatedInstructions.join(' | ')}`);
await browser.close();
console.log(JSON.stringify({runtimeCases:runtime.cases.length,reviewUnits:review.length,visible,failures},null,2));
if(failures.length) process.exit(1);
console.log('v5-translation-mapping: source/excerpt/translation integrity and default Korean layer — PASS');
