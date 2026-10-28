# AI turn Worker

This optional Cloudflare Worker hosts `POST /api/ai/turn`. The static game keeps progressing through authored fallback dialogue when the Worker or API key is unavailable. Copy `wrangler.toml.example` to `wrangler.toml`, set the exact browser origin, then run `wrangler secret put OPENAI_API_KEY` and deploy. Its SQLite-backed Durable Object keeps server-owned dialogue memory across Worker instances.

The shared handler validates the active scene and response schema, caps the body and session turns, and never returns provider error details. The included 12-request/minute limiter is isolate-local; bind a Durable Object rate limiter before relying on it for globally consistent public traffic.
