# V42 Ideological History Layer — Design Specification

## Goal

Extend the existing MAIN20 Russian Lives: Act III route into a playable history-of-ideas layer without replacing the V41 runtime. The player must form historically plausible opinions about Russia's institutional and literary disputes, see those opinions recur in later dialogue, and reach one of the existing five historical-analogue endings through a combination of beliefs, concrete actions, and relationships.

## Non-goals

- No new encyclopedia or dashboard UI.
- No removal of the document desk, source reader, RU/KO alignment, save/load, window, chronology, or legacy-runtime isolation.
- No modern moral-answer framing, hidden score display, or anachronistic Chekhov content.
- No claim that official nationality and Slavophilism are equivalent.

## Runtime/data architecture

1. Keep `main20-runtime.js` as the sole owner of the MAIN20 route and preserve the existing phase machine.
2. Add an authoring-only `ideology` object to the MAIN20 state with explicit dimensions for official-nationality sympathy, Westernizer reform, Slavophile tradition/community, moral-Orthodox reform, public literary criticism, social reform, and radical discussion. Values remain internal and are never rendered as scores.
3. Add a short `ideology_prologue` scene group before C03. It uses the same conversation, document, and source-reader components as existing scenes. Its four beats are: post-Petrine Europeanization, Table of Ranks and the protagonist's 10th rank, Uvarov's 1833 triad, and Chaadaev/Russia-Europe with a nuanced Slavophile–Westernizer exchange.
4. Add a dated 1847 follow-up beat in C07 after the 1842 `Dead Souls` material. The sequence is `Dead Souls` → `Selected Passages from Correspondence with Friends` → Belinsky's 1847 letter. The game must not collapse these dates.
5. Every ideological choice records: a belief effect, a visible callback key, a source-read prerequisite, and the existing immediate direction fields (audience, record mode, office exit, risk).
6. Extend ending resolution with gated ideological evidence and action evidence. A belief-only route and an action-only route must not independently guarantee an opposite ending. The resolver returns a non-numeric player-facing ledger of selected beliefs, at least two concrete actions, and one relationship/history callback.

## Historical authoring contract

Each new core source record must include `sourceId`, date, edition, locator, original Russian, Korean translation, `DIRECT` or `PARAPHRASE`, and the first player-availability date. Source ranges must be contiguous witness ranges wherever the argument depends on context. Literary borrowings are separate records with author, work, original text, edition/source URL, and project translation; they cannot be presented as historical speech.

Required source families: Uvarov 1833, Table of Ranks, Chaadaev's First Philosophical Letter (1836), one primary Westernizer source, one primary Slavophile source, Gogol 1847, Belinsky 1847, and Petrashevsky/Fourierist reform context.

Static authoring warnings must reject these false equivalences: official nationality = Slavophilism; Westernizer = copying all Europe; Slavophile = ethnic nationalism; Gogol = government propaganda; Belinsky = revolutionary socialist; Petrashevsky circle = unified revolutionary party; Table of Ranks = ideology.

## Dialogue and choice design

The speech-register matrix will cover Alexei, Ekaterina, Pavel, and the protagonist across first meeting, ordinary colleague talk, private talk, conflict, intimacy, and formal institution. Audit failure occurs when characters differ only by subject matter while sharing the same endings and rhythm.

The conversation must explain each disagreement before the player chooses. Choices are first-person, historically plausible, and include deferment only where further evidence is available. Each consequential choice exposes immediate audience/visibility, record status, office exit, and broad risk without revealing affinity or ending outcomes.

## Ending presentation

The ending overlay keeps the historical biography and plausible future-life sections, and adds a readable “당신이 반복해서 택한 생각” ledger containing three or four actual belief statements, two or more recorded actions, and a relationship/history callback. It does not display numeric affinity.

## Verification gates

- Static historical/provenance and false-equivalence audit passes.
- Existing `npm run check`, build, lint, and route tests pass.
- Browser acceptance passes at 1440×900 and 390×844.
- A first-time reviewer can answer the six prologue questions and the three Gogol/Belinsky questions from the route.
- All five endings remain reachable and each requires both ideological and concrete-action evidence.
- V41 regressions, legacy leaks, dead ends, P0, and P1 are zero.
