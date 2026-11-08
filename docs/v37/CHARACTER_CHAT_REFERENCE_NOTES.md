# Character chat reference notes

These user-supplied materials inform the conversational harness. They are practical prompt-writing references, not evidence for Russian history or a guarantee that a model will obey a prompt.

## References and use

- [Univers Chat: character prompt examples](https://www.univers.chat/guide/character-prompt-examples) — the page itself was not directly retrievable by the research browser. The Univers guide index describes this entry as reusable blocks for identity, personality, speech, appearance, background, relationships, boundaries, and sample voices. It also lists dedicated guides for writing style, one-to-one prompts, multi-character prompts, and opening messages. Applied here as a checklist for explicit character identity, relationship context, and voice examples; no unverified page-specific wording is copied.
- [DCInside AI Chatting: character prompt tips](https://gall.dcinside.com/mgallery/board/view/?id=aichatting&no=87741) — the post recommends a readable hierarchy from setting and style through character behavior, speech, constraints, and output shape; situation-separated event notes; and concrete sentences instead of compressed keyword piles. It also includes speculative explanations about model tokenization and separator effects. We use the structural and example-writing advice as practitioner guidance, not the tokenization claims as established fact.
- [Arca Live, elynai board post 171718398](https://arca.live/b/elynai/171718398) — the supplied page could not be retrieved or independently indexed in this research pass. It is recorded as a requested reference, but no claim is attributed to it until its contents can be checked.

## Application to this project

The runtime already supplies a character-specific voice sample set, relationship register, scene situation, immediate case context, recent turns, and a direct-response rule. Keep these as separate, bounded fields: identity and motive describe the speaker; relationship/register controls distance; the current scene anchors what can be discussed; recent turns control continuity. Do not replace them with a generic “be natural” instruction or an adjective list.

When revising a character, preserve one recognizable attention pattern and several short, non-identical Korean voice samples. Give each sample a concrete immediate circumstance. Keep stated historical claims tied to checked-in source evidence; roleplay advice is never a historical source.

## Existing implementation points

- Prompt and safe context assembly: `ai/v33/session-runtime.cjs`
- Per-character voice and register data: `rpg/characters/*.json`
- Prompt contract tests: `scripts/v33-ai-runtime.test.mjs`
- Character register and voice audits: `scripts/v36-voice-audit.mjs`, `scripts/v42-speech-register-audit.mjs`

## Applied dialogue correction — 2026-11-09

An open conversation with Ivan no longer receives the Petrashevsky investigation just because the campaign date is after 1849-04-22. His ordinary scene centers on street patrol, market traffic, residents, and his trip to the apothecary; the report and its claims enter the prompt when `CIRCLE_INVESTIGATION_1849` is explicitly active. The runtime tests cover both paths so a general question cannot inherit a case dossier while source-backed investigation dialogue remains available.
