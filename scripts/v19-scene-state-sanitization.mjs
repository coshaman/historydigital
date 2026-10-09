import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';

const out='docs/v19'; await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1366,height:768}});
await page.addInitScript(()=>localStorage.removeItem('chancery-gold-runtime-v1'));
await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>window.__goldRuntime?.getState,{timeout:15000});
const snapshot=()=>page.evaluate(()=>JSON.parse(JSON.stringify(window.__goldRuntime.getState())));
const enter=async(caseId,subSceneId=null)=>page.evaluate(({caseId,subSceneId})=>{const s=window.__goldRuntime.getState();s.subSceneId=subSceneId;window.__goldRuntime.renderGold(caseId);}, {caseId,subSceneId});
const scenes=[];
const capture=async(scene,expectedSubSceneId)=>{const state=await snapshot();scenes.push({scene,expectedSubSceneId,state});return state;};
await enter('E02'); await capture('E02',null);
await enter('CENSORSHIP_CASE_1847_07'); await capture('CENSORSHIP_CASE_1847_07',null);
await enter('E05','E05-A'); await capture('E05-A','E05-A');
await enter('E05','E05-B'); await capture('E05-B','E05-B');
await enter('PERIODICAL_REVIEW_GOLD_1847'); await capture('PERIODICAL_REVIEW_GOLD_1847',null);
await enter('E07'); await capture('E07',null);

const localPaths=new Set(['subSceneId','followUpId','proceduralChoiceId','judgmentChoiceId','activeExcerptId','sceneInteraction.activeSceneId','sceneInteraction.selectedProceduralChoiceId','sceneInteraction.selectedJudgmentChoiceId','sceneLocal.caseId','sceneLocal.subSceneId','sceneLocal.followUpId','sceneLocal.selectedProceduralChoiceId','sceneLocal.selectedJudgmentChoiceId','sceneLocal.openLocalDocumentId']);
const expectedPersistentKeys=['issue','relationships','institutional','memo','privateNotes','completedScenes','actions'];
const transitions=[];
for(let i=1;i<scenes.length;i++){
  const prev=scenes[i-1],next=scenes[i];
  const forbidden=[prev.state.followUpId,prev.state.proceduralChoiceId,prev.state.judgmentChoiceId,prev.state.subSceneId,prev.state.sceneInteraction?.activeSceneId].filter(Boolean);
  const leakedKeys=[];
  for(const value of forbidden){const search=(node,path='')=>{if(typeof node==='string'&&node===value&&!path.startsWith('completedScenes')&&!path.startsWith('privateNotes')&&!path.startsWith('actions'))leakedKeys.push(`${path}=${value}`);if(node&&typeof node==='object')for(const [k,v] of Object.entries(node))search(v,path?`${path}.${k}`:k);};search(next.state);}
  if(next.scene==='PERIODICAL_REVIEW_GOLD_1847'&&next.state.completedScenes.includes('PERIODICAL_REVIEW_GOLD_1847:E05-B'))leakedKeys.push('completedScenes contains malformed PERIODICAL_REVIEW_GOLD_1847:E05-B');
  if(next.scene==='PERIODICAL_REVIEW_GOLD_1847'&&next.state.subSceneId!==null)leakedKeys.push(`subSceneId=${next.state.subSceneId}`);
  if(next.scene==='E07'&&next.state.followUpId!==null)leakedKeys.push(`followUpId=${next.state.followUpId}`);
  transitions.push({previousScene:prev.scene,nextScene:next.scene,previousLocalState:{subSceneId:prev.state.subSceneId,followUpId:prev.state.followUpId,proceduralChoiceId:prev.state.proceduralChoiceId,judgmentChoiceId:prev.state.judgmentChoiceId},nextLocalState:{subSceneId:next.state.subSceneId,followUpId:next.state.followUpId,proceduralChoiceId:next.state.proceduralChoiceId,judgmentChoiceId:next.state.judgmentChoiceId},leakedKeys,expectedPersistentKeys,pass:leakedKeys.length===0});
}
const localAssertions=scenes.map(item=>({scene:item.scene,caseId:item.state.caseId,subSceneId:item.state.subSceneId,followUpId:item.state.followUpId,completedScenes:item.state.completedScenes,pass:(item.state.subSceneId===item.expectedSubSceneId)&&(item.scene==='E07'?item.state.followUpId===null:true)&&(item.scene==='PERIODICAL_REVIEW_GOLD_1847'?!item.state.completedScenes.some(key=>key==='PERIODICAL_REVIEW_GOLD_1847:E05-B'):true)}));
const result={status:transitions.every(t=>t.pass)&&localAssertions.every(t=>t.pass)?'PASS':'FAIL',transitions,localAssertions,sceneCount:scenes.length};
await writeFile(`${out}/SCENE_STATE_SANITIZATION_REPORT.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({status:result.status,sceneCount:result.sceneCount,failedTransitions:transitions.filter(t=>!t.pass).length,failedAssertions:localAssertions.filter(t=>!t.pass).length},null,2));
await browser.close();
if(result.status!=='PASS')process.exitCode=1;
