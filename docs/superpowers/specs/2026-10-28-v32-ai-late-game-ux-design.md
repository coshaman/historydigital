# V32 AI Late-Game and UX Unification Design

## Objective

Extend the current `origin/master` Russian Lives: Act III route into a coherent, source-grounded social life simulation. Preserve the existing desk investigation, branch graph, save behavior, and five endings. Add playable AI-assisted circle, bookshop, supper, and reading scenes; a source-backed varied examination; persistent character memory; and a deployable server-side Responses API adapter. The authored state engine remains authoritative.

## Chosen architecture

- Keep the existing vanilla JavaScript, HTML/CSS, Three.js desk, and Node tooling. Do not migrate frameworks or replace the early game.
- Place JSON Schema, AI prompt composition, output validation, context selection, signal mapping, and memory validation in small dependency-injected modules shared between browser-facing runtime logic and the local server where applicable.
- The browser sends only scene ID, bounded user text, and an opaque session identifier to `POST /api/ai/turn`. A local Node endpoint and a Cloudflare Worker call OpenAI Responses API using a server environment secret. The static frontend only receives `AI_API_BASE_URL`.
- The provider returns strict structured turns. Server and client validate the same allowlists. A deterministic engine applies approved signals, caps repeated effects, records replayable change events, and resolves endings. Generated prose never mutates authoritative state.
- Keep recent turns, scene summaries, and validated durable memories in versioned save state. Context composition selects the active character/scene, current facts, a few relevant source cards, relevant memories, compact summary, and bounded recent dialogue.
- Author the activity schedule and scenario cards; use model output only to render short in-character dialogue and classify approved scene signals. If provider output fails twice, continue with authored fallback dialogue.
- Preserve the established brass, paper, ink, wood, type, portraits, and document focus. Add a related full-screen visual-novel shell for late scenes and generated atmospheric backgrounds/CG with a provenance manifest.
- Expand the fixed-question examination from a source-verified bank, drawing a deterministic subset with stable answer key and pass threshold. An NPC can react, but cannot score or promote the player.

## Late-game route

Use the existing circle and exam entry points. Make circle required, then schedule two everyday activities from bookshop, supper, and reading before the examination. Across replayed routes all three activities are reachable. The chosen order and opportunity cost are visible in restrained in-world copy. Preserve existing five ending families and timeline; late-game signals can alter ending evidence only through explicit deterministic mappings.

## Historical and dialogue constraints

- Any fact injected into an AI context has an allowed claim ID and checked-in source IDs. Validate output claim IDs against the scene. Reject unknown IDs and never turn them into canonical evidence.
- Keep documented fact, source-based interpretation, and fictional dialogue/actions separate in provenance.
- Validate source availability against scene date, including shop and reading items. Private/future texts are unavailable before their documented circulation/publication date.
- Maintain distinct voices for Alexei, Ekaterina, and Pavel; preserve the protagonist's agency. Generated prose stays concise, conversational Korean, avoids uniform honorific endings and repetitive assistant phrasing, and never narrates the protagonist's thoughts.

## Security and reliability

- Never retrieve or reuse the exposed key from earlier conversation. No key in repository, local storage, browser bundle, screenshots, or logs. `.env.example` contains placeholders only.
- Allow only GitHub Pages production and localhost development origins; bound request bytes, session turns, output tokens, and basic per-IP requests where the runtime supports it. No user-provided system prompts.
- Retry malformed/provider failures at most once; then return a safe, schema-valid deterministic response. A provider outage never blocks route progression.
- Secret tests scan tracked source and built frontend without printing any matching value. Live-provider checks are reported `UNVERIFIED` when no key is configured.

## Player experience

- The early desk and late scenes share typography, nameplates, dialogue geometry, paper/brass accents, transitions, history/notebook/source affordances, and accessible focus behavior.
- Choices use natural Korean and concise practical expectations; hide raw IDs, deltas, schemas, and developer metadata from normal play.
- Late scenes provide free text and two or three distinct, natural suggested replies. Thinking state is diegetic, duplicate submission is disabled, and retry/fallback retains scene state.
- Keep mobile scrolling, reduced-motion fallback, keyboard/touch access, save/load, and restart. Ending keeps historical comparison before fictional timeline and has no active dialogue panel.

## Acceptance

Implement the V32 goal document's full definition of done: core check/lint/test/build; schema/state/security/source/chronology/memory/exam/ending tests; prompt-injection and outage simulations; three route replays; all five endings; screenshots at 1440x900, 1366x768, 390x844, 360x800; screenshots across early and late scenes; transcript and memory evidence; and a final verification ZIP. Use at most two independent reviewers, one UX and one narrative/history/AI, then make one focused P0/P1 refinement pass. Do not claim live AI is verified without an actual configured provider call.

## Deliberate exclusions

No open-world calendar/economy, social feed, arbitrary model-authored branches/endings, full history sent on every request, framework migration, or deployment that requires unavailable service credentials. Production Worker files and setup instructions are included; actual secret provisioning remains external.
