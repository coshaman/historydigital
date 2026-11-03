# API audit — current V36 checkpoint

## Deployment contract

- Vercel same-origin functions; no Cloudflare worker and no client-side API key.
- Runtime routes: `/api/rpg/health`, `/api/rpg/session/start`, and `/api/rpg/dialogue`.
- Secret setting: `OPENAI_API_KEY`; optional model setting: `OPENAI_DIALOGUE_MODEL`.
- Health confirms only that the server has a key. The new **실제 AI 답변 시험** sends one short Responses API request and displays the generated answer or a safe failure category.
- Missing credentials return HTTP 503; provider, timeout, and response-validation failures return HTTP 502 with a safe category and no `turn` payload. The game shows the failure and leaves the question unrecorded; it never substitutes an authored reply.

## Verification on 2026-11-03

- Local actual API call using the ignored `.env.local`: session mode `AI`; generated response `fallback: false`; two generated beats and three follow-up choices. No API key or generated answer is stored in this report.
- Repeated after enforcing no-fallback behavior against the updated server: same-origin session start `201 / AI`, dialogue `200 / AI`, `fallback: false`, two generated beats, three follow-up choices. The development sandbox itself blocks outbound access (`EACCES`); the same test succeeded in the approved network-enabled local process.
- A live same-question voice check generated distinct responses for Alexei (records and traceable responsibility), Ekaterina (type and print work), and Pavel (seals, deadlines, and delivery). Response text is intentionally omitted from the evidence report.
- Browser smoke with the key deliberately removed: desktop and mobile report `Vercel에 OPENAI_API_KEY가 설정되지 않았습니다.` and display no offline answer.
- Opinion board browser acceptance: 16 active inquiries are visible initially, expandable to the full set; two different generated character responses complete a comparison note and persist after save.
- Production Vercel Function configuration and logs still require verification from the Vercel deployment; local success does not prove production environment variables are attached to the current Production deployment.
