# API audit — current V36 checkpoint

Audited HEAD: 474eb1819a1edef62871f59b4ca85a9373897052 (codex/master-dialogue-opinions)

- Deployment contract: Vercel same-origin functions; no Cloudflare worker or external client-side key.
- Runtime routes: /api/rpg/health, /api/rpg/session/start, and /api/rpg/dialogue.
- Secret configuration name: OPENAI_API_KEY (value intentionally not recorded); optional OPENAI_DIALOGUE_MODEL.
- Dialogue uses a server-created, signed session and validated model response. NPC simulation must not call the LLM.
- Regression coverage includes generated turns, missing-key fallback, provider 429/5xx/timeout, incomplete-output cause, invalid response rejection, session recovery, and authoritative-state protection.
- Real in-game API acceptance is recorded separately in REAL_AI_IN_GAME_ACCEPTANCE.json; generated dialogue text and credentials are excluded from that evidence.
- Live Vercel API status confirmed `OPENAI_API_KEY` configured, and the one-request in-game generation check returned a character answer in the UI. Evidence: `VERCEL_PRODUCTION_AI_SMOKE.json`. This is a single successful generation, not a full voice-quality or reliability evaluation.
- A local `.env.local` smoke received the safe category `network_error`; it did not receive an HTTP response from the provider. The secret value and provider response body are never logged by the smoke.
