# Task P5-T1 — `/exams` page branch: shelves vs. flat grid — the main integration point

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 5 (`/exams` Page Integration), Task P5-T1 — the frontend DD's own "the only task that can turn `/exams` red for every user"**
Layer: frontend (`SOURCE/app/(exams)/exams/`)

Metadata:
- Dependencies: P1-T6 (`hasBrowseParam`), P2-T3 (`ExamShelf`), P4-T4 (`ExamFilters` with the hot chip)
- Blocks: P5-T2 (fixture-e2e exercises this exact page), P6-T1 (the `?from=` chain needs live shelf cards to click through)
- Size: Small-Medium (1 file, high blast radius)
- Verification level: L1 — first moment `/exams` actually renders 3 shelves for a real request

## Implementation Content
Edit `SOURCE/app/(exams)/exams/page.tsx:37-123` — import `hasBrowseParam` from `@/lib/exams/browseParams`; compute `showShelves = !hasBrowseParam(sp)`; widen the `Promise.all` to 4 slots (`shelves`, `ranked`, `facets`, `user`) with early-return narrowing (`if (shelves !== null) return (...)`); move the `:69` destructure and `:76-78` `gridKey` computation into the grid branch only; import `listExamShelves` and compose `SHELF_ORDER.map` rendering `<ExamShelf key={kind} .../>` per shelf.

## Target Files
- [ ] `SOURCE/app/(exams)/exams/page.tsx`

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (Integration Point I1 — `/exams` page branch predicate)
- `docs/design/exam-shelves-frontend-design.md` (§ Data flow — Branch rule, Four array slots, Page body — `SHELF_ORDER.map`, literal `key={kind}`)
- `docs/design/exam-shelves-frontend-design.md` (§ Rendering, performance and motion — 0 client fetches; literal `key`; `motion-safe:scroll-smooth`; 0 globals.css edits)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Page State Matrix — /exams)
- `SOURCE/app/(exams)/exams/page.tsx` (`:37-123` the full current implementation — read every line before editing; `:69` destructure; `:76-78` `gridKey` computation)
- `SOURCE/lib/exams/browseParams.ts` (P1-T6 — `hasBrowseParam`, imported here)
- `SOURCE/features/exams/components/ExamShelf.tsx` (P2-T3 — rendered here per shelf)
- `SOURCE/features/exams/queries/shelves.ts` (P3-T2 — `listExamShelves`, called here)

## Change Category
`Change Category: boundary-change`

The `/exams` route is a published boundary — every existing consumer (bookmarks, links, the flat-grid UI itself) relies on its current per-parameter behavior. This task changes what that boundary renders for the "no browse param" case (grid → shelves), which Design-to-Plan Traceability marks as `connection-switching` across multiple rows for this exact task (Integration Point I1, the branch rule, `SHELF_ORDER.map`). Sweep the adjacent case: **every one of the 10 AC-008 params** (the full existing input surface of this boundary) must continue to render the pre-existing flat-grid behavior unchanged — this is the plan's own named highest-blast-radius task specifically because this sweep is large and easy to get subtly wrong.

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/prd/exam-shelves-prd.md (§ AC-003) | structure-order | "DOM order is Cần luyện → Nổi nhất → Khám phá; given a student whose Cần luyện shelf is absent, then DOM order is Nổi nhất → Khám phá" | Does `SHELF_ORDER.map` iterate in exactly `[practice, hot, explore]` order, and does a `null` practice shelf produce DOM order `[hot, explore]` with 0 placeholder gap? |
| docs/prd/exam-shelves-prd.md (§ AC-051) | state-lifecycle-negative | "Given any shelf, when its own selection yields 0 cards, then that shelf is absent from the page entirely — 0 headers, 0 subtitles, 0 placeholders, 0 empty cards, 0 errors — and the remaining shelves keep their relative order (D8)" | Does the page's `SHELF_ORDER.map` skip rendering entirely (not render an empty wrapper) for any shelf whose value is `null`? |

## Boundary Context (from the work plan's Connection Map)
- **Boundary**: Ten AC-008 listed URL params → `hasBrowseParam(sp)`. Owner left: browser-supplied URL. Owner right (this task, consumer): `app/(exams)/exams/page.tsx`, using `lib/exams/browseParams.ts` (P1-T6). Consumer parse rule: `key in sp && sp[key] !== undefined` on the raw `searchParams` object — **this task must call `hasBrowseParam(sp)` directly on the raw `searchParams`, never on a normalised/destructured local**. Expected signal: `?sort=garbage`/`?page=abc`/`?dir=asc` all render the flat grid despite normalising to `undefined` downstream.

## Investigation Notes
_(Record here: confirmation `showShelves` is computed from the raw `sp` before any destructuring/normalisation; confirmation `listExamFacets()` and `getCurrentUser()` run on BOTH branches, not just the grid branch; confirmation the page-level `Promise.all` member count stays at... 4 on the widened composition, matching the DD's declared "4 array slots.")_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Sweep the adjacent case per Change Category: enumerate all 10 AC-008 params and confirm the pre-change grid behavior for each, as the concrete baseline this task must not disturb
- [ ] Write/extend integration or fixture-lane-adjacent test cases (coordinate scope with P5-T2, which owns the fixture-e2e fill-in) confirming: bare `/exams` renders `showShelves = true`; any of the 10 AC-008 params renders `showShelves = false`
### 2. Green Phase
- [ ] Import `hasBrowseParam`; compute `showShelves = !hasBrowseParam(sp)` from the raw `sp`
- [ ] Widen the `Promise.all` to 4 slots (`shelves`, `ranked`, `facets`, `user`) with early-return narrowing
- [ ] Move the `:69` destructure and `:76-78` `gridKey` computation into the grid branch only
- [ ] Import `listExamShelves`; compose `SHELF_ORDER.map` rendering `<ExamShelf key={kind} .../>`
### 3. Refactor Phase
- [ ] Confirm `listExamFacets()` and `getCurrentUser()` run on both branches (needed by both grid and shelves views)
- [ ] Confirm `key={kind}` is a literal shelf-kind string, never an array index

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `app/(exams)/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide) — **first phase the full page tree compiles with the new branch**
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: `npm run build` (first real compile of the widened page tree); manual/fixture-lane render of bare `/exams` and of each of the 10 AC-008 params.
- **Success criteria**: bare `/exams` renders 3 shelves in DOM order practice→hot→explore (or the narrowed subset per AC-003); every one of the 10 AC-008 params renders the flat grid instead.
- **Failure response**: this is the frontend DD's own named highest-blast-radius task — if `npm run build` fails, do not proceed to any other Phase 5/6/7 task until it is green, since every downstream task assumes this page compiles.
- **Verification level**: L1 — functional, end-user-visible branch behavior.

## Proof Obligations
- **Claim** (AC-001–003, 005–008, 010, 014): the branch predicate reads RAW key presence on `sp` via `hasBrowseParam`, never the normalised locals.
  - **Primary failure mode**: the branch predicate is computed after destructuring `sp` into normalised locals (e.g. `sort ?? "newest"`), losing the distinction between "absent" and "present-but-normalises-to-default" — the exact regression the plan's Risk section names for this task.
  - **Boundary to exercise**: fixture-e2e (finalized in P5-T2) — this task's own local verification is the build + a manual spot-check; the systematic table-driven proof is P5-T2's.
  - **State assertion**: N/A (rendering, not a state transition).
  - **Mock boundary rationale**: fixture-e2e mocks the data layer per the frontend DD's Test Plan Mock boundary declarations (finalized in P5-T2); this task's own build-level check exercises no mock.
  - **Residual**: the exhaustive per-param table-driven proof (each of the 10 AC-008 params individually) is P5-T2's, not this task's — this task wires the predicate correctly; P5-T2 proves it exhaustively.
- **Claim** (AC-051, state-lifecycle-negative): `listExamFacets()` and `getCurrentUser()` run on BOTH branches; page-level members stay at 3 (existing) semantics preserved while shelves adds its own slot.
  - **Primary failure mode**: the widened `Promise.all` accidentally skips `listExamFacets()`/`getCurrentUser()` on the shelves branch, breaking the filter UI or auth-dependent rendering when shelves are shown.
  - **Boundary to exercise**: `npm run build` + fixture-e2e (P5-T2).
  - **State assertion**: N/A.
  - **Mock boundary rationale**: fixture lane mocks the data layer per the established Mock boundary declarations.
  - **Residual**: none beyond what P5-T2 closes.

## Completion Criteria
- [ ] `npm run build` succeeds
- [ ] Bare `/exams` renders 3 shelves in the DOM order practice→hot→explore (or the narrowed subset)
- [ ] Every one of the 10 AC-008 params renders the flat grid
- [ ] `listExamFacets()`/`getCurrentUser()` confirmed running on both branches
- [ ] Every Reference Contract's Compliance Check evaluates to `Y`
- [ ] Gates 1-4 green (gate 5/6 exercised fully by P5-T2/Phase 8 respectively, but should not regress here)

## Notes
- Impact scope: `page.tsx` only — but this is the plan's single highest-blast-radius file (can turn `/exams` red for every user if mishandled).
- Scope boundary — preserve unchanged: the grid branch's existing rendering logic once `showShelves` is `false` — it must remain behaviorally identical to today.
