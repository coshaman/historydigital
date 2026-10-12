import { readFile, writeFile } from 'node:fs/promises';
import { buildPrefixEventNodes } from './main20-prefix-event-author.mjs';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const route = await readJson('../narrative/ACT_III_BRANCH_ROUTE.json');
const main20 = await readJson('../narrative/MAIN_20MIN_DIALOGUE.json');
const additions = await readJson('../narrative/ACT_III_BRANCHING_SOURCES.json');
const censorshipCase = await readJson('../data/censorship-case-1847-07.json');
const sources = [...(main20.sourceRegister ?? []), ...additions, ...(censorshipCase.items ?? [])];

route.eventNodes = buildPrefixEventNodes(route, sources);
await writeFile(new URL('../narrative/ACT_III_BRANCH_ROUTE.json', import.meta.url), `${JSON.stringify(route, null, 2)}\n`, 'utf8');
process.stdout.write(`Authored ${route.eventNodes.length} prefix-conditioned event nodes.\n`);
