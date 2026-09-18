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
- [x] `SOURCE/tests/e2e/fixture/exam-shelves.fixture.e2e.test.ts` (fill-in — pre-committed skeleton)

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

**Investigation Targets read**: skeleton file (every comment block, incl. Selection/Mock boundary/Hazard/Proof obligation sections); frontend DD § Test Plan (Mock boundary row :417, D005 note); UI Spec § Page State Matrix (row #5 confirms Candidate 2's cold-start shape: practice absent, hot→explore order); `app/(exams)/exams/page.tsx` (P5-T1's landed branch — `hasBrowseParam(sp)` read off raw `sp`, `SHELF_ORDER.map` + `data && <ExamShelf/>` narrowing, `ExamPagination` early-returns `null` when `pageCount <= 1`); `vitest.fixture.config.ts:36-54` (glob + 6-file exclude list, this file not among them); `tests/helpers/renderServerTree.tsx` (server renderer, detached container, no cleanup needed).

**Baseline before this task**: ran `npx vitest run --config vitest.fixture.config.ts` before writing any assertion — 1 file passed (`essay-auto-scoring.fixture.e2e.test.ts`, 4 real `it`s) + 1 file skipped (this one, 3 `it.todo`), confirming the skeleton was genuinely still `it.todo` and the lane's only executing file today is a DIFFERENT feature's fixture-e2e case. `essay-auto-scoring.fixture.e2e.test.ts` is the sole proven precedent in this repo for the RootLayout -> (exams) layout -> page composition shape this skeleton requires (its own header comment says the same); its mock set (server-only, next/headers, next/font/google, @vercel/analytics/next, next/navigation, SkipLink, two Server Action modules) was mirrored closely rather than reinvented, then adapted to this feature's actual data sources (`listExamShelves`/`listExamsRanked`/`listExamFacets`/`getCurrentUser`+`getCurrentUserProfile`).

**Deviation found and fixed during implementation**: `container.querySelector("nav")` is NOT a valid "0 pagination nav" check in this composed tree — `SiteHeader` (`aria-label="Điều hướng phụ"`) and `BottomNav` both carry their own permanent `<nav>`, present on every render regardless of branch (unlike P5-T1's `page.test.tsx`, which renders `<ExamsPage/>` directly with no layout, so a bare `nav` selector was safe there). Fixed with a `paginationNav()` helper scoped to `ExamPagination`'s own resolved `aria-label` (`copy["exams.pagination"]` = "Các trang danh sách đề"). This matches the skeleton's own more precise wording ("0 ExamPagination `<nav>`", "0 `<nav>` pagination element"), not a redesign of the obligation.

**readEntitlement**: left REAL/unmocked, per the frontend DD's Mock boundary ("both layouts" real). `getCurrentUser`/`getCurrentUserProfile` both stubbed to a signed-out user (`null`), so `readEntitlement(null)` takes its documented zero-I/O fast path (`readEntitlement.ts:61`) — confirmed by inspection, not by adding a third mock — keeping the lane's NO DATABASE/NO NETWORK promise intact.

**Reference Contract compliance (AC-051 row)**: Y — Candidate 2's test asserts exactly 2 `<section>` elements in DOM order `["shelf-hot", "shelf-explore"]` and 0 nodes referencing `shelf-practice` (by `id`, by `aria-labelledby`, and by both resolved copy strings — the title literal and the subtitle's stable trailing clause, since the subtitle is never computed at all for a null shelf).

**Card counts observed (cold-start fixture, Candidate 2)**: hot = 2 exams, explore = 2 exams -> total `<li>` under the 2 rendered shelf rows = 5 (4 `ExamCard`s + 1 always-present "Xem toàn bộ kho đề" tile in the Khám phá row), asserted via `hot.exams.length + explore.exams.length + 1`.

**Green run**: `npx vitest run --config vitest.fixture.config.ts` — 2 files passed, 10/10 tests passed (4 essay + 6 here: 1 bare-/exams + 4 table-driven `it.each` cases + 1 cold-start). This is genuinely the first green run of this feature's fixture-e2e case — treated as new evidence per D005, not a formality: it exercises the real composed route tree (RootLayout -> AppShell -> ExamsPage) for the first time under any lane, catching the `nav` selector issue above that no other lane's test shape would have surfaced.

**Binding Decisions / further Reference Contracts**: task file has no Binding Decisions section; the single Reference Contracts row is evaluated above.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, including every comment block in the pre-committed skeleton
- [x] Confirm both candidates currently run as `it.todo`
- [x] Confirm the skeleton's POSITIVE-FIRST rule is honored: a real shelf title text must be found before any negative assertion, in both candidates
### 2. Green Phase
- [x] Replace `it.todo` with real `it` assertions per the skeleton's comment blocks for Candidate 1 (bare `/exams` + table-driven re-render for `{sort:"hot"}`, `{sort:"garbage"}`, `{page:"abc"}`, `{dir:"asc"}`) and Candidate 2 (cold-start fixture)
- [x] Run `npm run test:fixture` and confirm green
### 3. Refactor Phase
- [x] Confirm this is the first meaningful run of gate 5 for this feature per the plan's own note — do not treat a first green run as routine

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
- [x] Both candidates converted from `it.todo` to `it`, all skeleton assertions pass
- [x] `npm run test:fixture` green
- [x] Every Reference Contract's Compliance Check evaluates to `Y`
- [x] Gates 1-5 green (gate 6 continues per its Phase-position rule — meaningful from Phase 0 onward but no feature-specific localdb cases exist until Phase 8). Verified: `eslint . --max-warnings 0` (gate 1) clean repo-wide; `tsc --noEmit` clean repo-wide; `npx vitest run` (gate 3, default lane) — 1 PRE-EXISTING, UNRELATED failure in `lib/security/rateLimit.test.ts` ("keeps ONE account's whole daily Gemini budget under the project quota", `worstCasePerUser` 33 > `SUPPLIER_DAILY_QUOTA` 20) — confirmed pre-existing via `git status` (only this task's two files are modified in the worktree); out of this task's Impact scope (Notes section), not touched or caused by this change, and not fixed here; `npx vitest run --config vitest.fixture.config.ts` (gate 5) green, 2/2 files, 10/10 tests.

## Notes
- Impact scope: `exam-shelves.fixture.e2e.test.ts` fill-in only — the skeleton's structure/comments are not this task's to redesign, only to satisfy.
- Scope boundary: no production source files are touched by this task.
