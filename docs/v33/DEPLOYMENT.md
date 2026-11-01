# Vercel deployment

The production architecture is Vercel-only: static game assets are built into `dist-v33/`; the root `api/rpg/[...path].js` is a Node Function that calls OpenAI from the server. The browser only calls same-origin `/api/rpg/*` routes.

Configure `OPENAI_API_KEY` as a Sensitive environment variable in Vercel Project Settings. Enable it for Production and, when needed, Preview. `OPENAI_DIALOGUE_MODEL` is optional and defaults to `gpt-5.4-mini`. Redeploy after changing environment variables. Never use a `NEXT_PUBLIC_` prefix for the key.

For local development, copy `.env.example` to `.env.local`, fill in the local key, and run `npm start`. `.env.local` is ignored by Git. `npm run v33-live-ai-smoke` performs one short, real model generation and reports only pass/fail and the selected model.

Sessions are stateless and HMAC-signed using a server-derived secret, so Vercel function instances can restart without losing a conversation. There is no database or external runtime dependency. Configure Vercel Firewall limits and OpenAI project spending limits before sharing the endpoint widely.

Vercel builds run `npm ci` and `npm run build:v33`, publish `dist-v33/`, and detect the Node Function under the repository-root `api/` directory. See the root [README](../../README.md) for exact dashboard setup.
