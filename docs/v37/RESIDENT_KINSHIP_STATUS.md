# V37 fictional kinship network

Checked 2026-11-06 (Asia/Seoul).

## Implemented

- `data/v37_fictional_kinship_graph.json` defines 20 reciprocal ties covering all 37 runtime fictional residents: the 36-person resident roster plus the street musician. Every resident has at least one family tie; Mikhail and Mariya have an extended cousin link, and musician Ivan is connected to Matryona's family. The graph is explicitly `FICTIONAL_CHARACTER_DESIGN` with `historicalClaim: false`; no identity or family claim is imported from composite research-bundle records.
- `scripts/v37-author-kinship-graph.mjs` writes each tie to both character cards. The engine exposes each directed edge only to the resident who knows that relationship, and save validation checks the authored edge against the card.
- When a resident's social need reaches 65, no work is imminent, and a relative is reachable, the routine planner can select a family visit. A completed contact relieves social need, records reciprocal meeting memory, and is visible in the NPC simulation ledger.
- Two authored households now share the same deterministic home/sleep location: Anna and Mariya, plus aunt Lyubov and niece Tatyana. At the evening support slot Lyubov may transfer 2 kopeks when Tatyana has at most 5, while keeping an 8-kopeck reserve. The support follows their host-scoped aunt/niece edge and is saved in the NPC ledger.
- `npm run v37-kinship-network` checks endpoint coverage, reciprocity, knowledge scope, a real one-minute autonomous visit, reciprocal contact memory, and save/load preservation.

## Verification

- `npm run v37-seed-kinship`: PASS; 37 runtime fictional residents, 20 ties, every resident covered, no historical claim.
- `npm run v37-kinship-network`: PASS; 37 covered residents, reciprocal kinship edges, host-scoped knowledge, autonomous visits through original and extended family links, reciprocal contact memory, and save/load preservation.

These ties and households are authored fiction for gameplay and do not establish historical kinship or addresses. Several residents now belong to extended family networks, but broader kinship coverage, family dialogue, shared housing, recurring care, inheritance, birth/death, and historical-source verification remain open. This feature alone does not satisfy the V37 living-world completion gates.
