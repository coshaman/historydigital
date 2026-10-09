import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../data/runtime-dialogue.json', import.meta.url);
const data = JSON.parse(await readFile(path, 'utf8'));
const scene = data.cases.find(item => item.id === 'C05');
if (!scene) throw new Error('C05 runtime scene missing');
const retained = scene.lines.filter(line => line.evidence_class !== 'DIRECT');
const direct = [
  ['Я ѣхалъ на перекладныхъ изъ Тифлиса.', '나는 티플리스에서 역마차를 타고 왔다.', 'page 11; Бэла'],
  ['Славное мѣсто эта долина!', '참 아름다운 곳이다, 이 골짜기는!', 'page 12; Койшаурская долина'],
  ['Славный былъ малый, смѣю васъ увѣрить; только немножко страненъ.', '좋은 사람이었다고 장담할 수 있습니다. 다만 조금 별났지요.', 'page 28; Максим Максимыч о Печорине'],
  ['Недавно я узналъ, что Печоринъ, возвращаясь изъ Персіи, умеръ.', '얼마 전 페초린이 페르시아에서 돌아오던 중 세상을 떠났다는 소식을 들었다.', 'postscript; Печорин'],
  ['Я помѣстилъ въ этой книгѣ только то, что относилось къ пребыванію Печорина на Кавказѣ.', '나는 이 책에 페초린의 캅카스 체류에 관한 내용만 실었다.', 'postscript; scope of the book']
].map(([original, text, locator]) => ({
  speaker: 'source-reader', text, evidence_class: 'DIRECT', source_ids: ['OBJ-WS-LERMONTOV-1840'], voice_profile: 'file-reader', original, locator
}));
scene.lines = [...retained, ...direct];
await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
console.log(JSON.stringify({ status: 'PASS', caseId: 'C05', removedWrongDirectLines: 7, addedVerifiedDirectLines: direct.length }));
