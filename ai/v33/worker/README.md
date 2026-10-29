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

- A server-issued HMAC-signed random session token binds one host and one scene. The client sends only that token, a request id, and bounded free text; it cannot choose memory, facts, trust, money, state, quest completion, or ending.
- Durable Objects serialize the scene's 8-turn cap (80 is the hard session ceiling), 12-turn/minute cap, request idempotency, and a seven-day session expiry. A separate singleton Durable Object enforces 300 dialogue turns/minute, 1,200 turns/day, 80 session starts/minute, and 1,000 starts/day.
- Responses use a strict JSON schema and a 700-token maximum. Provider errors, timeouts, and invalid output fall back to authored lines. The deterministic game reducer alone changes inventory, relationships, quests, and endings.
- Conversation memory contains only the same session's last eight bounded turns and expires seven days after session creation. Later turns do not extend retention. Email, URL, and phone-like strings are redacted before storage and model context. No client IP is retained.
- CORS only controls browser access; it does not authenticate anonymous users or prevent a custom HTTP client. The global limits cap service use but do not guarantee a particular bill. Set a separate OpenAI project usage limit and review provider billing. The model's listed fallback does not claim live connectivity.
- Without `OPENAI_API_KEY`, the health route reports `BLOCKED_NO_KEY` and the game uses authored offline lines. Without `RPG_SESSION_SIGNING_KEY`, session creation returns `BLOCKED_SESSION_SECRET`. Live AI is not verified until a real Worker with a configured key has passed a paid, single-turn smoke check.

## Local checks

Run `node --test scripts/v33-ai-runtime.test.mjs`. No API key or network call is used by this test. A live smoke check is intentionally not part of routine acceptance.
