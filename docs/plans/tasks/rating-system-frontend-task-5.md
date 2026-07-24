# Task 5 (Frontend): Frontend display + eligibility + filter/sort wiring

Metadata:
- Dependencies: `rating-system-backend-task-4.md` — requires `Exam.communityDifficulty`, `ExamSort='hardest'`, `ExamFilters.level`, `listMySubmittedExamIds()`
- Provides: the live `/exams` and `/exams/[id]` catalog surfaces that Task 9-frontend audits; this task IS the frontend DD's Early Verification Point (the work plan's "Second verification target, Phase 1, integration")
- Size: Large (7 files — split is not further subdivided here because the stretched-link restructure, `RateButton`, `DifficultyBadge`, and the `ExamFilters`/`exams/page.tsx` wiring are mutually dependent for the single Early Verification Point check; keep changes tight and prefer multiple small commits within this one task if useful)

## Implementation Content
`DifficultyBadge` (pure, jsdom-tested) wired into `ExamCard` Level cell + exam-detail Difficulty cell; `ExamCard` stretched-link restructure (`<li relative>` + `after:inset-0` anchor + `relative z-10` siblings) with `RateButton` (client, three eligibility states: enabled/not-attempted/logged-out, focusable `aria-disabled` + `aria-describedby`); `ExamBrowser` threads per-card `eligibility` from one page-level `listMySubmittedExamIds()` set; `ExamFilters` gets a real Level `FilterRow` and folds Hardest into `?sort=` (D002 — removes `?hardest=1`); `exams/page.tsx` parses `?sort=`/`?level=`, loads `listMySubmittedExamIds()` + current user. Add `SOURCE/components/rating/DifficultyBadge.tsx` (+ `DifficultyBadge.test.tsx`, jsdom). Convert fixture-e2e FE2 (`rating.fixture.e2e.test.ts`) into a Playwright script against fixture-driven `listExams`/`listMySubmittedExamIds`/`getCurrentUser`.

## Target Files
- [ ] `SOURCE/components/rating/DifficultyBadge.tsx` (new)
- [ ] `SOURCE/components/rating/DifficultyBadge.test.tsx` (new, jsdom)
- [ ] `SOURCE/app/(layer2)/_components/rating/RateButton.tsx` (new)
- [ ] `SOURCE/app/(layer2)/_components/ExamCard.tsx` (stretched-link restructure; `+eligibility` prop)
- [ ] `SOURCE/app/(layer2)/_components/ExamBrowser.tsx` (thread per-card eligibility)
- [ ] `SOURCE/app/(layer2)/_components/ExamFilters.tsx` (real Level `FilterRow`; fold Hardest into `?sort=`; drop `hardest` prop)
- [ ] `SOURCE/app/(layer2)/exams/page.tsx` (parse `?sort=`/`?level=`; load `listMySubmittedExamIds()` + current user)
- [ ] `SOURCE/app/(layer2)/exams/[id]/page.tsx` (Difficulty cell → `DifficultyBadge`)
- [ ] `SOURCE/tests/e2e/fixture/rating.fixture.e2e.test.ts` (convert Test FE2 only)

## Investigation Targets
- `SOURCE/app/(layer2)/_components/ExamCard.tsx:11-37` (the single wrapping `<Link>` — the stretched-link restructure target)
- `SOURCE/app/(layer2)/_components/ExamCard.tsx:34-35` (literal Level `"—"` cell to replace)
- `SOURCE/app/(layer2)/_components/ExamBrowser.tsx:9-27`
- `SOURCE/app/(layer2)/_components/ExamFilters.tsx:40-44,265-268` (Hardest handler writing `?hardest=1` independently — the no-op/D002 target)
- `SOURCE/app/(layer2)/_components/ExamFilters.tsx:233,330-333` (symbolic Level `FilterRow`/"Coming soon" panel to make real)
- `SOURCE/app/(layer2)/_components/ExamFilters.tsx:73` (`router.push(pathname,{scroll:false})` — the searchParams-write pattern to follow)
- `SOURCE/app/(layer2)/exams/page.tsx:36-46` (current `sort` parse — currently drops `hardest`)
- `SOURCE/app/(layer2)/exams/[id]/page.tsx:97-100` (literal Difficulty `"—"` cell to replace)
- `SOURCE/components/ui/tooltip.tsx` (base-ui `Tooltip`, reused for the disabled `RateButton` reason)
- `docs/design/rating-system-frontend-design.md` (§ Component Hierarchy & Responsibilities)
- `docs/design/rating-system-frontend-design.md` (§ Early Verification Point) — this task's own success/failure criteria
- `docs/design/rating-system-frontend-design.md` (§ D002 Resolution — Hardest sort URL/param model)
- `docs/design/rating-system-frontend-design.md` (§ Minimal Surface Alternatives (Element 1 & 4))
- `docs/design/rating-system-frontend-design.md` (§ Field Propagation Map)
- `docs/design/rating-system-frontend-design.md` (§ Interface Change Impact Analysis)
- `docs/design/rating-system-frontend-design.md` (§ Data-Fetching Plan — `/exams`, `/exams/[id]`)
- `SOURCE/tests/e2e/fixture/rating.fixture.e2e.test.ts` (Test FE2 skeleton block)

## Change Category
`Change Category: boundary-change, bug-fix`

`ExamCard`/`ExamBrowser`/`ExamFilters` public prop contracts change (boundary-change per the frontend DD's Interface Change Impact Analysis), and the current Hardest control is a documented no-op that must actually reorder now (bug-fix regression guard). Sweep: the existing `newest`/`oldest` quick-sorts and the `subject`/`grade`/`school`/`schoolYear`/`semester` filter rows must remain unaffected by the `sort`/`level` additions; `ExamCard`'s pre-approved hover-shadow exception is kept as-is (do not touch it while restructuring).

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/rating-system-frontend-design.md (§ Acceptance Criteria — Community-difficulty display) | derived-display | "`DifficultyBadge` shall render `` `${bucket} · ${formatMean(mean)}` `` (e.g. `Hard · 7.2`, `Medium · 4.0`, `Hard · 10.0`)" | `DifficultyBadge` renders exactly `` `${bucket} · ${formatMean(mean)}` `` for non-null `communityDifficulty` |
| docs/design/rating-system-frontend-design.md (§ Acceptance Criteria — Community-difficulty display) | state-lifecycle-negative | "While `communityDifficulty` is `null` (or the field is missing), `DifficultyBadge` shall render literal `—` (fail-safe, no crash)." | `DifficultyBadge` renders literal `—` when `communityDifficulty` is `null` or missing, without throwing |
| docs/design/rating-system-frontend-design.md (§ Acceptance Criteria — Rate button) | derived-display | "the `RateButton` shall render a focusable `aria-disabled=\"true\"` control ... exposes the reason `Finish this exam first` to AT via `aria-describedby`" (not-attempted); "`Log in to rate`" (logged-out) | `RateButton` renders a focusable `aria-disabled="true"` control exposing `Finish this exam first` (not-attempted) or `Log in to rate` (logged-out) via `aria-describedby` |

## Investigation Notes
(Record the stretched-link Early Verification Point pass/fail result here — including whether the `after:inset-0` fallback was needed — before marking complete.)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Sweep the adjacent cases per Change Category: confirm the current `newest`/`oldest`/subject/grade/school/year/semester filter behavior as a baseline before touching `ExamFilters.tsx`/`exams/page.tsx`
- [ ] Review dependency deliverables: Task 4's `Exam.communityDifficulty`/`ExamSort`/`ExamFilters` shapes and `listMySubmittedExamIds()` signature
- [ ] Convert Test FE2's skeleton comments into a real Playwright script against fixture-driven `listExams`/`listMySubmittedExamIds`/`getCurrentUser`; write `DifficultyBadge.test.tsx` first; run and confirm failure

### 2. Green Phase
- [ ] Add the minimal `DifficultyBadge`/`RateButton`/`ExamCard`/`ExamBrowser`/`ExamFilters`/`exams/page.tsx`/`exams/[id]/page.tsx` changes to pass the added tests
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Improve code (maintain passing tests)
- [ ] Confirm added tests still pass

## Quality Assurance Mechanisms
- Vitest (jsdom, `// @vitest-environment jsdom`) — Enforces: component render/keyboard/ARIA correctness — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/components/rating/DifficultyBadge.test.tsx`
- Playwright MCP / manual pass (no CI) — Covers: `RateButton`, `ExamCard` (stretched-link navigation) — Config: local `npm run dev` session
- axe a11y audit (manual, dev) — Covers: `RateButton` states, Level filter — executed at the Task 9-frontend QA gate
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: project root

## Operation Verification Methods
- **Verification method**: L1 functional check on `/exams` — click card body, click enabled/disabled `RateButton`, exercise Hardest/Level controls; fixture-e2e FE2 exercises the full wiring against fixture data.
- **Success criteria**: card body still navigates to detail, `RateButton` is an independent target, the three eligibility states resolve from one per-page submitted-id set (no N+1), `DifficultyBadge` shows `Bucket · mean` for ≥3-rating exams and `—` otherwise.
- **Failure response**: fall back to the UI-Spec `after:inset-0` + `relative z-10` layering before building the form shells (Task 7).
- **Verification level**: L1 (Functional Operation Verification — this task is the Early Verification Point).

## Proof Obligations
(Source: skeleton `rating.fixture.e2e.test.ts` Test FE2 proof obligations (a)-(d), plus Failure Mode Checklist entries `no-op`, `empty input`, `invalid option` mapped to this task.)
- **Claim**: clicking an `ExamCard`'s body (outside the `RateButton`) navigates to `/exams/[id]`; clicking an enabled `RateButton` navigates to `/exams/[id]/rate` independently; a disabled `RateButton` does not navigate and exposes its AT reason (AC-010/011/026, code:F1).
  - **Primary failure mode**: the stretched-link swallows `RateButton`'s independent click target (invalid interactive nesting regression), or clicking the card body no longer navigates.
  - **Boundary to exercise**: fixture-e2e — full-ui (mocked backend), real browser DOM and real Next.js client-side routing.
  - **State assertion**: before (on `/exams`) → action (click card body vs. `RateButton`) → after (URL is `/exams/[id]` or `/exams/[id]/rate` respectively, or unchanged for the disabled state).
  - **Mock boundary rationale**: backend reads (`listExams`/`listMySubmittedExamIds`/`getCurrentUser`) are fixture-driven; DOM/routing are real (not mocked).
  - **Residual**: real Supabase RLS enforcement of write eligibility is verified separately by Task 2's RLS suite, not by this fixture test.
- **Claim**: `DifficultyBadge` shows `"<Bucket> · <mean>"` for every fixture exam with ≥3 ratings and literal `"—"` for every exam with `<3` ratings, on both the `ExamCard` Level cell and the exam-detail Difficulty cell (AC-014/015/016; merges the `empty input` failure mode for 0/1/2-rating fixtures).
  - **Primary failure mode**: a below-threshold exam renders a badge instead of `"—"`, or vice versa.
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: N/A (render check).
  - **Mock boundary rationale**: same as above.
  - **Residual**: the narrower jsdom coverage of `DifficultyBadge`'s pure render logic (`DifficultyBadge.test.tsx`) is a separate, more exhaustive proof than this fixture-e2e wiring pass.
- **Claim**: checking Hardest writes `?sort=hardest`, visually de-selects Newest/Oldest, and reorders the list so every below-threshold exam appears after every rated exam (AC-019/020; merges the `no-op` failure mode — Hardest was previously a no-op).
  - **Primary failure mode**: checking Hardest still combines with Newest/Oldest instead of replacing them (D002 regression), or a below-threshold exam is interleaved with rated exams instead of sinking to the bottom.
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: before (default sort order) → action (check Hardest) → after (URL has `?sort=hardest`, list order changes to rated-first).
  - **Mock boundary rationale**: same; real Postgres ordering correctness is proven by Task 1's spike and Task 9-backend's SE2, not here.
  - **Residual**: real DB ordering correctness is not proven by this fixture-driven test.
- **Claim**: selecting Level=Hard shows only fixture exams with ≥3 ratings whose community difficulty falls in the Hard bucket, excluding below-threshold and other-bucket exams (AC-017/021).
  - **Primary failure mode**: the Level filter includes a below-threshold or wrong-bucket exam.
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: before (unfiltered list) → action (select Level=Hard) → after (list contains only Hard-bucket ≥3-rating exams).
  - **Mock boundary rationale**: same.
  - **Residual**: none.
- **Claim** (invalid option failure mode): an unrecognized `?sort=` or `?level=` value is ignored and the page falls back to the default (no crash, no unintended filter) — Field Propagation Map: "unknown value → no sort" / "no Level filter applied".
  - **Primary failure mode**: an unrecognized query value is passed through to `listExams` uncoerced, causing a runtime error or an unintended filter/sort.
  - **Boundary to exercise**: integration/unit — `exams/page.tsx`'s searchParams-parsing logic.
  - **State assertion**: before (page loaded with `?sort=bogus`) → action (mount) → after (`listExams` called with `sort: undefined`, page renders without error).
  - **Mock boundary rationale**: fixture-driven backend.
  - **Residual**: none.

## Completion Criteria
- [ ] All added tests pass
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met
- [ ] Every Reference Contract Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] Phase 1 completion (this task closes Phase 1 alongside Task 4): Early Verification Point passed; Hardest/Level controls write the agreed URL params and the Server Component re-queries correctly (no combining Hardest with Newest/Oldest — D002 regression guard)

## Notes
- Impact scope: `SOURCE/components/rating/DifficultyBadge.tsx` (+test), `SOURCE/app/(layer2)/_components/rating/RateButton.tsx`, `ExamCard.tsx`, `ExamBrowser.tsx`, `ExamFilters.tsx`, `exams/page.tsx`, `exams/[id]/page.tsx`.
- Scope boundary: preserve `ExamCard`'s pre-approved hover-shadow exception unchanged; do not touch `CircleScale`/`RatingForm`/the rate route (Task 7) or the result-page modal (Task 8) in this task.
