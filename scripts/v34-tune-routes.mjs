import fs from 'node:fs';
const file = 'narrative/MAIN_20MIN_DIALOGUE.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
data.endings.find((ending) => ending.id === 'UVAROV').rule.noneFlags = ['networkDelivery', 'publicDebate'];
data.endings.find((ending) => ending.id === 'KHOMYAKOV').rule.minRelationships = { alexei: 1, ekaterina: 3 };
data.endings.find((ending) => ending.id === 'UVAROV').rule.forbiddenActions = data.endings.find((ending) => ending.id === 'UVAROV').rule.noneFlags;
data.endings.find((ending) => ending.id === 'KHOMYAKOV').rule.relationshipGate = data.endings.find((ending) => ending.id === 'KHOMYAKOV').rule.minRelationships;
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
