# Act III Source Corpus Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Add at least 30 net-new, full-context checked primary-source records that support the Act III ideas, events, and everyday-life branches.

**Architecture:** Keep additions in a dedicated source ledger rather than inflating the route dialogue JSON. A deterministic audit compares its stable IDs and witness identities against all checked-in source manifests and enforces provenance, contiguous context, translation, locator, date, and usage links.

**Tech Stack:** JSON, Node.js audit scripts, existing npm scripts.

**Spec:** `docs/superpowers/specs/2026-10-12-main-route-branching-and-unified-reading-design.md`

## Global Constraints

- Count only unique primary witnesses/items not already represented in the checked-in corpus; alternate URLs/translations do not increase the count.
- Every direct quotation has original-language text, contiguous contextual range, exact locator, edition/holding information, stable URL or shelfmark, aligned Korean translation, and availability date.
- Catalog metadata or later scholarship is never labeled as contemporary primary text.
- Every added record is used by a scene/choice/event or literary-borrowing record.

## Review Focus

- Duplicate witness under new IDs — baseline comparison test checks normalized witness key and source ID.
- Fragment lacks dispute context — context-range audit requires contiguous text and speaker/claim fields.
- Misaligned Korean — RU/KO segment parity test compares segment IDs and paragraph sequence.
- Incorrectly called primary — source-class audit rejects later commentary in primary slot.
- Unused sources inflate the count — referential audit requires at least one active route usage per new record.

### Task 1: Establish the corpus baseline and failing audit

**Files:** Create `scripts/act-iii-source-expansion-audit.mjs`; modify `package.json`; test `scripts/act-iii-source-expansion-audit.test.mjs`.

**Interface:** `auditSourceExpansion({baselineFiles, additions, route}) -> {uniqueCount, errors}`.

- [ ] Add fixture tests for duplicate URL/witness, missing locator, split/noncontiguous excerpt, bad source class, missing Korean segment, and unreferenced source; run and observe failures.
- [ ] Implement baseline collection from checked-in manifests and source registers discovered in the repository; normalize IDs, URLs, editions, and witness identity.
- [ ] Confirm empty additions report fewer than 30; commit audit and script.

### Task 2: Research, transcribe, translate, and add the 30+ records

**Files:** Create `narrative/ACT_III_BRANCHING_SOURCES.json`; modify audit and tests.

**Record fields:** `sourceId`, `sourceClass`, `witnessKey`, `authorOrIssuer`, `title`, `date`, `edition`, `holdingInstitution`, `locator`, `originalRussian`, `contextRange`, `koreanTranslation`, `translationStatus`, `availabilityDate`, `url`, `provenanceNote`, `sceneUsage[]`.

- [ ] Verify full context in primary document images/full text; record page/folio/article bounds and surrounding text sufficient to establish speaker, claim and immediate issue.
- [ ] Add at least 30 net-new unique items across rank/exam; education/access/control; press/censorship; philosophy/literature; circles; ordinary life; 1848-49 news reception.
- [ ] Align Korean directly with witness; distinguish editorial mediation and paraphrase accurately.
- [ ] Record any `LITERARY_BORROWING` separately with author/work/original wording/edition URL/project Korean rendering.
- [ ] Run audit and confirm >=30 unique, used, error-free records; commit.

### Task 3: Attach source records to playable content and complete provenance review

**Files:** Modify `narrative/ACT_III_BRANCH_ROUTE.json`, audit and tests.

- [ ] Test nonexistent scene source IDs and source records unreferenced by route.
- [ ] Validate reciprocal source-to-scene and scene-to-source references.
- [ ] Inspect every original range and translation against linked scene; replace anything unverified, duplicate, irrelevant or unresolved.
- [ ] Commit final linkage and audit report.
