# V33 AI Worker setup and status

The static RPG remains playable without AI. An optional Cloudflare Worker calls the OpenAI Responses API and returns only schema-checked dialogue. The deterministic browser game owns movement and all world-state changes.

## Configuration

Use `ai/v33/worker/wrangler.toml.example` as the Worker configuration. Set `RPG_ALLOWED_ORIGINS` to the exact deployed origin, for example `https://coshaman.github.io`. Do not add a URL path such as `/historydigital/` to the origin. Keep local origins out of production configuration.

From `ai/v33/worker/`:

```sh
npx wrangler login
npx wrangler secret put RPG_SESSION_SIGNING_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

Set `RPG_AI_API_BASE_URL` to the public Worker URL at static build time. It is a URL, not a secret. Do not add the OpenAI key to a Pages variable, Actions variable, repository, browser storage, URL, or client request.

## Endpoint and privacy contract

- `POST /api/rpg/session/start` accepts an allowed speaking NPC id and, for the game client, an allowed distinct embodied-character id. The actor id is client-declared framing context, not authenticated against local save state; it cannot authorize or alter game state. The server selects the NPC scene, persists the pair, and issues a signed opaque token. The model sees only the embodied character's public role context, not that character's private knowledge.
- `POST /api/rpg/dialogue` accepts only the token, an idempotency key, and bounded player text. Host, scene, character profile, dialogue memory and turn count come from server storage.
- Each character scene defines a single dialogue objective, allowed/forbidden topics, and an eight-turn scene limit. Replies contain spoken text and 2–3 ordinary utterance suggestions only; they have no quest, stat, item, relationship, or ending fields.
- `GET /api/rpg/health` reports `configured` or `BLOCKED_NO_KEY`; it never reveals secret values.
- Session dialogue context expires seven days after creation; later turns do not extend retention. Recent dialogue is limited to eight turns and sensitive email, URL, and phone-like strings are redacted before context/storage. The Worker HMACs Cloudflare's client address for a temporary rate-limit bucket; it does not persist the raw IP, and caller buckets expire after two days.
- A Durable Object enforces per-caller limits (8 starts/minute and 40/day; 30 dialogue turns/minute and 200/day) plus global per-minute/day service caps. CORS is not authentication; custom clients and IP rotation remain possible. Configure OpenAI project-side spending limits and monitor actual invoices separately from request-count caps.
- Provider 429, 500, timeout, and malformed response conditions use authored offline dialogue; they never mutate game state.
- Client token and transcript storage is keyed by the ordered embodied-character/NPC pair, so using the same NPC from another body does not reuse that conversation's memory.
- Each session processes one unfinished AI turn at a time. Closing during an AI request discards the client token and starts a fresh pair session when reopened; abandoned server claims expire within 60 seconds.

## Verification truth

Offline schema, origin, token, replay, injection, fallback, and Worker-storage checks run locally without credentials. No live API request has been made in this build; report `V33_LIVE_AI: BLOCKED_NO_KEY` until a configured Worker and real key complete a paid smoke check. Do not label the provider path live based only on mock tests.
