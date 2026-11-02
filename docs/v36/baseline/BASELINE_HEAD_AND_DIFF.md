# V36 starting baseline

## Baseline identity

- Baseline commit: `7974392eb6e30a19607ff306972159fe5cd47b2e` (`origin/master` at capture).
- Baseline branch at capture: `codex/master-dialogue-opinions`.
- The inventory files describe that committed baseline. Files in this directory added afterward are evidence of work in progress, not part of the baseline commit.
- Screenshots cover 1440×900, 1366×768, 390×844, and 360×800. They were captured before district prototype changes.

## Starting counts

- 10 fictional city residents, 3 literary characters, and 1 historical reconstruction.
- 7 maps: 5 city/reconstruction maps and 2 separate literary maps.
- 8 map exits, 3 interior candidates, 20 combined campaign/opinion quest records, and 28 asset files.
- Only 10 fictional city residents were available; the V36 target of 36 residents and 30 possessable residents was not met.
- The existing NPC engine used five-minute schedule/pathfinding steps, but had no explicit needs-based utility selection, persistent citizen FSM, or social-event chain system.

## Baseline replay

`NPC_TEN_RESIDENT_24H_BASELINE.json` replays the ten resident cohort for a simulated day twice and checks tile occupancy, legal exits, deterministic output, possession pause/resume, and save/reload parity. It is a deterministic code replay, not a claim of a 24-hour real-time playtest. Its `PASS_WITH_V36_GAPS` result is intentional: it records movement that already existed and names the missing V36 systems.

## API regression surface

See [API_REGRESSION.md](API_REGRESSION.md). The server-side dialogue endpoint uses `OPENAI_API_KEY`; client code must never receive the key. A successful health check or session creation alone does not prove that generated dialogue was returned. The live smoke must verify `aiGenerated: true` and non-empty generated text, while failure paths must be labeled honestly and retain a usable offline fallback.

## New prototype evidence

The initial V36 district additions are a gameplay grouping and stylized reconstruction, not a claim that these are surveyed historical boundaries. `NEVSKY_COMMERCIAL` and `COURTYARD_HOUSEHOLD` are connected by checked map exits; literary maps are deliberately excluded. Run `npm run v36-first-slice` to verify the registry and replay the ten-resident simulation.
