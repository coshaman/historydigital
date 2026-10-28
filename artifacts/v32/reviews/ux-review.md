# V32 UX reviewer notes

Read-only review found a P1 mobile overlap: the ledger, notebook, docket, and Petersburg window covered the scene paper at 390 px. The existing browser test checked horizontal overflow and control count, but not the paper and prop intersection.

## Resolution

- Late-game mobile layout hides those overlay props while retaining the desk surface and scene art.
- The paper becomes an independently scrollable document with the duplicate objective removed and smaller event stills.
- Browser evidence now checks the mobile prop visibility, controls, horizontal bounds, saves/reload, all late-game scenes, the five-question exam, and the ending dialogue rail.

See the final captures under `artifacts/v32/screenshots/` and the browser run in `artifacts/v32/logs/`.
