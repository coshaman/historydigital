import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const readJson = async file => JSON.parse(await readFile(file, 'utf8'));
const registry = await readJson(path.join(root, 'rpg/data/city-districts-v36.json'));
const ids = [...new Set(registry.districts.flatMap(district => district.residentIds ?? []))];
const cards = new Map(await Promise.all(ids.map(async id => [id, await readJson(path.join(root, 'rpg/characters', `${id}.json`))])));
const defaultNeeds = card => {
  const scarcity = ['poor', 'precarious', 'modest'].includes(card.wealthBracket);
  const labor = /노동|운반|세탁|마부|제빵|활자|판매|장사|하인|수선|수위|짐|마차|시장/.test(card.occupation ?? '');
  return { hunger: scarcity ? 38 : 28, fatigue: labor ? 24 : 14, income: scarcity ? 62 : 28, safety: 25,
    socialBelonging: 30, restThreshold: 72, workFatiguePerMinute: labor ? 0.028 : 0.018, restFatigueReliefPerMinute: 0.06,
    status: 'fictional_character_simulation_profile' };
};
for (const [id, card] of cards) {
  const [otherId, relationship] = Object.entries(card.relations ?? {})[0] ?? [];
  const other = cards.get(otherId);
  card.needs = { ...defaultNeeds(card), ...(card.needs ?? {}) };
  card.todayGoals = [
    { id: `${id}:work`, kind: 'work', titleKo: '맡은 일', textKo: card.personalObjective },
    { id: `${id}:desire`, kind: 'personal', titleKo: '바라는 것', textKo: card.desires },
    { id: `${id}:risk`, kind: 'care', titleKo: '마음에 걸리는 일', textKo: card.fears },
    { id: `${id}:relation`, kind: 'social', titleKo: other ? `오늘 엮인 사람 · ${other.displayNameKo}` : '오늘 엮인 사람', textKo: relationship ?? '오늘은 주변 사람의 필요를 살펴본다.' },
  ];
  await writeFile(path.join(root, 'rpg/characters', `${id}.json`), `${JSON.stringify(card, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify({ residents: cards.size, needsProfiles: [...cards.values()].filter(card => card.needs).length,
  residentsWithFourTodayGoals: [...cards.values()].filter(card => card.todayGoals?.length >= 4).length }, null, 2));
