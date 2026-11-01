# Chancery of Ink — Russian Lives: Act III

Russian Lives: Act III is a browser RPG deployed as a static game plus same-origin Vercel Node Functions. AI dialogue is optional; without a key, authored dialogue remains playable.

## Deploy on Vercel

1. Import `coshaman/historydigital` in Vercel and keep **Root Directory** at the repository root.
2. `vercel.json` sets the Other framework preset, `npm ci`, `npm run build:v33`, and `dist-v33` as the static output. The root `api/` directory is deployed as Vercel Functions.
3. Add the environment variable below in **Project → Settings → Environment Variables**. Choose Production, and Preview too if you want AI dialogue on previews. Redeploy after changing it.

| Variable | Value | Environment |
| --- | --- | --- |
| `OPENAI_API_KEY` | Your OpenAI project API key; mark it **Sensitive** | Production; optionally Preview and Development |
| `OPENAI_DIALOGUE_MODEL` | Optional model override. Default: `gpt-5.4-mini` | Match the environments above |

Do not add a `NEXT_PUBLIC_` prefix. The key is read only by `api/rpg/[...path].js` at function runtime. It is not injected into the static build, browser JavaScript, URLs, or session storage. Vercel Functions expose root-level `api/` files as Node endpoints; see [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js) and [environment variables](https://vercel.com/docs/environment-variables).

## Local run and one-turn API smoke

Create `.env.local` in the repository root (already ignored by Git):

```dotenv
OPENAI_API_KEY=your-project-key
# Optional; defaults to gpt-5.4-mini
# OPENAI_DIALOGUE_MODEL=gpt-5.4-mini
```

Then run:

```powershell
npm start
```

Open `http://127.0.0.1:4173/`. The local Node server serves the same `/api/rpg/*` handler used by Vercel. Never commit `.env.local`; `.env.example` contains placeholders only.

To validate a real provider response, start the local server with `.env.local` loaded and run:

```powershell
npm run v33-live-ai-smoke
```

The smoke makes one short dialogue-generation request, prints only pass/fail and a safe error category, and never prints the key or dialogue. It fails if the API falls back to authored text. A `provider_response_validation` result means the provider returned parseable output, but the game rejected it against its response schema or historical/context safeguards. The local smoke now reports which gate rejected it (`response_schema_invalid`, `unsupported_historical_year`, `uncited_historical_person`, or `undisclosed_player_context`). Provider HTTP failures, malformed JSON, and timeouts have separate categories.

## Runtime notes

- The browser calls `/api/rpg/session/start` and `/api/rpg/dialogue` on its own origin. There is no separate AI host to configure.
- Session continuity is held in a compressed, HMAC-signed token stored in the browser's session storage. The signing secret is derived on the server from the provider key; no database or third-party runtime is required.
- Since sessions are stateless, a user can replay an older signed token to fork their own conversation. The game does not use AI output to mutate quest state, inventory, relationships, or endings. Configure Vercel Firewall rate limits and OpenAI project spending limits for production traffic.
- Each generation disables model reasoning and caps the response at 420 output tokens. Provider failures use authored offline dialogue.

## V34 quest and dialogue checks

The Vercel deployment remains a static build plus same-origin Node Functions; no Cloudflare service or client-side key is used. For local private input, put `OPENAI_API_KEY` in the ignored `.env.local` file and run `npm start`. For Vercel, add the same variable under **Project → Settings → Environment Variables**, mark it Sensitive, choose Production and any Preview environments you use, then redeploy. Never use a `NEXT_PUBLIC_` variable for the key.

The quest tracker is derived from checked-in quest actions, host permissions, current chapter/date, map exits, and each body's own known evidence. It is recalculated after movement, possession, save/load, and quest changes. Offline typed dialogue remains visible and records the player's line; local replies use checked-in character facts, and unsupported topics are identified as offline rather than presented as generated AI.

Run the focused quest selector and browser evidence checks with:

```powershell
npm run v34-quest-guidance-test
npm run v34-browser-evidence
```

The browser evidence command uses the running local server at port 4188 by default, captures screenshots under `docs/v34/screenshots/`, and mocks online replies. The one-turn live smoke above is optional and may incur one provider generation; it does not print the key or reply text.

## Other commands

```powershell
npm run build:v33
npm run check
npm test
```

For current history, source, and gameplay notes see [`docs/v33/`](./docs/v33/).
