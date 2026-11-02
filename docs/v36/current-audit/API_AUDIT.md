# API audit — current V36 checkpoint

Audited HEAD: `49cee556bbdb1cf65324822913b1e0a2d975e8f6` (codex/master-dialogue-opinions)

- Deployment contract: Vercel same-origin functions; no Cloudflare worker or external client-side key.
- Runtime routes: `/api/rpg/health`, `/api/rpg/session/start`, `/api/rpg/dialogue`.
- Secret configuration name: `OPENAI_API_KEY` (value intentionally not recorded); optional `OPENAI_DIALOGUE_MODEL`.
- Dialogue uses a server-created, signed session and validated model response. NPC simulation must not call the LLM.
- Regression coverage includes generated turns, missing-key fallback, provider 429/5xx/timeout, incomplete-output cause, invalid response rejection, session recovery, and authoritative-state protection.
- On 2026-11-03, the actual Vercel function handler was exercised locally with the private `.env.local` key: session creation returned `AI`; the Responses API returned two generated beats with `fallback: false` at a 700-token ceiling. No key or generated text is recorded.
- Vercel production deployment and environment settings remain unverified; health confirms key presence only, while a successful dialogue request is the generation check.
