# Chancery of Ink — Russian Lives: Act III

Russian Lives: Act III is a browser RPG deployed as a static game plus same-origin Vercel Node Functions. Free-form character conversation requires an OpenAI key on Vercel; when generation is unavailable, the game reports the error and offers a retry instead of inventing an offline answer.

## Play loop additions

The 1847–1849 city now connects buying a periodical and printing supplies to reading a cited source, editing a one-page street issue, then handing it out or mailing it. As press staff, the mission tracker guides this loop through three dated issues; a copy left at the street stand can be read by other characters, adding its cited source to their own knowledge. The fictional police intake room follows witnessed tampering or repeated suspicious acts; statement and fine outcomes are recorded in the save. The opinion board has 23 inquiries about class, censorship, public reporting, safety, responsibility, education, and related disputes. Choose a question, ask two residents, compare their generated answers, and record your own position. A successfully generated model reply is the text shown in play; if provider validation fails, the game reports the reason and offers a retry instead of silently substituting authored dialogue.

For AI dialogue, use the Vercel deployment URL. GitHub Pages serves the static game but cannot run `/api/rpg/*`; its API status panel now names this hosting limit directly.

## Deploy on Vercel

1. Import `coshaman/historydigital` in Vercel and keep **Root Directory** at the repository root.
2. In Vercel → Project → Settings → Git, set **Production Branch** to `master` so direct pushes there create production deployments. `vercel.json` sets the Other framework preset, `npm ci`, `npm run build:v33`, and `dist-v33` as the static output. The root `api/` directory is deployed as Vercel Functions.
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

The smoke makes one short dialogue-generation request, prints only pass/fail and a safe error category, and never prints the key or dialogue. It fails unless the response contains a genuine AI turn with `fallback: false`. Safe categories include `network_error`, `http_401`, `http_429`, `response_schema_invalid`, `unsupported_historical_year`, `uncited_historical_person`, and `undisclosed_player_context`; the smoke never prints prompt or response text. In Vercel, inspect Function runtime logs for the `rpg_provider_error` event and its code.

### If AI dialogue cannot be generated on the deployed site

- Test `https://<your-vercel-domain>/api/rpg/health`. A working deployment returns JSON with `status: "ok"` and `ai: "configured"`.
- If that URL shows a 404 or a static page, the game is being opened on a static host such as GitHub Pages. GitHub Pages cannot run this repository's `/api/rpg/*` Node Functions; use the Vercel deployment URL.
- If health returns `ai: "BLOCKED_NO_KEY"`, set `OPENAI_API_KEY` for the Vercel Production environment (and Preview if needed), then redeploy. Environment changes do not update an already-built deployment.
- If health is configured but dialogue fails, open Vercel → Project → Logs → Functions and inspect the `rpg_provider_error` event's safe `code`. `http_401` means the provider rejected the credential; `http_429` means the project or rate limit refused the request; `network_error`/`timeout` means the function could not complete the request; validation categories mean the generated turn was rejected without displaying a replacement answer.
- In-game **설정 · API 상태** checks the health route without generating a model reply, shows redacted errors recorded by this browser, and links to the Vercel dashboard. Server Function logs are not readable by the browser; inspect them in Vercel Logs. The browser stores only time, endpoint, HTTP status, and safe error code (up to 40 entries), never dialogue, prompts, keys, or session tokens.

## Runtime notes

- The browser calls `/api/rpg/session/start` and `/api/rpg/dialogue` on its own origin. There is no separate AI host to configure.
- Session continuity is held in a compressed, HMAC-signed token stored in the browser's session storage. The signing secret is derived on the server from the provider key; no database or third-party runtime is required.
- Since sessions are stateless, a user can replay an older signed token to fork their own conversation. AI prose never directly changes game state; only a successfully generated reply to a player-selected viewpoint question records one visible perspective note and one insight point. These notes do not alter relationships, campaign outcomes, or endings. Configure Vercel Firewall rate limits and OpenAI project spending limits for production traffic.
- Each generation disables model reasoning and caps the response at 420 output tokens. A provider or validation failure returns a safe error without generated dialogue; the unanswered prompt is not written to the game record.

## V35 contextual play and evidence

The city mission board names a first step and next destination. Follow the current personal or neighborhood quest, meet the named resident in person, and use the indicated map exit; three-stage personal stories keep their progress in the journal. The separate **사건·철학·이념 임무** board starts with 16 of 23 viewpoint inquiries available. Choose a question, ask the named resident, ask another resident about the same issue, compare their generated answers, then record your own position. The game saves the comparison and position as a visible journal entry.

The printshop, 1848 distribution notice, 1849 investigation report, and May letter each have a checked-in case context that connects the document to a character's situation, practical stakes, and authorized quest actions. `rpg/data/source-reader-index.json` supplies the reader layout, exact excerpt ID/range, date facets, and Korean context. Historical text stays separate from fictional character positions and dialogue. The 36-resident voice audit checks distinct rhythm, blind spots, relationship registers, and six situations; AI dialogue receives those per-character details and must follow the current relationship register.

Run the V35 evidence checks with:

```powershell
npm run v35-build-matrices
npm run v35-content-audit
npm run v35-npc-replay
npm run v35-ai-mock-audit
npm run v35-browser-acceptance
```

`v35-npc-replay` writes the deterministic 30-minute movement and save/reload record to `docs/v35/npc-30-minute-replay.json`. The browser acceptance serves the built `dist-v33` artifact, exercises the source reader at desktop and phone widths, and replays the five endings. `docs/v35/` contains the worldview and source matrices, baseline, audit output, screenshots, and replay evidence. The separate live API smoke is `npm run v33-live-ai-smoke`; it makes one provider generation and never writes the key or conversation into evidence.

## V34 quest and dialogue checks

The Vercel deployment remains a static build plus same-origin Node Functions; no Cloudflare service or client-side key is used. For local private input, put `OPENAI_API_KEY` in the ignored `.env.local` file and run `npm start`. For Vercel, add the same variable under **Project → Settings → Environment Variables**, mark it Sensitive, choose Production and any Preview environments you use, then redeploy. Never use a `NEXT_PUBLIC_` variable for the key.

The quest tracker is derived from checked-in quest actions, host permissions, current chapter/date, map exits, and each body's own known evidence. It is recalculated after movement, possession, save/load, and quest changes. Character conversation openings and suggested questions are authored locally; the answer to a submitted question comes from the Vercel AI endpoint. If generation fails, the game shows an actionable error and does not substitute a locally authored answer.

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
