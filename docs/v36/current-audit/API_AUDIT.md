# API audit — current V36 checkpoint

Audited HEAD: `e8d728028881831fdcfdf7e9bff03c4975e31f40` (codex/master-dialogue-opinions)

- Deployment contract: Vercel same-origin functions; no Cloudflare worker or external client-side key.
- Runtime routes: `/api/rpg/health`, `/api/rpg/session/start`, `/api/rpg/dialogue`.
- Secret configuration name: `OPENAI_API_KEY` (value intentionally not recorded); optional `OPENAI_DIALOGUE_MODEL`.
- Dialogue uses a server-created, signed session and validated model response. NPC simulation must not call the LLM.
- Regression coverage includes generated turns, missing-key fallback, provider 429/5xx/timeout, invalid response rejection, session recovery, and authoritative-state protection.
- One local paid generation passed on 2026-11-02; this verifies local response generation only. Vercel production deployment and environment settings remain unverified.
