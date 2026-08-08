# Task 10 (Backend): Mastery-write TS integration — `service-role.ts` + `submitExam()` + `recordSkillMastery.int.test.ts` (Work Plan Phase 3, Task 10)

Metadata:
- Dependencies: backend-task-01 (⚠ dev apply checkpoint must have passed — `record_skill_mastery()` must exist on dev), backend-task-09 (`computeWrongTwiceQuestionIds()`'s cross-attempt fixture-construction convention, for consistency of "a real submitted attempt" fixtures)
- Provides: real-DB-proven mastery write, closing the ADR-0011 trust-boundary loop opened in backend-task-01
- Size: Medium (3 files: `service-role.ts` extension, `actions.ts` extension, `recordSkillMastery.int.test.ts`)

## Implementation Content

Add `recordSkillMastery()` export to `SOURCE/lib/supabase/service-role.ts` (mirrors `recordExamResult()`'s shape — never throws, returns `{error}`). Insert a new, non-throwing step 7 into `submitExam()` (`SOURCE/app/(layer2)/actions.ts`) — called immediately after `recordExamResult()` succeeds, inside a `try/catch` that logs (`console.error`) and does **not** re-throw, positioned after the existing idempotency short-circuit.

**This is the one test file in this plan requiring a real dev Supabase instance.** Convert `recordSkillMastery.int.test.ts`'s 2 already-generated tests into real tests run against the **real dev Supabase instance** (backend-task-01's checkpoint must already be green):
- Test 1 (AC-009/010, arithmetic correctness — 2 tagged skills' `correct_count`/`total_count` exactly match a known fixture, the NULL-skill-tag question contributes 0 rows, `submitExam()` itself still succeeds)
- Test 2 (AC-011, negative proof — a real non-service-role student JWT calling `.rpc("record_skill_mastery", ...)` directly must fail permission-denied)

## Target Files
- [ ] `SOURCE/lib/supabase/service-role.ts` (additive — `recordSkillMastery()` export)
- [ ] `SOURCE/app/(layer2)/actions.ts` (additive — new non-throwing step 7 in `submitExam()`)
- [ ] `SOURCE/app/(layer2)/__tests__/recordSkillMastery.int.test.ts` (fill in the existing skeleton's 2 tests — requires real dev Supabase + `.env.local`)

## Investigation Targets
- `SOURCE/app/(layer2)/__tests__/recordSkillMastery.int.test.ts` (already generated — read in full: the LANE MAPPING NOTE explaining this is a real-DB test unlike its `.int.test.ts` siblings, the fixture id-prefix convention, both tests' exact annotations)
- `SOURCE/lib/supabase/service-role.ts` (`recordExamResult()`, lines ~56+ — the exact never-throws/`{error}`-return shape to mirror)
- `SOURCE/app/(layer2)/actions.ts` (`submitExam()`, lines 54-165, specifically the `recordExamResult()` call and its error handling at lines ~158-162, and the redirect at line 164 — step 7 goes between these two)
- `SOURCE/supabase/test-rls.ts` (fixture id-prefix + `setupXFixtures`/`cleanupXFixtures` pattern — this test's own fixture convention, e.g. `"mastery-int-"` prefix, mirrors this)
- `SOURCE/supabase/schema.sql` (§18 — the exact `record_skill_mastery()` function this integration test proves end-to-end)
- `docs/design/engine1-adaptive-ai-backend-design.md` (§ `lib/supabase/service-role.ts` + `submitExam()` integration — connection-switching; § Security Considerations; § State Transitions and Invariants; § Minimal Surface Alternatives Element 3)
- `docs/adr/ADR-0011-mastery-write-trust-boundary.md` (§ Decision — dependency_direction/contract_schema; § Implementation Guidance — data_flow)

## Change Category

`Change Category: state-change, boundary-change`

This task writes new persisted state (`user_skill_mastery`) from an existing, already-shipped Server Action (`submitExam()`), and extends that action's trust-boundary surface (a second, independent RPC call after the score write). Sweep required: confirm `submitExam()`'s pre-existing error paths (steps 1-6) are completely unaffected by the new step 7 — in particular, the existing idempotency short-circuit (line ~82-84, "Đã nộp rồi") and the `qRows` empty-result short-circuit (line ~113-115) must still redirect exactly as before, never reaching step 7 in those branches; and confirm no other caller of `recordExamResult()`'s sibling functions in `service-role.ts` needs an analogous non-throwing wrapper for consistency.

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0011-mastery-write-trust-boundary.md (§ Decision) | dependency_direction | `record_skill_mastery()` is separate from `record_exam_result()`, `INVOKER`, `service_role`-only, called as a second, independent, best-effort step from `submitExam()` after the score write already succeeded — never atomic with the score write | Is `recordSkillMastery()` called from `submitExam()` as a separate `try/catch` step AFTER `recordExamResult()`'s own error handling completes, with no shared transaction (Y/N)? |
| docs/adr/ADR-0011-mastery-write-trust-boundary.md (§ Decision) | contract_schema | `user_id` is derived from the `exam_attempts` row (never a caller parameter); requires `status = 'submitted'` | Does `recordSkillMastery.int.test.ts`'s Test 1 prove the RPC call's `user_id` derivation end-to-end (no `p_user_id`-shaped parameter passed from the TS wrapper) (Y/N)? |
| docs/adr/ADR-0011-mastery-write-trust-boundary.md (§ Implementation Guidance) | data_flow | When a new write's failure must not affect an already-existing, higher-priority write's success, keep them as separate calls with independent error handling, not one transaction | Does step 7's `try/catch` swallow (log, not re-throw) any `recordSkillMastery()` failure, leaving `submitExam()`'s own success/redirect behavior unaffected (Y/N)? |

## Boundary Context (Connection Map)

**Boundary**: `submitExam()`/`recordSkillMastery()` (Next.js server, TS) → `record_skill_mastery()` (Postgres SQL function, via Supabase RPC). This task owns the **left-side / producer** owner (`SOURCE/lib/supabase/service-role.ts`) — the right-side consumer (`SOURCE/supabase/schema.sql` §18) was defined in backend-task-01.

- **Serialized Format**: JSON array `p_per_question`, each element `{questionId, selected?, correct?, isCorrect, scored?}` — the exact `ScoreResult.perQuestion` object, unmodified.
- **Consumer Parse Rule**: SQL `jsonb_array_elements(p_per_question) as pq`, fields via `pq->>'questionId'` / `(pq->>'isCorrect')::boolean` / `coalesce((pq->>'scored')::boolean, true)`.
- **Roundtrip check this task must satisfy**: `recordSkillMastery()`'s TS wrapper must pass `ScoreResult.perQuestion` through **unmodified** (no re-shaping, no field renaming) as `p_per_question` — any transformation here would desync from backend-task-01's SQL parse rule even if both sides "look right" independently. Proven end-to-end by this task's own `recordSkillMastery.int.test.ts` Test 1 (real Postgres write + read-back).
- **Expected Signal**: resulting `user_skill_mastery` rows arithmetically match the attempt's per-question correctness for tagged/scored questions; untagged/unscored questions contribute nothing (AC-009/010).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Confirm backend-task-01's checkpoint is green on dev (this test file requires the real `record_skill_mastery()` function to exist).
- [ ] Read all Investigation Targets, in particular `recordSkillMastery.int.test.ts`'s LANE MAPPING NOTE and both tests' full annotations.
- [ ] Sweep the adjacent cases per Change Category above; record findings in Investigation Notes.
- [ ] Convert the 2 skeleton tests into real tests against the real dev Supabase instance, following `test-rls.ts`'s fixture-prefix pattern for isolated setup/cleanup.
- [ ] Run the tests and confirm both fail (no `recordSkillMastery()` TS export or step-7 wiring exists yet).

### 2. Green Phase
- [ ] Implement `recordSkillMastery()` in `service-role.ts`, mirroring `recordExamResult()`'s never-throws/`{error}`-return shape, passing `p_per_question` unmodified.
- [ ] Insert step 7 into `submitExam()`: call `recordSkillMastery()` in a `try/catch` immediately after the existing `recordExamResult()` error-handling block (after line ~162), before the final redirect (line ~164); on failure, `console.error` with context, do not re-throw.
- [ ] Run `recordSkillMastery.int.test.ts` against real dev Postgres — confirm both tests pass.

### 3. Refactor Phase
- [ ] Re-run `submitExam.int.test.ts` (the existing, unrelated test file for this same function) to confirm no regression to steps 1-6's pre-existing behavior.

## Quality Assurance Mechanisms
- ESLint / `tsc --noEmit` / `next build` — project-wide
- `vitest run` — Covered: `app/(layer2)/__tests__/` (note: `recordSkillMastery.int.test.ts` requires the live dev DB and is run explicitly as part of this task, not the generic CI-blocking `vitest run` staged gate)

## Operation Verification Methods
- **Verification method**: run `recordSkillMastery.int.test.ts` against the real dev Supabase instance; separately, exercise `submitExam()`'s pre-existing test suite (`submitExam.int.test.ts`) to confirm no regression.
- **Success criteria**: mastery-write integration verified end-to-end against real dev Postgres (both tests green); a forged student-JWT call to `record_skill_mastery()` is denied — Phase 3 Completion Criteria.
- **Failure response**: if Test 1's arithmetic assertions fail, treat as a SQL-side (backend-task-01) or TS-side (this task's unmodified-passthrough) mismatch — do not adjust the test's independently-computed expected values to match whatever the code currently produces. If Test 2 (the negative proof) unexpectedly succeeds, treat as a live security regression and escalate immediately — mirrors backend-task-02's `MM-b` case, do not proceed further until resolved.
- **Verification level**: L1 (functional — a real `submitExam()` call against real dev Postgres, the actual production code path) as the target, since this is explicitly the service-integration-e2e lane this project's own convention maps onto.

## Proof Obligations
(Sourced verbatim from `recordSkillMastery.int.test.ts`'s own annotations.)
- **Claim**: Test 1 — after a real `submitExam()` call, `user_skill_mastery` rows arithmetically match the submitted attempt's per-question correctness for tagged/scored questions; the NULL-skill-tag question contributes 0 rows; `submitExam()` itself still succeeds (AC-009/010).
- **Primary failure mode**: the SQL function's WHERE/JOIN silently drops or double-counts a row (e.g. the `coalesce((pq->>'scored')::boolean, true)` default inverted); OR the NULL-`skill_node_id` question is not filtered out by the INNER JOIN and produces a spurious mastery row; OR `on conflict ... do update` accumulation double-counts on a re-run.
- **Boundary to exercise**: full-system — real `submitExam()` → real `record_exam_result()` + real `record_skill_mastery()` → real Postgres `user_skill_mastery` table.
- **State assertion**: before = no `user_skill_mastery` rows for the fixture user/skill nodes; action = real `submitExam()` call with a seeded 4-question fixture (2 tagged to `sn-fixture-a`, one correct one incorrect; 1 tagged to `sn-fixture-b`, correct; 1 NULL-tagged, incorrect); after = `sn-fixture-a` row has `correct_count=1, total_count=2`; `sn-fixture-b` row has `correct_count=1, total_count=1`; total row count for this user across these fixture skill nodes equals exactly 2 (not 3); `submitExam()` itself resolves/redirects successfully.
- **Mock boundary rationale**: none — real Postgres required; `record_skill_mastery()`'s `GROUP BY`/`FILTER`/`ON CONFLICT`/FK-join correctness cannot be mocked (testing-principles, Data Layer Testing).
- **Residual**: none for this specific fixture; broader corpus-scale correctness is not re-proven here (that is backend-task-06's real-tagging-coverage concern, a separate claim).
- **Claim**: Test 2 — a real non-service-role student JWT calling `.rpc("record_skill_mastery", ...)` directly fails permission-denied (AC-011, trust boundary).
- **Primary failure mode**: the §18 revoke statement is missing, mistyped, or landed against a stale DB because the §17 fingerprint procedure wasn't followed after a manual apply — silently leaving the mastery write callable by any authenticated student's own JWT.
- **Boundary to exercise**: full-system — real Postgres function-level GRANT/REVOKE enforcement.
- **State assertion**: N/A (negative proof — the call must error, no state may change).
- **Mock boundary rationale**: none.
- **Residual**: complements backend-task-02's `MM-a`/`MM-b` table-level RLS proof, which does not cover this function-level EXECUTE-grant boundary specifically.
- **Claim** (Failure Mode Checklist `same-value`) — re-submitting/retrying `submitExam()` accumulates counts via `on conflict ... do update`, never overwrites.
- **Primary failure mode**: a retry of the same submission (or a duplicate step-7 call) resets `total_count`/`correct_count` instead of incrementing them.
- **Boundary to exercise**: full-system, real Postgres.
- **State assertion**: before = an existing mastery row from a prior submission; action = a second `submitExam()`-triggered mastery write touching the same skill node; after = counts are additively accumulated, not reset.
- **Mock boundary rationale**: none.
- **Residual**: exercised implicitly by this task's own re-run discipline; not a separately named test in the skeleton, but covered by the `on conflict ... do update` clause's own correctness, which Test 1's arithmetic assertion depends on.
- **Claim** (Failure Mode Checklist `no-op`) — a `p_per_question` row whose question has no skill tag contributes nothing — a deliberate no-op, not an error.
- **Primary failure mode**: an untagged question causes `record_skill_mastery()` to throw (breaking `submitExam()`'s step 7, though non-throwing at the TS level would mask it) instead of being silently excluded by the JOIN.
- **Boundary to exercise**: full-system, real Postgres — same fixture as Test 1's NULL-tagged question.
- **State assertion**: covered by Test 1's own assertion (c): total row count equals exactly 2, not 3.
- **Mock boundary rationale**: none.
- **Residual**: none.
- **Claim** (Failure Mode Checklist `shared-state dependency`) — the mastery aggregate accumulates across multiple submissions of possibly-overlapping skill nodes.
- **Primary failure mode**: a second submission touching an already-mastered skill node overwrites rather than accumulates the existing counters.
- **Boundary to exercise**: full-system, real Postgres.
- **State assertion**: same as the `same-value` claim above.
- **Mock boundary rationale**: none.
- **Residual**: none.
- **Claim** (Failure Mode Checklist `rollback-only visibility`) — ADR-0011's accepted narrow-window inconsistency: a crash between `recordExamResult()` and `recordSkillMastery()` leaves a scored attempt with no mastery update — accepted, not self-healing on retry; the score write itself is never rolled back.
- **Primary failure mode**: N/A as a "bug" — this is an accepted residual risk, not a defect to fix. The proof obligation here is documentation, not remediation: confirm the non-throwing `try/catch` wrapping (step 7) is the only mechanism, and no compensating transaction/rollback of the score write is (or should be) attempted.
- **Boundary to exercise**: code inspection of the `try/catch` structure, not a runtime test.
- **State assertion**: N/A.
- **Mock boundary rationale**: N/A.
- **Residual**: this is the plan's own accepted residual — not resolved further by this task, only confirmed to be implemented as designed (independent calls, no shared transaction, per the Binding Decisions table above).

## Completion Criteria
- [ ] `recordSkillMastery()` exported from `service-role.ts`; step 7 wired into `submitExam()`
- [ ] `recordSkillMastery.int.test.ts` Tests 1-2 pass against real dev Postgres
- [ ] Each Binding Decision's Compliance Check evaluates to `Y`, evidence recorded in Investigation Notes
- [ ] `submitExam.int.test.ts` (pre-existing) re-run with no regression
- [ ] Each Proof Obligation is met

## Notes
- Impact scope: `SOURCE/lib/supabase/service-role.ts` (additive export), `SOURCE/app/(layer2)/actions.ts` (additive step 7 only, lines ~162-164 insertion point).
- Scope boundary: do not modify `recordExamResult()` itself or `submitExam()`'s steps 1-6; do not touch `record_skill_mastery()`'s SQL definition here (backend-task-01, read-only dependency).
