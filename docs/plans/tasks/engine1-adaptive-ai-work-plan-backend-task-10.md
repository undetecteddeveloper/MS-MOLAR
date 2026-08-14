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
- [x] `SOURCE/lib/supabase/service-role.ts` (additive — `recordSkillMastery()` export)
- [x] `SOURCE/app/(layer2)/actions.ts` (additive — new non-throwing step 7 in `submitExam()`)
- [x] `SOURCE/app/(layer2)/__tests__/recordSkillMastery.int.test.ts` (fill in the existing skeleton's 2 tests — requires real dev Supabase + `.env.local`)

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
- [x] Confirm backend-task-01's checkpoint is green on dev (this test file requires the real `record_skill_mastery()` function to exist).
- [x] Read all Investigation Targets, in particular `recordSkillMastery.int.test.ts`'s LANE MAPPING NOTE and both tests' full annotations.
- [x] Sweep the adjacent cases per Change Category above; record findings in Investigation Notes.
- [x] Convert the 2 skeleton tests into real tests against the real dev Supabase instance, following `test-rls.ts`'s fixture-prefix pattern for isolated setup/cleanup.
- [x] Run the tests and confirm both fail (no `recordSkillMastery()` TS export or step-7 wiring exists yet).

### 2. Green Phase
- [x] Implement `recordSkillMastery()` in `service-role.ts`, mirroring `recordExamResult()`'s never-throws/`{error}`-return shape, passing `p_per_question` unmodified.
- [x] Insert step 7 into `submitExam()`: call `recordSkillMastery()` in a `try/catch` immediately after the existing `recordExamResult()` error-handling block (after line ~162), before the final redirect (line ~164); on failure, `console.error` with context, do not re-throw.
- [x] Run `recordSkillMastery.int.test.ts` against real dev Postgres — confirm both tests pass.

### 3. Refactor Phase
- [x] Re-run `submitExam.int.test.ts` (the existing, unrelated test file for this same function) to confirm no regression to steps 1-6's pre-existing behavior.

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

## Investigation Notes

### Investigation Targets read (2026-08-14)

- `SOURCE/app/(layer2)/__tests__/recordSkillMastery.int.test.ts` (skeleton, 137 lines, comments only — no code). LANE MAPPING NOTE: this `.int.test.ts` is the ONE file in the repo whose `.int.test.ts` suffix means *real dev Supabase*, not the mocked-`@/lib/supabase/server` convention its four siblings use. Fixture id-prefix convention borrowed from `test-rls.ts` (`rls-` → here `mastery-int-`). Test 1 obligations (a)-(d); Test 2 is a negative proof that must distinguish the PERMISSION error class from a function-body error.
- `SOURCE/lib/supabase/service-role.ts` — `recordExamResult(attemptId, score)` (lines 57-70) is the exact shape to mirror: private `serviceRoleClient()`, single `.rpc()`, `return { error: error ? { code, message } : null }`, never throws on RPC failure (it *can* throw only if env is missing, inside `serviceRoleClient()`).
- `SOURCE/app/(layer2)/actions.ts` — `submitExam()` control flow: (1) read attempt → (rate-limit `guard`) → idempotency short-circuit `redirect()` at 82-84 → (2) exam `question_ids` → (3) `claim_attempt_answer_key` RPC + empty-`qRows` short-circuit `redirect()` at 113-115 → row→`Question` mapping → (4) `attempt_answers` upsert → (5) `computeScore()` → (6) `recordExamResult()` (throws "Could not save your result" on error) → `redirect()` at 164. Step 7's only correct insertion point is between 162 and 164.
- `SOURCE/supabase/test-rls.ts` — `ensureUser()` (Admin API create-or-update, `email_confirm: true`), `signInAs()` (anon key + real password sign-in), `cleanupX`/`setupX` pairs run before AND after for idempotency, and MM-b's error-class discrimination (`42501` / `PGRST202` / `/permission denied|could not find the function/i`) — reused verbatim as this file's Test 2 predicate so the two proofs stay recognisably the same boundary at two layers.
- `SOURCE/supabase/schema.sql` §18 (lines 1259-1350) — `record_skill_mastery(p_attempt_id uuid, p_per_question jsonb)`: derives `v_user_id` from `exam_attempts` requiring `status='submitted'` (raises `check_violation` otherwise); `join public.questions q on q.id = pq->>'questionId'` (INNER, so an unknown question drops out); `where coalesce((pq->>'scored')::boolean, true) and q.skill_node_id is not null`; `count(*) filter (where isCorrect)` / `count(*)`; `on conflict (user_id, skill_node_id) do update set correct_count = existing + excluded, total_count = existing + excluded` (accumulate, never overwrite); `last_wrong_at = coalesce(excluded.last_wrong_at, existing)`. `revoke all ... from public, anon, authenticated` + `grant execute ... to service_role`.
- `docs/design/engine1-adaptive-ai-backend-design.md` — contract fixed at line 778: `recordSkillMastery(attemptId: string, score: ScoreResult): Promise<{error: {code?: string; message: string} | null}>` (takes the whole `ScoreResult`, like `recordExamResult`; passes `score.perQuestion` through). Sequence diagram (735-760) puts the try/catch on the TS side, not a SQL transaction. Minimal Surface Element 3: `skill_node_id` never enters the TS layer — confirmed, the wrapper names no skill anywhere.
- `docs/adr/ADR-0011-...` — read; Decision table + Implementation Guidance drive the Binding Decisions below.

### Test environment check (Step 3 precondition) — PASSED

Probed the dev instance over PostgREST before writing any test code (service_role key + anon key from `SOURCE/.env.local`):

| Probe | Result |
|---|---|
| `select user_skill_mastery` as service_role | `200 []` — table exists, reachable |
| `rpc record_skill_mastery` as service_role (bogus attempt id) | `400 23514 "record_skill_mastery: attempt … không tồn tại hoặc chưa submitted"` — function EXISTS and EXECUTED (error came from the body, i.e. Task 1's apply is live) |
| `rpc record_skill_mastery` as anon | `401 42501 "permission denied for function record_skill_mastery"` — the §18 revoke is live on this DB |

### Adjacent Case Sweep (Change Category: state-change, boundary-change)

1. **Idempotency short-circuit (`actions.ts:82-84`)** — `redirect()` throws `NEXT_REDIRECT` before step 7's insertion point (line 162+). Step 7 is unreachable on the "đã nộp rồi" branch, so a re-submit cannot double-accumulate mastery *through submitExam*. Preserved by position, not by a flag. (Note this is also the exact reason ADR-0011's narrow window is not self-healing — same mechanism, accepted.)
2. **Empty-`qRows` short-circuit (`actions.ts:113-115`)** — same: `redirect()` before step 7. A concurrently-submitted attempt never reaches the mastery write.
3. **Steps 1-6 error paths** — all pre-existing paths either `throw` or `redirect` before line 162; step 7 is purely appended, adds no branch to them. `recordExamResult()`'s own failure still `throw`s (line 161) and therefore never reaches step 7 — mastery is only ever written *after* a durable score write, exactly ADR-0011's ordering.
4. **`recordExamResult()` has exactly one caller** (`actions.ts:158`) — verified by repo grep; no other call site needs an analogous wrapper.
5. **Sibling exports in `service-role.ts`** — `moderateExam`, `flagSupportTicketNotifyFailed`, `addSupportTicketNote`, `changeSupportTicketStatus` already return `{error}` rather than throwing (the same never-throw convention); `listReportedExams`/`listSupportTickets` deliberately `throw` because they are read paths on an admin screen where a silent empty list would be worse. No inconsistency introduced by adding one more `{error}`-returning write. No adjacent residual outside this task's Target Files.
6. **Residual recorded for downstream review**: `submitExam.int.test.ts` (pre-existing, not a Target File) mocks `@/lib/supabase/service-role` with only `recordExamResult`. After step 7 lands, `recordSkillMastery` is `undefined` there, so step 7 throws a `TypeError` *inside its own try/catch* and is swallowed + logged. That is the designed behaviour (a failing mastery write must not affect submitExam), and it makes that file an incidental live proof of the non-throwing contract — but it does print one `console.error` line per happy-path case. Left as-is deliberately: modifying a pre-existing test file is outside this task's scope.

### Binding Decision Check (pre-implementation, all rows evaluated against the planned approach)

Planned approach — **dependency_direction**: `recordSkillMastery()` is a new, separate export in `service-role.ts` calling `.rpc("record_skill_mastery", …)`; `submitExam()` calls it in its own `try/catch` placed after the whole `recordExamResult()` if-error block (which still throws on failure) and before the final `redirect()`; no transaction spans the two RPCs (they are two independent PostgREST requests).
Planned approach — **contract_schema**: the wrapper's RPC payload is exactly `{p_attempt_id, p_per_question}`; there is no user-id-shaped parameter anywhere in the TS layer, and the integration test asserts the rows landed under the *attempt's* owner (a user id the test never passes to the RPC).
Planned approach — **data_flow**: step 7's `try/catch` logs via `console.error` on either an `{error}` return or a thrown exception, and never re-throws; the `redirect()` is outside the try block and always runs.

| # | Compliance Check | Eval | Rationale |
|---|---|---|---|
| 1 | separate try/catch step AFTER `recordExamResult()`'s error handling, no shared transaction | `Y` | Two independent `.rpc()` calls over PostgREST; no `begin/commit` exists on either side; insertion point is after line 162. |
| 2 | Test 1 proves `user_id` derivation end-to-end, no `p_user_id`-shaped parameter | `Y` | Payload is 2 keys only; the test reads back `where user_id = <student created via Admin API>` — a value never sent to the RPC, so a match can only come from the SQL's own `select a.user_id from exam_attempts`. |
| 3 | step 7 swallows (logs, not re-throws) failures, submitExam's success/redirect unaffected | `Y` | `catch` logs only; `redirect()` sits outside the try; the RED-phase run (before implementation) and the `submitExam.int.test.ts` re-run (where the mocked module makes step 7 throw) both exercise this. |

### Exit-gate re-evaluation (post-implementation)

- Row 1 — `Y`. `SOURCE/app/(layer2)/actions.ts` step 7 is a standalone `try/catch` (comment from line 164, code at 179-186), after the `if (resErr) { … throw }` block; `redirect()` at line 188 is outside it.
- Row 2 — `Y`. `recordSkillMastery()` sends exactly `{ p_attempt_id, p_per_question }` (no third key); Test 1 passes reading back by `user_id` derived server-side.
- Row 3 — `Y`. Proven twice at runtime: (i) mutation M2 (wrapper made to reject) left Test 1's `submitExam` redirect assertion green while the mastery assertions went red; (ii) `submitExam.int.test.ts` still passes end-to-end although `recordSkillMastery` is `undefined` in its mock, i.e. step 7 throws and is swallowed.
- Roundtrip check (Boundary Context) — `Y`. `p_per_question` is `score.perQuestion` by reference, no re-shaping; the real-Postgres read-back arithmetic (1/2 and 1/1) is only reachable if the SQL parse rule and the TS payload agree field-for-field.

### Mutation evidence (non-vacuity)

| # | Mutation | Target | Observed |
|---|---|---|---|
| M1 | `p_per_question: score.perQuestion` → `score.perQuestion.filter((r) => r.isCorrect)` | `service-role.ts` | Test 1 FAILS (`sn-fixture-a` total_count 1, expected 2) — the roundtrip/arithmetic assertion is load-bearing. Restored, green. |
| M2 | step 7's call made to reject before reaching the wrapper (`await Promise.reject(new Error("MUTATION")).then(() => recordSkillMastery(…))`) | `actions.ts` | Test 1 FAILS on the mastery rows (`[]`, expected length 2) while the redirect + `exam_results` (correct 2 / total 4) assertions that run BEFORE it still PASS, and the run logs `[submitExam] recordSkillMastery Error: MUTATION` — proves non-vacuity of Test 1 AND that a thrown mastery failure is swallowed without affecting submission (Binding Decision 3). Restored, green. |
| M3 | Test 2's caller client swapped from the student's JWT to the service-role key | test file | Test 2 FAILS (`error` is `null` — the privileged caller executes the function) — proves the negative assertion is not vacuously green. Restored, green. |

Each mutation was applied alone and reverted immediately (never batched); after every restore the file was `diff`ed against the pristine backup taken before the first mutation (SHA-256-verified when taken) and the test re-run to green. Final state is byte-identical to those backups.

### Deviations from the written Implementation Steps

- Red Phase item "Run the tests and confirm **both** fail": only Test 1 failed in the RED run (`expected [] to have a length of 2`, i.e. exactly the missing step 7). Test 2 passed pre-implementation *by construction* — it is a negative proof about a Postgres EXECUTE grant that Task 1 already landed, and no TS code of this task can influence it. Its non-vacuity is therefore established by mutation M3 instead of by a RED run.
- One incidental fix inside the new test file: `.env.local` values in this repo may be quote-wrapped (`KV_REST_API_URL="https://…"`, written that way because Next.js strips quotes when *it* loads the file). `test-rls.ts`'s loader does not strip them; carried over verbatim, the quoted Upstash URL made `guard()` throw inside `submitExam()` for a reason unrelated to this task. The test's own loader strips one layer of surrounding quotes. No production code reads `.env.local` this way, so nothing outside this file is affected.

## Completion Criteria
- [x] `recordSkillMastery()` exported from `service-role.ts`; step 7 wired into `submitExam()`
- [x] `recordSkillMastery.int.test.ts` Tests 1-2 pass against real dev Postgres
- [x] Each Binding Decision's Compliance Check evaluates to `Y`, evidence recorded in Investigation Notes
- [x] `submitExam.int.test.ts` (pre-existing) re-run with no regression
- [x] Each Proof Obligation is met

## Notes
- Impact scope: `SOURCE/lib/supabase/service-role.ts` (additive export), `SOURCE/app/(layer2)/actions.ts` (additive step 7 only, lines ~162-164 insertion point).
- Scope boundary: do not modify `recordExamResult()` itself or `submitExam()`'s steps 1-6; do not touch `record_skill_mastery()`'s SQL definition here (backend-task-01, read-only dependency).
