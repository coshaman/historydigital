# Unified Reading and Room UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Give source reading and player choices one coherent newspaper/desk visual language and correct raised, wall-mounted window composition across sizes.

**Architecture:** Add shared paper/ink tokens and common surface primitives in `styles.css`; bind choice surfaces and article controls while keeping the original document primary. Preserve Three.js desk scene and adjust wall/window placement independently of reading/choice scroll regions.

**Tech Stack:** HTML, CSS, browser JavaScript, Three.js, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-main-route-branching-and-unified-reading-design.md`

## Global Constraints

- Newspaper remains focal; source RU/KO stay aligned and readable.
- Reading viewport stays internally scrollable with clear read-completion/continue behavior.
- Choices remain keyboard/touch operable; practical direction is visible before selection.
- 3D desk/props remain present; window raised/wall-mounted; no global overflow lock.
- Maintain reduced-motion and fixed historical labels/content.

## Review Focus

- Long source at narrow width: scroll/continue sees both languages and last excerpt.
- Three-option directions: no clipping/overlap at narrow widths, keyboard operable.
- Window bounds at varied aspect ratios; no control obstruction.
- 200% zoom, reduced motion, visible focus, resize without reload.

### Task 1: Establish failing visual/interaction tests and token contract

**Files:** Create `scripts/main20-unified-reading-ui.mjs`; modify `package.json`.

- [ ] Playwright tests for tokens, internal paper scroll, visible/clickable choices, window bounds, desk canvas, keyboard activation.
- [ ] Capture baseline at 1440x900, 1024x768, 390x844 and 200% zoom; commit harness.

### Task 2: Unify newspaper and choice surfaces

**Files:** Modify `styles.css`, `main20-runtime.js`, `index.html`; test UI script.

- [ ] Test shared token use and source-context association.
- [ ] Add `.document-surface`, `.document-action`, `.document-action-detail`; bind existing choices/article controls without behavior changes.
- [ ] Verify scroll/read gate/disclosure at all sizes; commit.

### Task 3: Raise and anchor the window preserving 3D desk

**Files:** Modify `styles.css`, `three-desk.js`, UI tests.

- [ ] Add geometry assertions for window/desk at desktop/mobile ratios.
- [ ] Adjust wall/window stacking and allow intentional crop only; keep article/dialogue/choice clear of window.
- [ ] Run geometry/interaction acceptance; commit.

### Task 4: Cross-browser visual/accessibility acceptance

**Files:** Modify UI script and `package.json`.

- [ ] Test reduced motion, tab order, focus, scrolling, resize without reload.
- [ ] Run `npm run main20-unified-ui`, `npm run lint`, `npm run build`; capture screenshots at 1440x900, 1024x768, 390x844.
- [ ] Commit verified screenshots/report without staging unrelated artifacts.
