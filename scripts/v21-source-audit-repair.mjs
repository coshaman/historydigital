import {readFile,writeFile} from 'node:fs/promises';
const path='data/periodical-review-gold-1847.json';
const data=JSON.parse(await readFile(path,'utf8'));
const samarin=data.items.find(item=>item.itemId==='PERIODICAL-1847-01');
Object.assign(samarin,{
  excerptPosition:'article begins p.133; exact page of runtime excerpt unverified',
  issueAndExactPage:'1847 part 2, article begins p.133; runtime excerpt page unverified; printed range 133–222',
  sourceStatus:'article opening locator and printed range verified; exact runtime excerpt page and PDF index unverified; Commons period scan linked',
  verifiedSpan:'Итак, думали мы, мнение наших литературных противников явится в достойнейшей форме — и наконец будет понято и оценено наше мнение.',
  witness:'Wikisource modern transcription; Commons period scan linked; exact excerpt page not verified',
  verifiedSpanStatus:'VERIFIED_TEXT_SPAN_ONLY'
});
const sovremennik=data.items.find(item=>item.itemId==='PERIODICAL-1847-02');
Object.assign(sovremennik,{
  excerptPosition:'first publication, separate pagination; runtime span matched to the scholarly-edition base text',
  editionBasis:'runtime span follows the 1997 scholarly-edition base text; first publication is Современник 1847 №9, pp. 1–12; №10/№11 reprints contain documented corrections; no №9 facsimile claim',
  ru:'В следующем 1848 году «Современник» будет издаваться в том же направлении и по той же программе.',
  ko:'다음 1848년에도 《Современник》은 같은 방향과 같은 편집 방침으로 발행될 예정입니다.',
  issueAndExactPage:'1847 №9 first publication, pp. 1–12 separate pagination; runtime span follows the 1997 scholarly base text, with №11 reprint witness recorded',
  issueClaim:'The 1848 announcement states that Sovremennik will continue in the same direction and under the same programme.',
  judgementBasis:'Use for editorial programme and publication practice; do not claim a №9 facsimile or collapse the №9/№11 witness distinction.',
  sourceStatus:'First publication and №11 reprint are bibliographically verified; runtime span is limited to the scholarly-edition base text and variant boundary is recorded',
  sourceEdition:'Современник 1847 №9, pp. 1–12 (first publication)',
  runtimeTextWitness:'1997 scholarly edition base text, printed from Современник 1847 №11, pp. 1–12',
  earliestAvailability:'1847-08-31 censorship permission for №9 first publication',
  sourceEditionVariant:'№10/№11 reprints introduce documented corrections; the runtime excerpt is restricted to the base-text sentence shown here',
  witnessEvidence:'Wikisource comments: first publication №9 (31 Aug 1847); reprints with corrections in №10 and №11; 1997 scholarly edition notes',
  verifiedSpan:'В следующем 1848 году «Современник» будет издаваться в том же направлении и по той же программе.',
  witness:'1997 scholarly base text / Wikisource editorial notes; №9 facsimile not claimed',
  verifiedSpanStatus:'VERIFIED_SCHOLARLY_TEXT_WITNESS_ONLY'
});
const butkov=data.items.find(item=>item.itemId==='PERIODICAL-1847-03');
Object.assign(butkov,{
  sourceStatus:'exact opening span and non-service phrase verified in text witness; archive catalog image access restricted/unverified',
  verifiedSpan:'Въ Петербургѣ жилъ (и нигдѣ не служилъ) человѣкъ и господинъ...',
  witness:'Wikisource modern transcription; PRLIB catalog item 733288 image access restricted',
  verifiedSpanStatus:'VERIFIED_TEXT_SPAN_ONLY'
});
await writeFile(path,`${JSON.stringify(data,null,2)}\n`);
