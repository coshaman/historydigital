# API audit — current V36 checkpoint

Audited HEAD: 2da550621f53d3af8f6f23b7a5e2d05b3d3d9108 (codex/master-dialogue-opinions)

- Deployment contract: Vercel same-origin functions; no Cloudflare worker or external client-side key.
- Runtime routes: /api/rpg/health, /api/rpg/session/start, and /api/rpg/dialogue.
- Secret configuration name: OPENAI_API_KEY (value intentionally not recorded); optional OPENAI_DIALOGUE_MODEL.
- Dialogue uses a server-created, signed session and validated model response. NPC simulation must not call the LLM.
- Regression coverage includes generated turns, missing-key fallback, provider 429/5xx/timeout, incomplete-output cause, invalid response rejection, session recovery, and authoritative-state protection.
- Real in-game API acceptance is recorded separately in REAL_AI_IN_GAME_ACCEPTANCE.json; generated dialogue text and credentials are excluded from that evidence.
- Vercel production deployment and environment settings remain unverified; health confirms key presence only, while a successful dialogue request is the generation check.
