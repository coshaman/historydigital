# V33 RPG dialogue Worker

GitHub Pages serves the game only. This Worker is the only service that receives the OpenAI secret. Requests from other origins are rejected; the exact Pages origin is configured in `RPG_ALLOWED_ORIGINS`.

## Deploy

1. Copy `wrangler.toml.example` to `wrangler.toml` and review the Pages origin and model name.
2. From this folder run `npx wrangler login`.
3. Run `npx wrangler secret put RPG_SESSION_SIGNING_KEY` and enter a new random secret of at least 32 bytes.
4. Run `npx wrangler secret put OPENAI_API_KEY` and enter the OpenAI project key.
5. Run `npx wrangler deploy` and set the resulting Worker URL in the static game's public `RPG_AI_API_BASE_URL` setting. That URL is public and is not a credential.
6. Call `GET /api/rpg/health` from the Pages origin. It returns service availability only, never a key or secret.

To rotate a key or signing secret, create the replacement in the provider dashboard, run the matching `wrangler secret put` command, redeploy, and revoke the old value. No API key belongs in Pages build variables or browser code. `OPENAI_API_KEY` is absent from this example and all checked-in source.

## Safety and limits

- A server-issued HMAC-signed random session token binds the speaking NPC, a client-declared allowlisted embodied-character context, and one scene. The actor ID is not authenticated against browser save state; it is used only as conversation framing because this offline-first static game has no trusted account/session authority. The model receives the embodied character's public occupation/social context, not their private facts. Dialogue requests then send only the token, a request id, and bounded free text; clients cannot choose memory, facts, trust, money, state, quest completion, or ending.
- Tokens, recent turns and visible transcripts are isolated by the ordered embodied-player/NPC pair. Switching bodies and returning to the same NPC starts or resumes only that pair's session.
- Only one unfinished turn per session is processed at a time. Concurrent requests receive `409 request_in_progress`; an abandoned claim expires after 60 seconds. Closing the game dialogue during an AI request discards that pair's client token so reopening starts a fresh session instead of reusing an uncertain in-flight transcript.
- Durable Objects serialize the scene's 8-turn cap (80 is the hard session ceiling), 12-turn/minute cap, request idempotency, and a seven-day session expiry. A separate global object enforces 300 dialogue turns/minute, 1,200 turns/day, 80 session starts/minute, and 1,000 starts/day. Per caller, the Worker allows 30 dialogue turns/minute and 200/day, plus 8 session starts/minute and 40/day.
- Responses use a strict JSON schema and a 700-token maximum. Provider errors, timeouts, and invalid output fall back to authored lines. The deterministic game reducer alone changes inventory, relationships, quests, and endings.
- Conversation memory contains only the same session's last eight bounded turns and expires seven days after session creation. Later turns do not extend retention. Email, URL, and phone-like strings are redacted before storage and model context. The Cloudflare `CF-Connecting-IP` address is HMACed with the Worker signing secret for rate-limit bucket selection; the raw address is not persisted. Caller buckets expire after two days.
- CORS only controls browser access; it does not authenticate anonymous users or prevent a custom HTTP client. Caller limits raise the cost of single-address abuse; IP rotation can bypass them, so they are not identity or billing guarantees. Global caps and a separate OpenAI project usage limit are still required. Review provider billing. The model's listed fallback does not claim live connectivity.
- Without `OPENAI_API_KEY`, the health route reports `BLOCKED_NO_KEY` and the game uses authored offline lines. Without `RPG_SESSION_SIGNING_KEY`, session creation returns `BLOCKED_SESSION_SECRET`. Live AI is not verified until a real Worker with a configured key has passed a paid, single-turn smoke check.

## Local checks

Run `node --test scripts/v33-ai-runtime.test.mjs`. No API key or network call is used by this test. A live smoke check is intentionally not part of routine acceptance.
