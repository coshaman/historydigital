import fs from 'node:fs';
const path='data/v27-case-bundle.json';
const data=JSON.parse(fs.readFileSync(path,'utf8'));
const c=data.cases.find(item=>item.caseId==='C24');
if(!c) throw new Error('C24 missing');
for(const source of c.sources||[]) source.sourceRole='ARCHIVE_DOCUMENT_OR_MODERN_GUIDE';
for(const excerpt of c.excerpts||[]){
  excerpt.evidence='MODERN_COMMENTARY_OR_ARCHIVE_DESCRIPTION';
  excerpt.quotationStatus='NOT_A_DIRECT_QUOTATION';
  excerpt.materialStatus='ARCHIVE_DESCRIPTION_ONLY';
  excerpt.reason='The checked-in Russian string is not independently verified as a transcription of the 1849 folio; keep it visible only as clearly labelled archive/context material.';
}
fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
const report={schemaVersion:'V29-C24-SAFE-REPAIR-1',caseId:'C24',status:'PASS_SAFE_RECLASSIFICATION',removedDirectQuotationCount:c.excerpts?.length||0,sourceUrl:'https://statearchive.ru/722',verifiedArchiveAnchors:['Ф.109 Оп.24 Д.214 ч.I; cover','Ф.109 Оп.24 Д.214 ч.I, л. 3-20','Ф.109 Оп.24 Д.214 ч.I, Лл. 44-54','Ф.109 Оп.24 Д.214 ч.I, Лл. 128-129'],note:'GARF page lines 65-76 identify the archival documents and folios, while lines 40-54 are modern contextual prose. No modern prose is presented as a 1849 direct quotation.'};
fs.mkdirSync('docs/v29',{recursive:true});fs.writeFileSync('docs/v29/C24_SAFE_REPAIR.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
