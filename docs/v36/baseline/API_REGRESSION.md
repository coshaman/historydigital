# API baseline — V36 PHASE 0

Baseline HEAD: `7974392eb6e30a19607ff306972159fe5cd47b2e` (codex/master-dialogue-opinions)

- Deployment contract: Vercel same-origin functions; no Cloudflare worker or external client-side key.
- Runtime routes: `/api/rpg/health`, `/api/rpg/session/start`, `/api/rpg/dialogue`.
- Secret configuration name: `OPENAI_API_KEY` (value intentionally not recorded); optional `OPENAI_DIALOGUE_MODEL`.
- Dialogue uses a server-created, signed session and validated model response. NPC schedule simulation is local deterministic game-state code and must not call the LLM.
- Required regression coverage: successful generated turn, missing-key authored fallback, provider 429/5xx/timeout fallback, invalid response rejection, session recovery, no client-side secret, no AI mutation of authoritative quest/economy state.
- Baseline smoke evidence before V36 expansion: one paid live generation passed using local environment configuration on 2026-11-02; no key value is stored in this report.
- Recheck on 2026-11-02: the default restricted execution returned `provider_network_error`; this was the sandbox denying outbound access, not a failed API credential. Re-running the same local smoke with approved outbound access returned `PASS`, `mode: AI`, and non-empty generated text (one generation). The smoke now fails unless actual Korean beat text is returned; HTTP health/session success alone cannot count as an AI pass.
- Current known risk: serverless deployment configuration and production environment must be checked from the target Vercel project; local smoke alone does not prove production settings.
