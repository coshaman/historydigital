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

Set the repository Actions variable `RPG_AI_API_BASE_URL` to the Worker **origin** (scheme and hostname only), for example `https://russian-lives-v33-rpg-ai.example.workers.dev`. The Pages workflow passes this public URL into `npm run build:v33`, which validates and injects it as `window.V33_RPG_AI_API_BASE_URL` in the generated static build. The variable is not a credential. If absent, the game builds in offline mode. The build rejects non-HTTPS URLs (except localhost development), embedded credentials, URL paths, queries, and fragments. Do not add the OpenAI key to a Pages variable, Actions variable, repository, browser storage, URL, or client request.

After setting or changing the variable, run the `V33 GitHub Pages` workflow on `master` to publish the new public endpoint. `OPENAI_API_KEY` and `RPG_SESSION_SIGNING_KEY` remain Cloudflare Worker secrets set with Wrangler.

## Endpoint and privacy contract

- `POST /api/rpg/session/start` accepts an allowed speaking NPC id and, for the game client, an allowed distinct embodied-character id. The actor id is client-declared framing context, not authenticated against local save state; it cannot authorize or alter game state. The server selects the NPC scene, persists the pair, and issues a signed opaque token. The model receives the embodied character's checked-in role context: occupation, estate/rank, legal mobility, literacy, estimated wealth bracket and provenance status, speech style, and authored motives/risks/taboos. The Worker derives up to six player-side known facts from that character card's own `privateKnowledgeIds`; client-supplied fact text and dynamic witnessed facts are never accepted. These facts may guide suggested player replies but are explicitly not knowledge of the speaking NPC and must not appear in NPC speech unless the player reveals them. Motives and fears are private role guidance and must not be treated as known by the NPC unless the player says them. For a declared actor, the Worker derives a designed-estimate balance and inventory from the character card's checked-in starting resources plus accepted authored action IDs. These are unverified player-side hints, never authenticated save state; they may guide suggested replies only, and the NPC must not know or mention them unless the player discloses them. Client-supplied resource values and action descriptions are rejected.
- `POST /api/rpg/dialogue` accepts the token, an idempotency key, bounded player text, optional current relationship hints, and up to 12 quest/action ID pairs from the local save. Relationship hints must exactly match an authored status for one of seven allowlisted groups. Action hints must exactly identify a checked-in quest action authorized for the embodied character; situation text is derived from repository quest data, never accepted from the client. Invented or cross-character actions are rejected. Both snapshots remain unverified client-local context: they can guide conversational tone and suggested player replies only, do not prove that the NPC witnessed anything, and cannot authorize game-state mutation. Their normalized content is included in the idempotency hash. Host, scene, character profile, dialogue memory and turn count come from server storage.
- Each character scene defines a single dialogue objective, allowed/forbidden topics, and an eight-turn scene limit. Replies contain spoken text and 2–3 ordinary utterance suggestions only; they have no quest, stat, item, relationship, or ending fields.
- `GET /api/rpg/health` reports `configured` or `BLOCKED_NO_KEY`; it never reveals secret values.
- Session dialogue context expires seven days after creation; later turns do not extend retention. Recent dialogue is limited to eight turns and sensitive email, URL, and phone-like strings are redacted before context/storage. The Worker HMACs Cloudflare's client address for a temporary rate-limit bucket; it does not persist the raw IP, and caller buckets expire after two days.
- A Durable Object enforces per-caller limits (8 starts/minute and 40/day; 30 dialogue turns/minute and 200/day) plus global per-minute/day service caps. CORS is not authentication; custom clients and IP rotation remain possible. Configure OpenAI project-side spending limits and monitor actual invoices separately from request-count caps.
- Provider 429, 500, timeout, and malformed response conditions use authored offline dialogue; they never mutate game state.
- Client token and transcript storage is keyed by the ordered embodied-character/NPC pair, so using the same NPC from another body does not reuse that conversation's memory.
- Each session processes one unfinished AI turn at a time. Closing during an AI request discards the client token and starts a fresh pair session when reopened; abandoned server claims expire within 60 seconds.

## Verification truth

Offline schema, origin, token, replay, injection, fallback, Worker-storage, and static build endpoint configuration checks run locally without credentials. No live API request has been made in this build; report `V33_LIVE_AI: BLOCKED_NO_KEY` until a configured Worker and real key complete a paid smoke check. Do not label the provider path live based only on mock tests.

## 2026-10-30 Worker URL setup verification

- `RPG_AI_API_BASE_URL` is now passed from GitHub's nonsecret Actions variables into the Pages build and normalized into the runtime's `window.V33_RPG_AI_API_BASE_URL` setting. It is a public Worker origin, not an OpenAI credential.
- The repository currently has no Actions variables; the deployed frontend config is blank and therefore correctly remains offline. `gh variable set RPG_AI_API_BASE_URL --repo coshaman/historydigital --body https://<worker>.workers.dev` followed by a Pages workflow run configures the client endpoint. API and signing keys remain Cloudflare Worker secrets.
- Static build configuration regression tests pass 2/2. No actual Worker or live API request was tested; `V33_LIVE_AI` stays `BLOCKED_NO_KEY`.
