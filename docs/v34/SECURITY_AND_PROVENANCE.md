# V34 security and provenance notes

- Architecture: static Vercel build plus same-origin Vercel Node Functions in `api/rpg/`; no Cloudflare component.
- Credential handling: `OPENAI_API_KEY` is read only by the server function/local Node server. `.env.local` is ignored by Git and is excluded from the evidence package. The static build integrity test checks that credentials and endpoint configuration are absent from browser artifacts.
- Provider smoke: one local request was attempted with the configured server-side environment; the project rejected the returned shape as `provider_response_validation`. No second provider request was made. Automated browser runs used blocked requests or explicit mocks.
- Dialogue authority: generated dialogue is schema-validated and bounded to the current character, scene, source context, and known facts. It cannot mutate quest state, inventory, relationship state, or endings. Invalid, unavailable, rate-limited, or timed-out responses use authored fallback.
- Historical provenance: checked-in claims and source records remain the authority for historical assertions. The literary realm remains separate. Quest choices affect the fictional clerk’s record and route, not fixed historical outcomes.
- Privacy: session tokens are opaque server-signed values. Test tokens are mocked and are not included in the package. The package manifest records hashes only; no environment file is included.
