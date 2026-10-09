import fs from 'node:fs';
const file = 'narrative/MAIN_20MIN_DIALOGUE.json'; const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const c07 = data.scenes.find((scene) => scene.id === 'C07');
c07.choices.find((choice) => choice.id === 'C07-A').text = '알렉세이 말대로 절차부터 확인하죠. 다만 그 기록이 작가의 목소리를 대신하게 두지는 않겠습니다.';
c07.choices.find((choice) => choice.id === 'C07-B').text = '예카테리나 말이 맞아요. 판정문부터 쓰기 전에 작가가 실제로 무엇을 항의했는지 남기죠.';
c07.choices.find((choice) => choice.id === 'C07-C').text = '잠깐만요. 둘 다 결론을 늦추고, 원문과 날짜부터 같이 확인합시다.';
for (const scene of data.scenes) for (const list of [scene.choices, scene.postChoices]) for (const choice of list) choice.text = choice.text.replaceAll('내 판단', '제가 보기에는').replaceAll('두 번째 판단', '다시 살펴본 뒤의 말');
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); console.log(JSON.stringify({ status: 'PASS', polished: ['C07-A', 'C07-B', 'C07-C'] }, null, 2));
