# Task 2 (Backend): RLS write-eligibility test suite (test-rls.ts R-p..R-u)

Metadata:
- Dependencies: `rating-system-backend-task-1.md` — requires the applied `exam_difficulty_ratings` table + RLS policies
- Provides: the green RLS regression suite Task 9 (backend) re-runs as the final gate
- Size: Small (1-2 files: `SOURCE/supabase/test-rls.ts`, and deleting/reducing `SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts`'s SE1 block)

## Implementation Content
Extend `SOURCE/supabase/test-rls.ts` with cases R-p through R-u (mirroring the existing R-i/R-j/R-k reports cases): eligible insert succeeds; no-attempt insert rejected (0 rows); re-rate upserts in place (1 row, latest scores); non-published-exam write rejected; raw duplicate INSERT hits the unique-constraint violation; select-own confinement (user B cannot read user A's row). Run `cd SOURCE && npx tsx supabase/test-rls.ts`. This also satisfies service-integration-e2e Test SE1 — the skeleton file recommends appending directly to `test-rls.ts` rather than maintaining a separate file, so delete `SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts`'s SE1 block once ported (leave the SE2 block for Task 9-backend to author).

## Target Files
- [x] `SOURCE/supabase/test-rls.ts` (append cases R-p..R-u)
- [x] `SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts` (delete the SE1 block once its cases are ported into `test-rls.ts`)

## Investigation Targets
- `SOURCE/supabase/test-rls.ts:429-473` (R-i/R-j/R-k — the reports RLS cases this task's cases mirror; also the `ensureUser`/`signInAs` setup helpers)
- `SOURCE/supabase/schema.sql` (Task 1's output — the `ratings_insert_own`/`ratings_update_own`/`ratings_select_own` policies under test)
- `docs/design/rating-system-backend-design.md` (§ Test Boundaries / RLS suite — the exact R-p..R-u case table with pass criteria)
- `SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts` (Test SE1 skeleton — the block to port then delete)

## Investigation Notes
- `test-rls.ts:429-473` (R-i/R-j/R-k): setup seeds via `admin` (service_role, bypasses RLS) then exercises `userA`/`userB` (signed-in anon clients from `signInAs`); each case is a plain `assert(cond, msg)` call, `failures` counter drives the final `process.exit`. `ensureUser` creates/confirms a user via Admin API; `signInAs` returns an anon client already signed in — reused as-is for the new cases (no new helpers needed).
- `schema.sql:471-540` (Task 1's output, applied live): `exam_difficulty_ratings` has `unique(exam_id, user_id)` (schema.sql:480) plus a `[1,10]` CHECK per part (schema.sql:484-490). `ratings_insert_own`/`ratings_update_own` both AND 3 clauses — `user_id = auth.uid()`, published `EXISTS` on `exams`, submitted-attempt `EXISTS` on `exam_attempts` (cross-table, mirrors `answers_insert_own`'s pattern). `ratings_select_own` is a single `user_id = auth.uid()` predicate (schema.sql:539-540) — no author/admin carve-out. Confirmed matches the backend Design Doc's description exactly.
- `docs/design/rating-system-backend-design.md:747-758`: exact R-p..R-u case table (Case / Asserts / AC-metric) — cases and pass criteria copied verbatim into the new `test-rls.ts` block; `:46-84` (task file's own Proof Obligations, sourced from the skeleton (a)-(e) + derived (f) for R-u) drove the exact state-assertion shape (before/after row counts read via `admin`, not the client's return value alone) for each case.
- `rating.rls.service.e2e.test.ts` SE1 skeleton (`:20-66` pre-edit): proof obligations (a)-(e) map 1:1 to R-p/R-q/R-r/R-s/R-t; ported into the new cases' assertions (row-count/content checks via `admin` after each client action). SE1 block removed post-port per the file's own instruction ("if the implementer appends to test-rls.ts instead, delete this file [block] rather than double-asserting"); SE2 block (community-difficulty aggregate, out of this task's scope) left untouched.
- **Fixture design decision**: `test-rls.ts`'s existing UGC fixtures don't cover the rating eligibility axes (published + submitted-attempt), so added 3 new exam fixtures (`rls-rating-published`, `rls-rating-no-attempt`, `rls-rating-review`) + `setupRatingFixtures`/`cleanupRatingFixtures` mirroring `setupUgcFixtures`/`cleanupUgcFixtures`'s shape. Chose `userA` (already the author fixture) as the single "eligible user" across R-p/q/r/s/t so R-u's "B cannot read A's row / A reads own" wording (Design Doc R-u row + this task's Proof Obligation) holds literally without inventing a 3rd identity — the schema has no rule against self-rating (only published + submitted-attempt), so author-as-rater is a valid state.
- **Red-phase evidence deviation (documented, not escalated — tooling constraint, not a design deviation)**: this environment has no DDL/raw-SQL execution path against the live Supabase project available to this agent (no Supabase MCP function bound to this session, no `DATABASE_URL`/db password in `.env.local`, `supabase` CLI present but project unlinked) — so the task's illustrative Red-phase method ("temporarily comment out one AND-clause locally, apply, observe fail, restore") could not be run against the live schema literally. Instead ran an ad-hoc, non-committed script (`SOURCE/supabase/_red-phase-check.tmp.ts`, deleted after use) that used the already-available `service_role` client (bypasses RLS, not table constraints) to insert, per case, the exact row shape an ineligible write would have produced if the corresponding AND-clause were missing, then re-evaluated each case's own assertion expression against that state and confirmed it flips to `false` (RED), then deleted the row to restore. Results: R-q simulated-broken state → 1 row → assertion `(rows)===0` → `false` (RED, as expected); R-s same → `false` (RED); R-u differential → admin(bypassed) sees 1 row, B(RLS-scoped) sees 0 — the exact difference that would collapse to equal if `ratings_select_own` lost its `user_id = auth.uid()` predicate; R-t → even `service_role` cannot violate `unique(exam_id, user_id)` (still `23505`), directly confirming R-t's failure mode is a table constraint (schema.sql:480), not a policy, and is independent of role. R-p/R-r (positive controls) already ran against the live-applied, correct policies with real success — their "would fail if over-restrictive" direction is exercised by the live run itself (a missing/wrong AND-clause would have made the real `rp`/`rr` calls error, which they did not).

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations (the exact seed data shape `test-rls.ts` already uses for author A / non-author B / published / non-published exams)
- [x] Review dependency deliverables: confirm Task 1's schema is applied to the target Supabase project before writing cases
- [x] Write the R-p..R-u cases in `test-rls.ts` following its existing pattern
- [x] Run `cd SOURCE && npx tsx supabase/test-rls.ts` and confirm the new cases fail (or the harness errors) before any policy exists to satisfy them — if Task 1 already applied correct policies, confirm instead that a case would catch an intentionally broken policy (e.g., temporarily comment out one AND-clause locally, observe the case fail, then restore it) as the Red-phase evidence — see Investigation Notes ("Red-phase evidence deviation") for the tooling-constrained substitute actually run

### 2. Green Phase
- [x] Confirm all R-p..R-u cases pass against the real applied schema from Task 1
- [x] Port the skeleton's SE1 proof obligations into the new cases' assertions (see Proof Obligations below) and delete the SE1 block from `rating.rls.service.e2e.test.ts`

### 3. Refactor Phase
- [x] Confirm the new cases follow `test-rls.ts`'s existing style (assert-based script, service-role setup + signed-in anon clients per user)
- [x] Re-run the full suite (pre-existing cases + R-p..R-u) once more to confirm no regression

## Quality Assurance Mechanisms
- RLS verification harness `test-rls.ts` — Enforces: DB-level RLS/constraint behavior against real local Supabase — Config: `SOURCE/supabase/test-rls.ts`
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: project root

## Operation Verification Methods
- **Verification method**: run `cd SOURCE && npx tsx supabase/test-rls.ts` against real local Supabase after the R-p..R-u cases are appended, asserting row counts/content read directly from the database for each case (RLS cannot be validated by mocks).
- **Success criteria**: the script exits 0 with all R-p..R-u assertions passing — R-q/R-s assert 0 rows; R-r asserts exactly 1 row with the latest scores; R-t asserts a `23505` unique-violation; R-u asserts select-own confinement (0 rows cross-user, 1 row own).
- **Failure response**: a failing case indicates a missing or misconfigured AND-clause in the RLS policy — fix the policy in `schema.sql` (Task 1's output) and re-run before Task 4/6 proceeds.
- **Verification level**: L1 (functional operation verification — the DB-level security gate actually operates against a real database).

## Proof Obligations
(Source: skeleton `SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts` Test SE1 proof obligations (a)-(e), plus an additional obligation for R-u since the skeleton's SE1 mirrors only R-p..R-t.)
- **Claim**: an eligible user's insert succeeds — exactly 1 row exists for `(examId, userId)` with the submitted scores (AC-009; R-p).
  - **Primary failure mode**: a missed AND-clause rejects a legitimately eligible write.
  - **Boundary to exercise**: full-system — live local Supabase (Postgres + RLS), no mocks.
  - **State assertion**: before (0 rows for the pair) → action (eligible insert) → after (exactly 1 row, scores match submission).
  - **Mock boundary rationale**: none — RLS cannot be validated by mocks.
  - **Residual**: none.
- **Claim**: a user with no submitted attempt on the exam has their insert rejected — 0 rows exist for that `(examId, userId)` (AC-008, PRD metric 1; R-q).
  - **Primary failure mode**: a missed AND-clause (`user_id = auth.uid()` AND published `EXISTS` AND submitted-attempt `EXISTS`) lets an ineligible write persist, defeating PRD metric 1 (100% requirement).
  - **Boundary to exercise**: full-system, real Supabase RLS.
  - **State assertion**: before (0 rows) → action (ineligible insert attempt) → after (still 0 rows).
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim** (same-value failure mode): the same eligible user submits new scores a second time — exactly 1 row exists for `(examId, userId)`, and its scores equal only the latest submission, never the first (AC-012, PRD metric 2; R-r).
  - **Primary failure mode**: the update-own policy is missing/misconfigured, so a re-rate INSERTs a second row instead of upserting in place.
  - **Boundary to exercise**: full-system, real Supabase RLS.
  - **State assertion**: before (1 row, first scores) → action (re-rate with different scores) → after (still exactly 1 row, scores = latest only).
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim**: an otherwise-eligible user's write against a non-published exam is rejected (PRD Security; R-s).
  - **Primary failure mode**: the published-exam `EXISTS` clause is missing from one of the two write policies.
  - **Boundary to exercise**: full-system, real Supabase RLS.
  - **State assertion**: before (0 rows) → action (write attempt on non-published exam) → after (still 0 rows).
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim**: a raw duplicate INSERT (not upsert) for the same `(exam_id, user_id)` fails with a unique-constraint violation `23505` (PRD metric 2 uniqueness; R-t).
  - **Primary failure mode**: the `unique(exam_id, user_id)` constraint is absent so a raw duplicate INSERT succeeds.
  - **Boundary to exercise**: full-system, real Supabase.
  - **State assertion**: before (1 row) → action (raw duplicate INSERT) → after (still 1 row; the INSERT itself errors with `23505`).
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim**: select-own confinement — user B cannot read user A's rating row (0 rows), user A reads their own (1 row) (AC-013 confinement; R-u — not covered by the SE1 skeleton, derived from the backend DD's RLS suite table).
  - **Primary failure mode**: `ratings_select_own` is missing the `user_id = auth.uid()` predicate, leaking one user's individual scores to another.
  - **Boundary to exercise**: full-system, real Supabase RLS.
  - **State assertion**: before (user A has 1 row) → action (user B selects on user A's exam) → after (0 rows for B; 1 row when A selects their own).
  - **Mock boundary rationale**: none.
  - **Residual**: none.

## Completion Criteria
- [x] All added tests pass (`test-rls.ts` R-p..R-u, run against real local Supabase)
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met: every case turns red under its primary failure mode and exercises the real-DB boundary (no mocks)
- [x] `SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts`'s SE1 block is deleted (SE2 block left for Task 9-backend)
- [x] Phase 0 completion (shared with Task 1 and Task 3): `exam_difficulty_ratings` + `exams_with_difficulty` (or RPC) applied idempotently; RLS suite R-p..R-u green

## Notes
- Impact scope: `SOURCE/supabase/test-rls.ts` and the deletion of the SE1 block in the service-e2e skeleton file only.
- Scope boundary: do not modify `schema.sql` in this task — if a case fails, the fix belongs in Task 1's schema (escalate back rather than patching around a failing policy here).
