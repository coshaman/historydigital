# Historical Scenario Entry and Guidance

## Intent
Make MAIN01 easy to find from the top-bar Historical Locations menu, explain whether it can begin now, and show a concrete first action with a route into play. Keep the existing 1848 chronology and source availability intact.

## Goals
- Show each story's current readiness and next player-facing task in the Historical Locations menu.
- On selection, summarize the exact next action and offer a direct character roster entry; keep the mission tracker and journal aligned.
- Identify actual MAIN01 play modules: printwork puzzle, date-order knowledge puzzle, physical source/ledger investigation, courier chase, and city-stall purchases.
- Verify all required interaction types are reachable and accurately described.

## Non-goals and constraints
- Do not skip campaign prerequisites or advance dates automatically; historical documents remain date-gated.
- Do not add hidden ending/affinity mechanics or historical claims without sources.
- Preserve existing V47 story outcomes and save compatibility.

## Approaches
- Keep the current menu and add status/next-step labels and action buttons (chosen: smallest change, preserves campaign and chronology).
- Create a separate scenario launcher that rewrites the world date/chapter (rejected: risks future-source leakage and existing save state).
- Move the flow into a new screen (rejected: duplicates existing menu and adds UI surface).

## Implementation calls
Use `resolveV47StoryEntry` as the readiness source, present status-specific copy, and route roster actions through the existing `openCharacterList`. Make MAIN01's content lineup auditable in the story-entry data and verify purchase availability against the existing city product system.
