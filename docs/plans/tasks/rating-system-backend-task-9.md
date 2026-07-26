# Task 9 (Backend): Final QA gate — backend (RLS regression, SE2, coverage, security review)

Metadata:
- Dependencies: `rating-system-backend-task-2.md` (RLS suite must be green), `rating-system-backend-task-4.md` (read-model wiring must be complete)
- Provides: the closing backend regression evidence; this is one half of the work plan's Task 9, split by layer per document-reviewer note I002 (the other half is `rating-system-frontend-task-9.md`)
- Size: Small (1 file to author: `SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts` (SE2 only — SE1 was already ported/deleted by Task 2); everything else in this task is verification, not new source)

## Implementation Content
Re-run the full RLS suite (`test-rls.ts`, including R-p..R-u) as a final regression. Author and execute service-integration-e2e Test SE2 (`rating.rls.service.e2e.test.ts` — SE1's block was already deleted by Task 2) against the real `exams_with_difficulty` view (or RPC): boundary buckets (3.9/4.0/6.9/7.0/1.0/10.0), tied-mean tie-break by `created_at`→`id`, Level=Hard exclusion of below-threshold/other-bucket rows, and the 2→3-rating flip (null → `{bucket,mean}` on the very next read, with no `exams` write / no trigger observed). Run full lint/typecheck/build/vitest (node) and check coverage on `SOURCE/lib/rating/**`. Perform the security review.

## Target Files
- [x] `SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts` (author the SE2 block as an executable test)
- [x] `SOURCE/supabase/test-rls.ts` (re-run only; fix in place only if a regression is found)

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
- [x] Read all Investigation Targets and record key observations
- [x] Review dependency deliverables: confirm Task 2's RLS suite and Task 4's read-model wiring are both complete before starting
- [x] Convert Test SE2's skeleton comments into real assertions against the live `exams_with_difficulty` view/RPC; seed the boundary-bucket and tied-mean fixtures specified in the skeleton; run and confirm failure (no assertions exist yet)

### 2. Green Phase
- [x] Confirm each SE2 assertion passes against the real database
- [x] Re-run `cd SOURCE && npx tsx supabase/test-rls.ts` (full suite) and confirm it is still green

### 3. Refactor Phase
- [x] Run project-wide lint/typecheck/build once
- [x] Run vitest (node) and check coverage on `SOURCE/lib/rating/**`
- [x] Perform the security review (see Completion Criteria)

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
- [x] All added tests pass (SE2), and the full RLS suite (incl. R-p..R-u) is re-confirmed green
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Security review complete: RLS AND-clauses (`user_id` + published + submitted-attempt) verified on both insert-own and update-own; `rateExam` never leaks raw DB errors; `user_id` never taken from input
- [x] Quality checks (types, lint, format) — zero errors (in rating-system scope; see Investigation Notes for pre-existing, unrelated project-wide gaps found and left untouched)
- [x] Coverage 70%+ on `SOURCE/lib/rating/**` (100% stmts/branch/func/line)
- [x] Document updates: none required beyond this plan (both Design Docs already reflect the shipped contracts)

## Notes
- Impact scope: `SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts` (SE2 authoring only). No production source changes are expected from this task; if the RLS regression or SE2 finds a defect, the fix belongs in the owning task's files (Task 1/2/4), not patched ad hoc here.
- Scope boundary: the frontend-owned axe a11y audit and frontend AC review are `rating-system-frontend-task-9.md`'s scope, not this task's.

## Investigation Notes

**Investigation Targets read**: `rating.rls.service.e2e.test.ts` SE2 skeleton (case list + proof obligations a-d); backend DD `§ Integration Verification Points`, `§ Verification Strategy`, `§ Security Considerations`; PRD success metrics 1/2/4/5/6/7; `schema.sql` final applied state (ratings table :471-481, RLS :497-540, view :548-560+); `lib/rating/` + its `__tests__/` (Task 3/7 output). Dependencies confirmed complete: Task 2's RLS suite (R-p..R-u already in `test-rls.ts`) and Task 4's read-model wiring (`queries.ts` `listExams`/`getExam`/`toExam` reading the view) both present and green before starting.

**SE2 authored** (`SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts`): a standalone `tsx`-run script (same pattern as `test-rls.ts`; NOT vitest-collected — `vitest.config.ts` only includes `lib/**`/`components/**`/`app/**`). Seeds 11 fixture exams via service-role (bypassing RLS — the write-path RLS is already proven by `test-rls.ts` R-p..R-u; SE2's scope is the read/aggregate side only, which mocks cannot prove):
- 0/1/2-rating below-threshold fixtures (`se2-null-a`/`se2-null-b` sharing one `created_at` for an id-tie-break proof; `se2-flip` with a distinct `created_at`, used for the 2→3 flip proof).
- Six boundary-bucket fixtures with exact `avg_overall` — 1.0 (Easy min), 3.9 (Easy, near-Medium), 4.0 (Medium min), 6.9 (Medium, near-Hard), 7.0 (Hard min), 10.0 (Hard max). 4.0/7.0/10.0/1.0 use 3 raters with identical integer part-scores (trivially exact). 3.9 and 6.9 require exactly 10 raters each — solved `avg_overall = ΣpartSums/(3N) = k.9` and found the minimum integer N satisfying this is 10 (since `117N`/`207N` must be divisible by 10, and `gcd(117,10)=gcd(207,10)=1`) — implemented as 7 raters at one sum + 3 raters at a sum one lower, verified exact against the live DB (no floating tolerance needed, though the test uses a `1e-6` epsilon defensively).
- Two tied-mean fixtures (`se2-tie-a`/`se2-tie-b`, both avg 5.0, same `created_at`) for the tied-mean id-tie-break proof.
- Ran RED (no assertions) → wrote real assertions against the live `exams_with_difficulty` view via a signed-in reader client → GREEN: all four proof obligations (a)-(d) pass on the live DB (see run transcript below).
- Proof (d) "no trigger fires": PostgREST only exposes the `public` schema to this client (no `.env.local` direct Postgres connection string exists in this project), so a live `pg_trigger` catalog query is not reachable. Substituted static source evidence: grepping `schema.sql` for `trigger` (case-insensitive) finds exactly one trigger in the whole file — `on_auth_user_created` on `auth.users` (profile provisioning) — none on `exams` or `exam_difficulty_ratings`. Combined with the dynamic check that the `exams` base-table row (`select *`) is byte-identical before/after the 3rd-rating insert, this satisfies "no denormalized write / no trigger" (AC-022) to the extent this client can observe.

**Full regression run** — `cd SOURCE && npx tsx supabase/test-rls.ts`: all cases green, including R-p..R-u, both before and after the SE2 fixtures were added/removed (no interference — fixture id prefixes are disjoint, and SE2 cleans up its own rows/exams before and after).

**Quality checks** — scoped to the rating-system change area (project-wide `npx eslint .` / `npx tsc --noEmit` / `next build` / `npx vitest run` surface pre-existing, unrelated failures — documented below, left untouched per File Scope Constraint / scope boundary):
- `npx eslint "supabase/__tests__/rating.rls.service.e2e.test.ts" "supabase/test-rls.ts" "lib/rating/**/*.ts"` → zero errors/warnings.
- `npx tsc --noEmit` (after clearing a stale, gitignored `.next/` dev-cache artifact that had a corrupted mid-write `validator.ts`) → 2 pre-existing errors, both in the untracked, unrelated `app/(layer3)/_components/{BarChartCard,DonutChartCard}.tsx` (in-progress analytics-layer3 feature, missing `@/lib/fake-data/analytics` — not part of this task's scope, not caused by this task).
- `npx next build` → compiles successfully; the build's typecheck phase fails on the same pre-existing `app/(layer3)` gap above (unrelated feature, untracked in git).
- `npx vitest run` (full suite) → 232/237 tests pass; the 5 failures are all in the untracked `lib/scoring/__tests__/computeScore.test.ts` (unrelated, pre-existing, not part of the rating system). All rating-system test files (`rating.test.ts`, `ratingForm.test.ts`, `RatingForm.test.tsx`, `submitRating.test.ts`, `CircleScale.test.tsx`, etc.) pass.
- Coverage: `@vitest/coverage-v8` was not installed in this project; installed transiently via `npm install --no-save` (package.json/package-lock.json unmodified — confirmed via `git status`) to run `npx vitest run --coverage --coverage.include="lib/rating/**" lib/rating` → **100% statements/branches/functions/lines** on `SOURCE/lib/rating/**` (34/34 stmts, 21/21 branches, 11/11 funcs, 26/26 lines) — every exported function in `lib/rating/index.ts` already has direct literal-fixture test coverage (`rating.test.ts` + `ratingForm.test.ts`).

**Security review** (Completion Criteria):
- `ratings_insert_own` and `ratings_update_own` (`schema.sql:501-514`, `:519-534`) both AND three clauses: `user_id = auth.uid()`, a published-exam `EXISTS`, and a submitted-attempt `EXISTS` — verified by direct source read, and exercised end-to-end by `test-rls.ts` R-q (no attempt → blocked) and R-s (not published → blocked).
- `rateExam` (`(layer2)/actions.ts:145-185`): the upsert payload never includes `user_id` — the column defaults to `auth.uid()` (comment at :169 confirms this explicitly); on any DB/RLS error, `console.error` logs `error.code`/`error.message` server-side only, and the caller receives the discriminated `{ error: "server" }` — no raw error object, message, or code is returned to the client.
- Additional observation (not a new defect — already documented in the backend DD as accepted Risk R-3): the `exams_with_difficulty` view is intentionally definer-semantics and bypasses RLS on **both** `exam_difficulty_ratings` and `exams` — the only guard against leaking non-published exams through it is the explicit `.eq("status","published")` filter applied by the caller. Confirmed via repo-wide grep that the view has exactly two production readers (`listExams`/`getExam` in `queries.ts`), and both apply that filter (`queries.ts:90`, `:168-169`). No other code path reads the view. This remains a documented, accepted design trade-off, not a gap introduced by this task.

**Post-review fix (integration-test-reviewer)**: the reviewer flagged that `cleanupFixtures(admin)` in SE2 originally ran only once at the very end of `main()`, so a thrown error from setup or any of the four proof-obligation reads would bypass cleanup and leak live-DB `se2-*` rows (`main().catch()` only logs and exits). Fixed by extracting the fixture-dependent body into `runFixtureDependentChecks(admin, reader, raterIds, authorId)` and wrapping its call in `try { ... } finally { await cleanupFixtures(admin); }` inside `main()`, so cleanup runs on both the success and thrown-error paths. Verified with a temporary forced `throw` right after `setupExams` (reverted after verification): the script exited via `main().catch()` as expected, and a direct service-role query afterward confirmed zero residual `se2-*` rows in both `exams` and `exam_difficulty_ratings` — cleanup ran correctly on the thrown-error path. Re-ran the real SE2 script and the full RLS regression afterward; both still green. `test-rls.ts` has the identical pre-existing gap (cleanup calls at the end, no try/finally) — left untouched per the reviewer's explicit note that it is out of this task's scope.

**Full RLS regression transcript** (final re-run, all green):
```
✓ R-p: User đủ điều kiện insert rating thành công (đúng 1 row, đúng điểm)
✓ R-q: User KHÔNG có submitted attempt → insert rating bị chặn (0 row)
✓ R-r: Rate lại (upsert) → vẫn đúng 1 row, điểm là điểm mới nhất
✓ R-s: Đề CHƯA published → write rating bị chặn dù user đủ điều kiện khác (0 row)
✓ R-t: Raw duplicate INSERT bị chặn bởi unique(exam_id, user_id) (23505), vẫn 1 row
✓ R-u: B KHÔNG đọc được rating của A (0 row); A đọc được rating của chính mình (1 row)
✅ RLS test: tất cả PASS.
```
