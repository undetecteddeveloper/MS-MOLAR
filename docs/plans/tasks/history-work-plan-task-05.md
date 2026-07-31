# Task 05: `test-rls.ts` Case H-a + Real-Postgres Walkthrough (Work Plan Phase 1, Task 1.4) — REQUIRED, BLOCKING

Metadata:
- Dependencies: history-work-plan-task-03 (Deliverable: `SOURCE/app/(HM)/queries.ts` — validates the same query shape against real Postgres)
- Provides: real-Postgres proof of the Exams-Visibility Edge Case omission (R-1), required before Phase 1 is considered done
- Size: Small (1 file)

## Implementation Content

**Required, blocking**: fill in and run `SOURCE/supabase/test-rls.ts` case H-a (skeleton comment block, lines ~733-801 — needs `setupHistoryFixtures`/`cleanupHistoryFixtures` mirroring the existing Rating fixture pattern, plus the seed/action/assert steps described). Also perform the required manual real-Postgres walkthrough (Integration Verification Points): as a seeded user who is both author and attempter of an exam, attempt+score it, revert its `status` away from `'published'` via the SQL Editor, confirm the History row disappears from `listMyHistory()`'s output AND `getResult()`/`getExam()` also return `null`/404 for that same attempt.

This is the **only** proof that `exams_select_visible` RLS plus the explicit `.eq("status","published")` filter behave as assumed on real Postgres — Task 03's mocked test proves JS-assembly/omit-logic only, never real RLS.

## Target Files
- [x] `SOURCE/supabase/test-rls.ts` (extend — case H-a, lines ~733-801)

## Investigation Targets
- `SOURCE/supabase/test-rls.ts` (the full case H-a skeleton comment block, lines ~732-801, plus the existing `setupRatingFixtures`/`cleanupRatingFixtures` pattern earlier in the file — lines ~1-100 and wherever those functions are defined — as the structural template for `setupHistoryFixtures`/`cleanupHistoryFixtures`)
- `SOURCE/supabase/schema.sql` (lines 99-127, 160-170, 201-207, 263-268 — `exam_attempts`/`exam_results`/`exams` tables + `attempts_select_own`/`results_select_own`/`exams_select_visible` RLS policies)
- `SOURCE/app/(HM)/queries.ts` (Task 03's implementation — the exact exam-title lookup shape this case must reproduce: `.from("exams").select("id, title").in("id", examIds).eq("status", "published")`)
- `docs/design/history-backend-design.md` (§ Exams-Visibility Edge Case — Explicit Decision, all 5 rationale points, especially point 5's self-authored-exam asymmetry argument; § Test Boundaries — RLS suite; § Integration Verification Points; § Risks and Mitigation — R-1)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/history-backend-design.md` (§ Exams-Visibility Edge Case — Explicit Decision) | state-lifecycle-negative | `"Decision: omit the row silently... A row whose exam_id has no matching title in that lookup is dropped from the returned array entirely; no placeholder title, no partial row."` | Does `userA.from("exams").select("id").in("id",[examId]).eq("status","published")` resolve to `data.length === 0` after the author reverts status away from `'published'`, on real Postgres? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, in particular the existing Rating fixture setup/cleanup pair's exact shape (function signatures, use of `admin`/service-role client for seeding, idempotent cleanup called both before and after).
- [x] Sweep the adjacent case: this is the same RLS boundary (`exams_select_visible` + `.eq("status","published")`) that `getResult()`/`getExam()` already depend on for the single-attempt case — confirm case H-a's assertion is symmetric with that existing, already-relied-upon behavior (not a new invariant).
- [x] Write case H-a's setup (seed a fixture exam authored-and-attempted by the same `userA`, with a matching `exam_results` row) + action (service-role update of `status` away from `'published'`) + assertion, per the skeleton's Setup/Action/Expected-result blocks.
- [x] Run `cd SOURCE && npx tsx supabase/test-rls.ts` and confirm case H-a fails before the fixtures/assertion are correctly wired (or confirm the assertion is exercising a genuine pre-existing gap, not a typo in the test itself).

### 2. Green Phase
- [x] Complete `setupHistoryFixtures`/`cleanupHistoryFixtures` and the case H-a assertion so it passes against the real local Postgres instance.
- [x] Run only case H-a (or the full suite) and confirm it passes.

### 3. Refactor Phase
- [x] Confirm cleanup is idempotent (safe to re-run) — mirroring `cleanupRatingFixtures`'s convention.
- [x] Confirm the full suite (`cd SOURCE && npx tsx supabase/test-rls.ts`) still exits 0 including all pre-existing cases.

## Investigation Notes

**Investigation Targets read** (all, in full, before implementation):
- `SOURCE/supabase/test-rls.ts` — case H-a's skeleton comment block (lines ~733-801, pre-implementation) documented Setup/Action/Expected-result/Pass-criteria exactly as summarized in the task's own Implementation Content. `setupRatingFixtures(admin, authorId, raterId)`/`cleanupRatingFixtures(admin)` (lines 207-263, pre-implementation numbering) is the structural template: `cleanupX` deletes child rows before parent `exams` rows (idempotent, safe to call before AND after); `setupX` inserts `exams` rows via `admin` (service_role, bypasses RLS), then `exam_attempts` rows also via `admin`. Mirrored this shape for `setupHistoryFixtures`/`cleanupHistoryFixtures`, adding the one extra step Rating's fixtures don't need: inserting a matching `exam_results` row (via `.select("id").single()` on the `exam_attempts` insert to get the real `attempt_id`, since `exam_results.attempt_id` is a `not null unique` FK).
- `SOURCE/supabase/schema.sql` lines 99-127 (`exam_attempts`/`attempt_answers`/`exam_results` tables — confirmed `exam_results.attempt_id references exam_attempts(id) on delete cascade`, so `cleanupHistoryFixtures` only needs to delete `exam_attempts` then `exams`; `exam_results` cascades automatically) and lines 160-170/201-207/263-268 (`attempts_select_own`: `user_id = auth.uid()`; `results_select_own`: `user_id = auth.uid()`; `exams_select_visible`: `status = 'published' or author_id = auth.uid()`).
- `SOURCE/app/(HM)/queries.ts:54-58` — confirmed the exact query shape `listMyHistory()` step 3 uses: `.from("exams").select("id, title").in("id", examIds).eq("status", "published")`. Case H-a's assertion uses `.select("id")` (matching the Reference Contracts table's literal `Required Observable Value` text) rather than `.select("id, title")` — same filter/`.in()` shape, `id` alone is sufficient to prove the `data.length === 0` claim.
- `docs/design/history-backend-design.md` § Exams-Visibility Edge Case (line 203+), § Test Boundaries (line 663+), § Integration Verification Points (line 695+), § Risks and Mitigation R-1 (line 723+) — confirmed case H-a is the only real-Postgres proof for R-1's self-authored-exam-reverted scenario; rationale point 5 (cross-function symmetry with `getResult()`/`getExam()`) is the manual-walkthrough's closing argument.

**Adjacent-case / symmetry sweep**: `getResult()`/`getExam()` ((layer2)/queries.ts:181-191, 311-331) already depend on the identical `exams_select_visible` RLS + explicit `.eq("status","published")` filter — `getExam()` queries the `exams_with_difficulty` view (built directly on `public.exams`, same RLS) with `.eq("id",id).eq("status","published").maybeSingle()`, and `getResult()` calls `getExam(attempt.exam_id)` as its final gating step. Case H-a's assertion (on the base `exams` table, matching `listMyHistory()`'s exact shape) is not a new invariant — it proves the same mechanism `getResult()`/`getExam()` already rely on in production.

**Reference Contract Check** (pre-implementation and Exit Gate re-evaluation):

| Source | Required Observable Value | Planned/Actual Approach | Evaluation | Rationale |
|---|---|---|---|---|
| `docs/design/history-backend-design.md` § Exams-Visibility Edge Case — Explicit Decision | `"Decision: omit the row silently... A row whose exam_id has no matching title in that lookup is dropped from the returned array entirely; no placeholder title, no partial row."` | `setupHistoryFixtures` seeds a published exam authored+attempted+scored by `userA`; `admin` reverts `status` to `'draft'`; `userA.from("exams").select("id").in("id",[HISTORY_EXAM_ID]).eq("status","published")` is asserted to resolve `data.length === 0`. | Y | Executed against real Postgres (`cd SOURCE && npx tsx supabase/test-rls.ts`, twice) — assertion passed both runs: `data` resolved to `[]` (length 0), matching the decision's "omit silently" text exactly. A RED/GREEN differential probe (see Verification below) additionally confirmed the *same* query WITHOUT the explicit filter resolves 1 row (RLS's `OR author_id=auth.uid()` clause alone does NOT exclude it) — proving the explicit filter, not RLS alone, is what closes the gap, matching the Decision's stated mechanism. |

Result: **Y** — no escalation required.

**RED/GREEN differential verification** (Red Phase, "confirm the assertion is exercising a genuine pre-existing gap, not a typo"): ran a scratch probe (temp copy under `SOURCE/supabase/`, deleted immediately after — never committed) with the same fixture shape as `setupHistoryFixtures`, querying `userA.from("exams").select("id").in("id",[examId])` **without** the `.eq("status","published")` filter post-revert → resolved `[{"id":"rls-history-h-a-probe"}]` (1 row, RLS-alone insufficient — genuine gap confirmed), then the same query **with** the filter → resolved `[]` (0 rows, matches case H-a). Confirms case H-a's assertion exercises the real gap, not a test-authoring typo.

**Manual real-Postgres walkthrough** (Operation Verification Methods / Integration Verification Points): the browser-driven portion (log in via UI, attempt+score an exam, reload `/history`, hit the Result page URL directly) could **not** be performed in this session — no browser/UI-automation tool (e.g. Playwright MCP) was available among the tools provided for this task invocation. As a partial substitute, ran an additional scratch probe (temp copy under `SOURCE/supabase/`, deleted after — never committed) directly exercising `getExam()`'s exact query shape (`exams_with_difficulty` view, `.eq("id",id).eq("status","published").maybeSingle()`, (layer2)/queries.ts:183-188) and `getResult()`'s exact 3-step chain (exam_results → exam_attempts → `getExam()`, (layer2)/queries.ts:314-331) as `userA` against the real Postgres project, on a fixture identical in shape to case H-a's, after the same status-revert action: `exam_results`/`exam_attempts` steps resolved rows (RLS unaffected by exam status, as expected — `results_select_own`/`attempts_select_own` only check `user_id`), but the `getExam()`-shape step resolved `null`, so `getResult(attemptId)` would resolve `null` too — empirically confirming rationale point 5's cross-function symmetry claim at the real-Postgres/RLS layer, though this does not exercise the actual HTTP/Next.js routing/UI layer the full manual walkthrough calls for. **This checkbox in Completion Criteria is left unchecked** — the DB-layer proof is real (not fabricated) but is not the full manual walkthrough described in the task.

**Similar Function Duplication check** (Step 3): `setupHistoryFixtures`/`cleanupHistoryFixtures` share domain (exam/attempt/result fixture seeding), I/O pattern (admin client, void return), and placement (same file) with `setupRatingFixtures`/`cleanupRatingFixtures` and `setupUgcFixtures`/`cleanupUgcFixtures` — this is the intended, task-mandated mirroring pattern (task's own Implementation Content: "mirroring the existing Rating fixture pattern"), not an undisclosed duplication. No escalation.

**Core Mechanism Preservation**: the real-Postgres RLS + explicit-filter mechanism is preserved exactly — no mock substituted, no simplification of the assertion, no bypass of RLS (fixtures seeded via `admin`/service_role by design, matching every other fixture in this file; the assertion itself runs as `userA` via the anon-key signed-in client, RLS fully in effect).

## Quality Assurance Mechanisms
- RLS verification harness `test-rls.ts` — Enforces: real-Postgres RLS/aggregate behavior — Config: `SOURCE/supabase/test-rls.ts` — Covers: `exams_select_visible` RLS + explicit `.eq("status","published")` filter (case H-a, required blocking)

## Operation Verification Methods
- **Verification method**: run `cd SOURCE && npx tsx supabase/test-rls.ts` against real local Postgres; separately perform the manual walkthrough (attempt+score as own author, revert status via SQL Editor, reload `/history`/call `getResult()`/`getExam()` directly).
- **Success criteria**: case H-a's assertion (`data?.length === 0` for the reverted exam's title lookup) passes; the manual walkthrough confirms the History row disappears from `listMyHistory()`'s output AND `getResult()`/`getExam()` return `null`/404 for that same attempt.
- **Failure response**: if the reverted exam's title still resolves (i.e., `exams_select_visible`'s `OR author_id=auth.uid()` clause alone is what's governing, not the explicit filter), the omission rule is not actually enforced as designed — stop and re-inspect `listMyHistory()`'s exam-title lookup query for a missing `.eq("status","published")` filter before considering Phase 1 done.
- **Verification level**: L1 (real-Postgres functional proof) — this is explicitly required, blocking; not satisfiable by L2 (mocked tests) alone per the backend DD's own Test Boundaries.

## Proof Obligations
- **Claim**: R-1 / Exams-Visibility Edge Case (real-Postgres half) / Failure Mode `shared-state dependency` + `rollback-only visibility` — after the exam's author reverts its `status` away from `'published'`, a query run as that same author/attempter no longer resolves that exam's title, proving the omission is RLS+filter-driven, not application-code-driven.
  - **Primary failure mode**: the self-authored, later-unpublished exam still resolves a title at the lookup step (i.e., `exams_select_visible`'s `OR author_id=auth.uid()` clause keeps it "visible" despite the explicit `.eq("status","published")` filter failing to close that gap) — meaning the History row would NOT actually disappear in production, contradicting the documented decision and breaking symmetry with `getResult()`/`getExam()`'s already-shipped published-only rule.
  - **Boundary to exercise**: integration (real Postgres, real RLS, service-role seeding + anon-key querying as the actual author/attempter) — this is the only boundary that can prove this claim; Task 03's mock explicitly cannot.
  - **State assertion**: before — exam `status='published'`, authored and attempted by `userA`, 1 submitted+scored attempt exists; action — service-role updates `status` to `'draft'`; after — `userA.from("exams").select("id").in("id",[examId]).eq("status","published")` resolves to `data.length === 0`.
  - **Mock boundary rationale**: none — real Postgres end-to-end, by design (this is precisely the boundary a mock cannot prove).
  - **Residual**: none for the RLS-omission claim itself; the manual walkthrough additionally confirms `getResult()`/`getExam()` agree, closing the cross-function symmetry argument (rationale point 5) empirically, not just by code inspection.
- **Claim**: Failure Mode `unavailable boundary` (Work Plan Failure Mode Checklist maps this category to Phase 1 Task 1.2/1.4 jointly) — once the exam becomes unavailable (unpublished), both `listMyHistory()`'s title lookup AND `getResult()`/`getExam()` treat it as unavailable consistently, rather than one surface still exposing it.
  - **Primary failure mode**: the two reads disagree on availability — one still resolves the exam's data while the other correctly reports it unavailable — meaning the "unavailable boundary" is not treated consistently across both surfaces.
  - **Boundary to exercise**: integration (real Postgres) — the manual walkthrough's step 4 (`getResult()`/`getExam()` return `null`/404) is this claim's evidence, complementing Task 03's own throw-on-infrastructure-error proof of the same failure-mode category for the JS-assembly half.
  - **State assertion**: covered by the same before/action/after triple as the primary claim above, with the additional check that `getResult(attemptId)`/`getExam(examId)` both return `null` for the same reverted exam.
  - **Mock boundary rationale**: none — real Postgres.
  - **Residual**: none — this closes the cross-function agreement half that Task 03's mock cannot reach.

## Completion Criteria
- [x] Case H-a code written per the skeleton's Setup/Action/Expected-result blocks (Implementation)
- [x] `cd SOURCE && npx tsx supabase/test-rls.ts` exits 0 — all assertions pass, including H-a (Quality)
- [ ] Manual walkthrough performed at least once; both `listMyHistory()` and `getResult()`/`getExam()` confirmed to agree for the reverted exam (Integration) — **NOT performed**: no browser/UI-automation tool was available in this session. Substituted with a direct real-Postgres probe exercising `getExam()`'s/`getResult()`'s exact query shapes as `userA` post-revert (see Investigation Notes), which confirms the DB-layer symmetry claim but does not exercise the actual UI/HTTP path. Needs a follow-up session with browser access (or a human) to close this item.
- [x] Every Reference Contract Compliance Check evaluates to `Y` against the final implementation, with evidence recorded in Investigation Notes

## Notes
- Impact scope: `SOURCE/supabase/test-rls.ts` only (append case H-a + its fixture helpers).
- Scope boundary: this task must not modify any RLS policy or schema — it only proves existing policies behave as documented. **Required, blocking** — Phase 1 is not done until this task passes.
