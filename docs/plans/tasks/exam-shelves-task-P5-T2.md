# Task P5-T2 — Fill in `exam-shelves.fixture.e2e.test.ts` (Candidates 1 & 2)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 5, Task P5-T2**
Layer: frontend (`SOURCE/tests/e2e/fixture/`)

Metadata:
- Dependencies: P5-T1 (the page branch this exercises)
- Blocks: P8-T1 (Phase 8's verify-schema probes run after this lane is green)
- Size: Small (1 file, pre-committed skeleton fill-in)
- Verification level: L1 — the FIRST case the fixture lane has ever actually executed for this feature (frontend DD D005 note); treat a green run as evidence, not merely absence of failure

## Implementation Content
Fill in `SOURCE/tests/e2e/fixture/exam-shelves.fixture.e2e.test.ts` (already committed as `it.todo`, Candidates 1 & 2) — replace with real `it` assertions using `renderServerTree`.

## Target Files
- [ ] `SOURCE/tests/e2e/fixture/exam-shelves.fixture.e2e.test.ts` (fill-in — pre-committed skeleton)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/exam-shelves.fixture.e2e.test.ts` (the full pre-committed skeleton — read every `Proof obligation`/`Primary failure mode` comment block before writing any assertion)
- `docs/design/exam-shelves-frontend-design.md` (§ Test Plan — incl. the Mock boundary MOCKED/REAL declarations)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Page State Matrix — /exams)
- `SOURCE/app/(exams)/exams/page.tsx` (P5-T1's landed branch — the page under test)
- `SOURCE/vitest.fixture.config.ts` (`:36-54` — how the fixture lane collects and runs this file)
- `SOURCE/tests/helpers/renderServerTree` (the render helper this test imports)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/prd/exam-shelves-prd.md (§ AC-051) | state-lifecycle-negative | "Given any shelf, when its own selection yields 0 cards, then that shelf is absent from the page entirely — 0 headers, 0 subtitles, 0 placeholders, 0 empty cards, 0 errors — and the remaining shelves keep their relative order (D8)" | Does the cold-start fixture (practice shelf = null) render exactly 2 `<section>` shelves in order hot→explore, with 0 nodes referencing `shelf-practice`? |

## Boundary Context (from the work plan's Connection Map)
- **Boundary**: Ten AC-008 listed URL params → `hasBrowseParam(sp)`. This task provides the **systematic, table-driven proof** of the expected signal ("`?sort=garbage`/`?page=abc`/`?dir=asc` all render the flat grid despite normalising to `undefined`") that P5-T1 wires but does not exhaustively test itself.

## Investigation Notes
_(Record here: confirmation this is genuinely the first green run of this fixture-e2e file — per the frontend DD D005 note, treat the green run as new evidence, not a formality; the exact card counts observed for the cold-start fixture.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, including every comment block in the pre-committed skeleton
- [ ] Confirm both candidates currently run as `it.todo`
- [ ] Confirm the skeleton's POSITIVE-FIRST rule is honored: a real shelf title text must be found before any negative assertion, in both candidates
### 2. Green Phase
- [ ] Replace `it.todo` with real `it` assertions per the skeleton's comment blocks for Candidate 1 (bare `/exams` + table-driven re-render for `{sort:"hot"}`, `{sort:"garbage"}`, `{page:"abc"}`, `{dir:"asc"}`) and Candidate 2 (cold-start fixture)
- [ ] Run `npm run test:fixture` and confirm green
### 3. Refactor Phase
- [ ] Confirm this is the first meaningful run of gate 5 for this feature per the plan's own note — do not treat a first green run as routine

## Quality Assurance Mechanisms
- `npm run test:fixture` — Enforces: fixture-e2e server-tree composition tests, 0-client-fetch proof — Config: `SOURCE/vitest.fixture.config.ts:36-54`; Covered: `SOURCE/tests/e2e/fixture/exam-shelves.fixture.e2e.test.ts`

## Operation Verification Methods
- **Verification method**: `npm run test:fixture` — this is gate 5, and this task is the first case that makes it meaningful for this feature.
- **Success criteria**: Candidate 1 — bare `/exams`: 3 `<section aria-labelledby="shelf-...">` in DOM order practice→hot→explore, 0 flat-grid list, 0 pagination `<nav>`, ≤10 cards/row, exactly 1 `[data-slot="ribbon"]` page-wide in the hot shelf's first card, Khám phá tile only as its own row's last `<li>`, chip row has 4 chips incl. `Nổi nhất`; then table-driven re-render for `{sort:"hot"}`, `{sort:"garbage"}`, `{page:"abc"}`, `{dir:"asc"}` — each renders 0 `<section>` shelf elements and the flat-grid+pagination tree instead. Candidate 2 — cold-start fixture (practice shelf = null): 0 nodes reference `shelf-practice`, exactly 2 `<section>` shelves render in order hot→explore, total card count equals exactly the hot+explore fixtures' card counts.
- **Failure response**: if any of the 4 garbage-param cases in Candidate 1 renders shelves instead of the flat grid, this is the exact R-3 regression the plan's risk section names — re-check `hasBrowseParam` is being called on raw `sp` at the page (P5-T1), not a re-implementation inside the fixture test.
- **Verification level**: L1 — first meaningful execution of the fixture-e2e lane for this feature; a green run is itself new evidence per the frontend DD's D005 note, not a formality.

## Proof Obligations
- **Claim** (Candidate 1, from skeleton verbatim): bare `/exams` renders exactly the structural contract above; the table-driven re-render for 4 garbage/off-axis param combinations each renders 0 shelf `<section>`s.
  - **Primary failure mode**: R-3 — a bookmarked/hand-edited URL with a garbage value silently renders shelves because the branch predicate read a normalised local instead of raw key presence.
  - **Boundary to exercise**: fixture-e2e via `renderServerTree` — full server-tree composition, closer to production than a mocked integration test but without a real browser/network.
  - **State assertion**: N/A (rendering).
  - **Mock boundary rationale**: per the frontend DD's Test Plan Mock boundary declarations — the data layer is mocked at its documented boundary; the render tree itself is real.
  - **Residual**: real-browser confirmation (actual CLS, actual click-through) is FQA-T5's manual Playwright audit, not this task's.
- **Claim** (Candidate 2, from skeleton verbatim): cold-start fixture (practice shelf = null) renders exactly 2 shelves in order hot→explore, with 0 nodes referencing `shelf-practice`, and total card count equals exactly the hot+explore fixtures' card counts.
  - **Primary failure mode**: a `null` practice shelf leaves a gap/placeholder in the DOM instead of being fully omitted, or the card-count total silently double-counts/drops cards from the remaining 2 shelves.
  - **Boundary to exercise**: fixture-e2e via `renderServerTree`.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: data layer mocked per Test Plan declarations.
  - **Residual**: none — this closes AC-051's negative-state proof at the fixture-lane level.
- **Claim** (POSITIVE-FIRST rule): a real shelf title text is found before any negative assertion in both candidates.
  - **Primary failure mode**: the same empty-tree hazard called out for `ExamCard`/`ExamShelf` — a negative assertion ("0 `<section>` elements") passes trivially against a broken/empty render tree.
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: n/a.
  - **Residual**: none.

## Completion Criteria
- [ ] Both candidates converted from `it.todo` to `it`, all skeleton assertions pass
- [ ] `npm run test:fixture` green
- [ ] Every Reference Contract's Compliance Check evaluates to `Y`
- [ ] Gates 1-5 green (gate 6 continues per its Phase-position rule — meaningful from Phase 0 onward but no feature-specific localdb cases exist until Phase 8)

## Notes
- Impact scope: `exam-shelves.fixture.e2e.test.ts` fill-in only — the skeleton's structure/comments are not this task's to redesign, only to satisfy.
- Scope boundary: no production source files are touched by this task.
