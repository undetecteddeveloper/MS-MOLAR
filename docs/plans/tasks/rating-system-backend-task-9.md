# Task 9 (Backend): Final QA gate — backend (RLS regression, SE2, coverage, security review)

Metadata:
- Dependencies: `rating-system-backend-task-2.md` (RLS suite must be green), `rating-system-backend-task-4.md` (read-model wiring must be complete)
- Provides: the closing backend regression evidence; this is one half of the work plan's Task 9, split by layer per document-reviewer note I002 (the other half is `rating-system-frontend-task-9.md`)
- Size: Small (1 file to author: `SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts` (SE2 only — SE1 was already ported/deleted by Task 2); everything else in this task is verification, not new source)

## Implementation Content
Re-run the full RLS suite (`test-rls.ts`, including R-p..R-u) as a final regression. Author and execute service-integration-e2e Test SE2 (`rating.rls.service.e2e.test.ts` — SE1's block was already deleted by Task 2) against the real `exams_with_difficulty` view (or RPC): boundary buckets (3.9/4.0/6.9/7.0/1.0/10.0), tied-mean tie-break by `created_at`→`id`, Level=Hard exclusion of below-threshold/other-bucket rows, and the 2→3-rating flip (null → `{bucket,mean}` on the very next read, with no `exams` write / no trigger observed). Run full lint/typecheck/build/vitest (node) and check coverage on `SOURCE/lib/rating/**`. Perform the security review.

## Target Files
- [ ] `SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts` (author the SE2 block as an executable test)
- [ ] `SOURCE/supabase/test-rls.ts` (re-run only; fix in place only if a regression is found)

## Investigation Targets
- `SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts` (Test SE2 skeleton — the exact case list and pass criteria)
- `docs/design/rating-system-backend-design.md` (§ Integration Verification Points)
- `docs/design/rating-system-backend-design.md` (§ Verification Strategy)
- `docs/design/rating-system-backend-design.md` (§ Security Considerations)
- `docs/prd/rating-system-prd.md` (Success metrics 1, 2, 4, 5, 6, 7 — the quantitative acceptance targets this gate certifies)
- `SOURCE/supabase/schema.sql` (Task 1's final applied state — the view/RPC and RLS under final regression)
- `SOURCE/lib/rating/` + `SOURCE/lib/rating/__tests__/` (Task 3's output — coverage subject)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Review dependency deliverables: confirm Task 2's RLS suite and Task 4's read-model wiring are both complete before starting
- [ ] Convert Test SE2's skeleton comments into real assertions against the live `exams_with_difficulty` view/RPC; seed the boundary-bucket and tied-mean fixtures specified in the skeleton; run and confirm failure (no assertions exist yet)

### 2. Green Phase
- [ ] Confirm each SE2 assertion passes against the real database
- [ ] Re-run `cd SOURCE && npx tsx supabase/test-rls.ts` (full suite) and confirm it is still green

### 3. Refactor Phase
- [ ] Run project-wide lint/typecheck/build once
- [ ] Run vitest (node) and check coverage on `SOURCE/lib/rating/**`
- [ ] Perform the security review (see Completion Criteria)

## Quality Assurance Mechanisms
- RLS verification harness `test-rls.ts` — Enforces: DB-level RLS/constraint behavior against real local Supabase — Config: `SOURCE/supabase/test-rls.ts`
- PostgREST capability spike (mechanism the SE2 regression re-exercises) — Covers: the `exams_with_difficulty` read path
- Vitest (node env) — Covers: `SOURCE/lib/rating/**` — coverage check
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: project root

## Operation Verification Methods
- **Verification method**: re-run `cd SOURCE && npx tsx supabase/test-rls.ts` (full suite incl. R-p..R-u) against real local Supabase; author and execute SE2 assertions (a)-(d) against the real `exams_with_difficulty` view/RPC; run project-wide lint/typecheck/build/vitest (node) and check coverage on `SOURCE/lib/rating/**`.
- **Success criteria**: all RLS cases pass; all four SE2 proof obligations pass; zero lint/typecheck/build errors; `SOURCE/lib/rating/**` coverage >= 70%.
- **Failure response**: any regression blocks release — fix the root cause (schema, RLS policy, or read-model wiring) in the owning task's files before sign-off; do not weaken assertions to pass.
- **Verification level**: L1 (the full service-integration-e2e suite is the closing regression gate, proving end-to-end functional correctness against the real DB).

## Proof Obligations
(Source: skeleton `rating.rls.service.e2e.test.ts` Test SE2 proof obligations (a)-(d); backend DD Verification Strategy correctness definition items 1-6; Failure Mode Checklist entry `missing-sort-key ordering`.)
- **Claim**: `rating_count`/`avg_overall` are exactly `null` for every seeded exam with `<3` ratings, and a correct `{bucket, mean}` for every exam with `>=3` ratings, including boundary fixtures 3.9/4.0, 6.9/7.0, 1.0, 10.0 (AC-014/018).
  - **Primary failure mode**: `avg_overall` is non-null below 3 ratings, or null at/above 3, breaking the "—" placeholder guarantee.
  - **Boundary to exercise**: service-integration-e2e — real local Supabase (Postgres view or RPC + PostgREST), no mocks.
  - **State assertion**: before (seeded fixture exams with 0/1/2/≥3 ratings incl. boundary means) → action (read `exams_with_difficulty` via the specified PostgREST chain) → after (aggregate values match expected per fixture).
  - **Mock boundary rationale**: none — real DB required.
  - **Residual**: none.
- **Claim** (missing-sort-key ordering): a single flat select using the Hardest order chain returns rated exams first (descending `avg_overall`), all below-threshold rows after them, and a repeated read yields an identical order — including a stable tie-break by `created_at` then `id` for tied-mean and below-threshold exams (AC-019/020, metric 6).
  - **Primary failure mode**: PostgREST does not honor `nullsFirst:false` plus the chained secondary order, so below-threshold exams do not sink deterministically last — the exact risk the phase-0 spike (Task 1) originally gated once.
  - **Boundary to exercise**: service-integration-e2e, real DB.
  - **State assertion**: before (seeded tied-mean + below-threshold fixtures) → action (repeated `.order()` reads) → after (identical deterministic order across repeated reads).
  - **Mock boundary rationale**: none.
  - **Residual**: none — this is the persistent regression guard for the risk the phase-0 spike originally gated once.
- **Claim**: a Level=Hard query returns only `>=3`-rating Hard-bucket rows, excluding below-threshold and other-bucket exams (AC-021).
  - **Primary failure mode**: the Level filter's `.gte`/`.lt` range admits a NULL (below-threshold) or wrong-bucket row.
  - **Boundary to exercise**: service-integration-e2e, real DB.
  - **State assertion**: before (mixed-bucket fixtures) → action (`.gte`/`.lt` Hard-bucket query) → after (only Hard-bucket `>=3`-rating rows returned).
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim**: after inserting a 3rd rating for a previously-2-rating exam, the very next read reflects the flip from `null` to `{bucket, mean}`, with no write observed on the `exams` table and no trigger firing (AC-022, metric 7).
  - **Primary failure mode**: any write lands on the `exams` table, or a trigger is found to fire.
  - **Boundary to exercise**: service-integration-e2e, real DB + schema/log inspection.
  - **State assertion**: before (exam with 2 ratings, `avg_overall` null) → action (insert 3rd rating) → after (next read returns `{bucket, mean}`; schema/log inspection confirms no `exams` UPDATE and no trigger definition).
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim**: the full RLS suite (`test-rls.ts`, including R-p..R-u) still passes as a final regression after every subsequent task (4, 5, 6, 7, 8) has landed.
  - **Primary failure mode**: a later task inadvertently altered schema/RLS-adjacent behavior, silently breaking a previously-green RLS case.
  - **Boundary to exercise**: service-integration-e2e, real local Supabase (`cd SOURCE && npx tsx supabase/test-rls.ts`).
  - **State assertion**: before (full suite state at Task 2 completion) → action (re-run after all subsequent tasks) → after (all cases still pass).
  - **Mock boundary rationale**: none.
  - **Residual**: none.

## Completion Criteria
- [ ] All added tests pass (SE2), and the full RLS suite (incl. R-p..R-u) is re-confirmed green
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met
- [ ] Security review complete: RLS AND-clauses (`user_id` + published + submitted-attempt) verified on both insert-own and update-own; `rateExam` never leaks raw DB errors; `user_id` never taken from input
- [ ] Quality checks (types, lint, format) — zero errors
- [ ] Coverage 70%+ on `SOURCE/lib/rating/**`
- [ ] Document updates: none required beyond this plan (both Design Docs already reflect the shipped contracts)

## Notes
- Impact scope: `SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts` (SE2 authoring only). No production source changes are expected from this task; if the RLS regression or SE2 finds a defect, the fix belongs in the owning task's files (Task 1/2/4), not patched ad hoc here.
- Scope boundary: the frontend-owned axe a11y audit and frontend AC review are `rating-system-frontend-task-9.md`'s scope, not this task's.
