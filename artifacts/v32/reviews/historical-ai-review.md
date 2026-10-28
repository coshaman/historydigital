# V32 history and AI boundary reviewer notes

Read-only review findings and resolutions:

- **Client memory forgery:** turn requests now accept only session ID, scene ID, turn index, and player text. Recent dialogue, summaries, and memories are restored from server session context; Cloudflare uses a SQLite Durable Object. A regression test attempts to supply each rejected field.
- **Out-of-scene speaker/relationship:** structured turn validation and deterministic relationship application both require the active scene cast.
- **Undated monthly source availability:** a `YYYY-MM` date is conservatively treated as available after that month closes. The 1846 book date is recorded at year precision.
- **Modern synthesis mislabeled as a 1845 publication:** the Petrashevsky secondary synthesis is attributed to the Russian Historical Society and dated 2021-01-21; its interpretation remains narrator-only and cannot enter character dialogue.
- **Prompt injection coverage:** tests now cover malformed extra fields and a schema-valid response followed by the deterministic state engine, confirming that game state and endings do not change.

The publication metadata was checked against the [Russian Historical Society page](https://historyrussia.org/sobytiya/podvergnut-smertnoj-kazni-rasstrelyaniem-k-200-letiyu-m-v-petrashevskogo.html), published 21 January 2021.
