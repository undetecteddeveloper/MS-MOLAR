# Overall Design Document: Rating System (Exam Difficulty Rating)

Generation Date: 2026-07-24
Target Plan Document: `docs/plans/rating-system-work-plan.md`

## Project Overview

### Purpose and Goals
Implement the Exam Difficulty Rating feature end-to-end: let an eligible user (submitted attempt) rate an exam's three fixed parts (1-10 each), compute community difficulty on-read with an `N=3` threshold, and surface it via a real `Hardest` sort and `Level` filter — replacing the currently inert `"—"` placeholders and the no-op `?hardest=1` control.

### Background and Context
ADR-0008 locked the architecture: on-read aggregation via a NULL-below-threshold Postgres view (`exams_with_difficulty`, RPC fallback if the phase-0 spike fails), with rating-write eligibility enforced authoritatively at the RLS layer. Two Design Docs (backend v1.0, frontend v1.0) implement this exactly. The backend DD flags a **blocking phase-0 PostgREST spike** as the first task — the entire read mechanism is contingent on an unverified PostgREST capability. The frontend DD resolves D002 (a user-confirmed behavior change): the previously independent, no-op `?hardest=1` param is folded into the existing `?sort=` axis as a third mutually-exclusive value (`?sort=hardest`).

## Task Division Design

### Division Policy
The work plan's own Implementation Approach is **Horizontal slice (backend, foundation-driven)** gated by the phase-0 spike, followed by a **Hybrid (frontend, foundation primitives → vertical entry-point slices)**. Task decomposition follows the work plan's own 9-task breakdown 1:1 (no further splitting), because each task already sits at a single-commit, single-layer granularity per the plan's own Task Dependency Diagram. The one adjustment applied here (per document-reviewer note I002): **Task 9 (Final QA) is split into a backend QA task and a frontend QA task**, because its two halves (backend: re-run `test-rls.ts` + author/execute SE2 against `exams_with_difficulty`; frontend: axe audit on the rating form/RateButton/Level filter) target disjoint file sets and must route to different executors (task-executor vs task-executor-frontend).

Verifiability level distribution (L1/L2/L3 per implementation-approach skill):
- Task 1: L1 (the phase-0 spike is itself the Early Verification Point — a live functional-capability check)
- Task 2, 3, 4, 6: L2 (new tests added and passing — RLS suite, vitest fixtures, mocked-chain integration tests)
- Task 5: L1 (this task IS the frontend DD's Early Verification Point / the work plan's Second Verification Target)
- Task 7: L1 (rate end-to-end on the standalone route) backed by L2 (CircleScale/lib vitest)
- Task 8: L2 (mocked-router integration test) backed by fixture-e2e L1 evidence (FE1, run manually per the no-CI workflow)
- Task 9 (backend): L1 (full service-integration-e2e suite as the closing regression gate)
- Task 9 (frontend): L1 (axe + manual pass as the closing a11y/functional gate)

Per-layer naming applied throughout: `rating-system-backend-task-{n}.md` for tasks whose Target Files live under `SOURCE/supabase/**`, `SOURCE/app/(layer2)/queries.ts`, `SOURCE/app/(layer2)/actions.ts` (write-path additions), or `SOURCE/lib/rating/` (backend-DD-owned base helpers); `rating-system-frontend-task-{n}.md` for tasks whose Target Files live under `SOURCE/app/(layer2)/_components/**`, `SOURCE/app/(layer2)/exams/**page.tsx`, or `SOURCE/components/rating/**` (frontend-DD-owned display/interaction pieces).

### Inter-task Relationship Map
```
Task 1 (backend): Phase-0 spike + schema.sql (table+RLS+view) — BLOCKING
  |
  +--> Task 2 (backend): test-rls.ts R-p..R-u (depends on Task 1's schema)
  |
  +--> Task 4 (backend): queries.ts/types read-model wiring (depends on Task 1's view + Task 3's helpers)
  |       ^
  |       |
Task 3 (backend): lib/rating pure helpers (independent of Task 1; TDD'd first) --+
  |
  +--> Task 6 (backend): actions.ts rateExam/getMyRating (depends on Task 1's RLS + Task 3's isValidPartScore)

Task 4 --> Task 5 (frontend): ExamCard/ExamBrowser/ExamFilters/exams page wiring + DifficultyBadge/RateButton
                [Early Verification Point / Second Verification Target]

Task 6 --> Task 7 (frontend): CircleScale/RatingForm/RatePageShell/rate route (also depends on Task 3's lib/rating)
Task 3 --> Task 7

Task 6 --> Task 8 (frontend): RatingModal/RatingModalController/result-page mount/?rate=auto
Task 7 --> Task 8

Task 2 --> Task 9-backend: re-run full RLS suite + author/execute SE2
Task 5 --> Task 9-frontend: axe audit on RateButton/Level filter
Task 8 --> Task 9-frontend: axe audit on the rating form (modal + standalone)
```

### Interface Change Impact Analysis
| Existing Interface | New Interface | Conversion Required | Corresponding Task |
|-------------------|---------------|-------------------|-------------------|
| `listExams(filters)` reads `exams` | reads `exams_with_difficulty` (or RPC) | Yes — source relation swap + hardest/level branches | Task 4 (depends on Task 1) |
| `getExam(id)` reads `exams` | reads `exams_with_difficulty` (or RPC) | Yes — source relation swap | Task 4 |
| `ExamSort = 'newest'\|'oldest'` | `+= 'hardest'` | Yes — additive union | Task 4 (backend), Task 5 (frontend consumption) |
| `ExamFilters {..., sort}` | `+= level?` | Yes — new optional field | Task 4 (backend), Task 5 (frontend) |
| `ExamFilters.hardest?: boolean` | *(removed)* | Yes — D002 removal | Task 5 |
| `ExamCard(exam)` | `ExamCard(exam, eligibility)` | Yes — new required prop | Task 5 |
| — (none) | `rateExam(examId, scores)` | New | Task 6 |
| — (none) | `getMyRating(examId)` | New | Task 6 |
| — (none) | `listMySubmittedExamIds()` | New | Task 4 |
| `submitExam` fresh-submit redirect | `+= ?rate=auto` (line ~127 only) | Yes — narrow, single-line change | Task 8 |

### Common Processing Points
- `SOURCE/lib/rating/` is the single shared pure module: Task 3 creates the backend-owned base (`overall`/`bucket`/`communityDifficultyFrom`/`formatMean`/`isValidPartScore`/constants); Task 7 **adds to** the same directory (`readoutModel`/`PART_META`/`rateErrorMessage`/`mapFromMyRating`) rather than duplicating. Every consuming task (4, 6, 7) imports from here — no reimplementation.
- The `SOURCE/app/(layer2)/__tests__/rating.int.test.ts` skeleton is a **single file** whose three `Test N` blocks are converted by three different tasks (Test 2 by Task 4, Test 1 by Task 6, Test 3 by Task 8) — each task touches only its own block; do not restructure the shared file boundaries.
- The `SOURCE/tests/e2e/fixture/rating.fixture.e2e.test.ts` skeleton is similarly split: FE2 by Task 5, FE1 (reserved slot) by Task 8.
- **Known gap flagged for the executor**: `SOURCE/vitest.config.ts`'s `include` glob is `["lib/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}"]` — it does **not** currently collect `SOURCE/app/(layer2)/__tests__/**`. Task 4 (the first task to convert a block in `rating.int.test.ts`) must resolve this (extend the include glob, or confirm/introduce the project's actual mechanism for running app-layer integration tests) before its converted test can be asserted as passing under `npm test`. Tasks 6 and 8 depend on Task 4's resolution rather than re-deciding it.

## Implementation Considerations

### Principles to Maintain Throughout
1. Ordering/threshold/filtering stay DB-side (view or RPC) — never merge a per-exam aggregate in JS and sort/filter it client-side (ADR-0008 Implementation Guidance, binds Task 4).
2. RLS is the authoritative eligibility gate everywhere; every server-action-level precheck (Task 6) is UX ergonomics only, never a substitute (ADR-0008 Decision, binds Tasks 1 and 6).
3. `communityDifficulty` is rendered exactly as the server provides it — no client re-bucketing (frontend DD main_constraint, binds Task 5).
4. The `N=3` threshold is expressed in exactly two coordinated places (the view's SQL literal and `RATING_THRESHOLD`) and pinned together by a test, never a shared physical constant across the SQL/TS boundary (Tasks 1 and 3).

### Risks and Countermeasures
- Risk: PostgREST cannot express the required order/filter shape on a view column (ADR-0008 R-1).
  Countermeasure: Task 1's blocking spike with the ready RPC-fallback branch; escalate only if the RPC also fails.
- Risk: A missed RLS AND-clause lets an ineligible user persist a rating (PRD metric 1).
  Countermeasure: Task 2's R-p..R-u suite plus Task 9-backend's full-suite re-run as the closing regression gate.
- Risk: `ExamCard`'s stretched-link restructure regresses navigation or nests an interactive control invalidly.
  Countermeasure: Task 5 is itself the frontend DD's Early Verification Point, with the documented `after:inset-0` + `relative z-10` fallback.
- Risk: `?rate=auto` is not stripped on mount, causing the modal to re-pop on refresh (AC-005).
  Countermeasure: Task 8's proof obligations from both the integration skeleton (Test 3) and the reserved fixture-e2e slot (FE1) both assert the strip-on-mount idempotency.

### Impact Scope Management
- Allowed change scope: exactly the files listed in the work plan's Review Scope line (`schema.sql`, `test-rls.ts`, `queries.ts`, `actions.ts`, `types/exam.ts`, `lib/rating/**`, `components/rating/**`, `ExamCard`/`ExamBrowser`/`ExamFilters`, `_components/rating/**`, `exams/page.tsx`, `exams/[id]/page.tsx`, `exams/[id]/rate/page.tsx`, `result/page.tsx`, the three test-skeleton files).
- Preserved areas (explicitly Non-Scope per both Design Docs): `submitExam`/`startAttempt`/attempt/result tables and RLS beyond the read-only eligibility check; `exam_reports` and the Layer 4 UGC write path; `computeScore`/scoring; existing `newest`/`oldest` sorts and `subject`/`grade`/`school`/`schoolYear`/`semester` filters; `ExamCard`'s pre-approved hover-shadow exception; the idempotent already-submitted redirect at `actions.ts:50` (only the fresh-submit redirect at `:127` gets `?rate=auto`).

## Deviations From Default Skill Behavior
- **Phase Completion Task Auto-generation was intentionally skipped.** The work plan contains "Phase" notation (Phase 0-3 + Final Phase), which would normally trigger auto-generated `{plan-name}-phase{N}-completion.md` files per phase. The user's explicit task instructions bounded this decomposition to "~9-10 tasks total after the QA split" and asked for lean, concise task files — generating five additional phase-completion files would contradict that explicit scope constraint. Each phase's own "Phase Completion Criteria" from the work plan is instead folded into the Completion Criteria of that phase's own last task file (Task 2 closes Phase 0 alongside Task 3's own criteria — both Phase 0 tasks carry their share; Task 5 closes Phase 1; Task 7 closes Phase 2; Task 8 closes Phase 3).
