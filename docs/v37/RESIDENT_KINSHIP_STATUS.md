# V37 fictional kinship network

Checked 2026-11-06 (Asia/Seoul).

## Implemented

- `data/v37_fictional_kinship_graph.json` defines 18 reciprocal ties covering all 36 fictional runtime residents exactly once. The graph is explicitly `FICTIONAL_CHARACTER_DESIGN` with `historicalClaim: false`; no identity or family claim is imported from composite research-bundle records.
- `scripts/v37-author-kinship-graph.mjs` writes each tie to both character cards. The engine exposes each directed edge only to the resident who knows that relationship, and save validation checks the authored edge against the card.
- When a resident's social need reaches 65, no work is imminent, and a relative is reachable, the routine planner can select a family visit. A completed contact relieves social need, records reciprocal meeting memory, and is visible in the NPC simulation ledger.
- `npm run v37-kinship-network` checks endpoint coverage, reciprocity, knowledge scope, a real one-minute autonomous visit, reciprocal contact memory, and save/load preservation.

## Verification

- `npm run v37-seed-kinship`: PASS; 36 residents, 18 ties, every resident covered, no historical claim.
- `npm run v37-kinship-network`: PASS; the Alexei/Andrei pair formed an autonomous family contact and retained the relationship edges and memories after save/load.

These ties are authored fiction for gameplay and do not establish historical kinship. The graph currently gives each person one family tie; multiple relatives, family dialogue, shared housing, care, inheritance, birth/death, and historical-source verification remain open. This feature alone does not satisfy the V37 living-world completion gates.
