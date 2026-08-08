// recordSkillMastery() end-to-end via submitExam() [service-integration-e2e]
// Test Skeleton
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// ADR: docs/adr/ADR-0011-mastery-write-trust-boundary.md (Accepted)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-009/010/011)
// Generated: 2026-08-08 | Budget Used: service-integration-e2e 1/2
//
// LANE MAPPING NOTE (project-convention adaptation — read before implementing):
//   this repo has no automated Playwright/browser E2E harness in CI (Playwright
//   MCP is agent-driven MANUAL verification only, per PROJECT_OVERVIEW.md §6 and
//   both companion Design Docs' own Quality Assurance Mechanisms tables). Per this
//   generation task's explicit instruction, this feature's "service-integration-e2e"
//   lane (full-system verification against real cross-service behavior — here, a
//   real Postgres write with GROUP BY/FILTER/JOIN/ON CONFLICT semantics a mock
//   cannot prove, not a browser journey) maps onto this project's own established
//   convention: an *.int.test.ts file that runs against a REAL dev Supabase
//   instance, rather than the mocked-Supabase-client-boundary convention that the
//   SAME ".int.test.ts" filename suffix ordinarily denotes elsewhere in this repo.
//   DO NOT use getResult.int.test.ts / rating.int.test.ts / submitExam.int.test.ts
//   / tutorActions.int.test.ts / getSkillRecommendation.int.test.ts as this file's
//   mocking precedent — all five of those mock @/lib/supabase/server's
//   createClient(). This file's qualifying criterion is the skill's own: "data
//   persists across a real DB write" — the exact backend DD Mock Boundary
//   Decisions statement that record_skill_mastery()'s "GROUP BY/FILTER/
//   ON CONFLICT logic, and the FK join against questions.skill_node_id... cannot
//   be meaningfully mocked; requires a real Postgres instance."
// ROI (justifying this selected service-integration-e2e slot): 81
//   (BV:9 x Freq:8 + Legal:0 + Defect:9) — clears the >50 threshold by a wide
//   margin; also the backend DD's Design Summary's own biggest_risks #1 item
//   ("A forged mastery write re-opens exactly the hole ADR-0010 closed for
//   scores, if the trust boundary is even slightly wrong").
// Second service-integration-e2e slot: intentionally left unfilled — no other
//   candidate in this feature requires real-Postgres/cross-service verification
//   at this ROI tier; the RLS table-level isolation cases (user_skill_mastery,
//   telemetry_log) are a separate, manually-run deliverable tracked in
//   SOURCE/supabase/test-rls.ts (see this generation run's report), not folded
//   into this file's budget.
//
// Test data approach (backend DD § Data Layer Testing Strategy): seeds a minimal
//   exam/questions/skill_nodes fixture directly via a service-role client, then
//   submits through the REAL submitExam() Server Action path (not a direct RPC
//   call — proves the integration point INSIDE submitExam(), not merely
//   record_skill_mastery() in isolation), then reads back user_skill_mastery via
//   a real Postgres client. Requires a real dev Supabase instance + .env.local —
//   same precondition class as SOURCE/supabase/test-rls.ts's own header ("Tiền
//   đề: schema.sql (bản có UGC v2.0 + Engine 1 §9b/§18/§19) + seed đã chạy").
//   Fixture id prefix convention: reuse this repo's existing "rls-"-style
//   isolated-prefix pattern (e.g. "mastery-int-" prefix) for idempotent
//   setup/cleanup, mirroring test-rls.ts's own fixture-prefix convention.

// =============================================================================
// Test 1 — AC-009/AC-010: user_skill_mastery rows arithmetically match the
// attempt's per-question correctness; untagged/unscored questions contribute
// nothing and cause no error
// =============================================================================
// AC-009: "When a student submits a Math exam containing skill-tagged
//   questions, the system shall update user_skill_mastery for each touched
//   skill node from that attempt's per-question correctness."
// AC-010: "Given a submitted exam contains questions with a NULL skill_node_id,
//   when mastery is updated, then those questions contribute nothing and cause
//   no error."
// ROI: 81 (see header)
// Behavior: a real submitExam(attemptId, answers) call against a seeded fixture
//   exam with 4 questions — 2 tagged to skill node "sn-fixture-a" (one answered
//   correctly, one incorrectly), 1 tagged to "sn-fixture-b" (answered correctly),
//   1 with skill_node_id NULL (answered incorrectly) — followed by a real SELECT
//   against user_skill_mastery for this user/these skill nodes.
// @category: core-functionality
// @lane: service-integration-e2e
// @dependency: full-system (real submitExam() -> real record_exam_result() +
//   real record_skill_mastery() SQL function -> real Postgres
//   user_skill_mastery table)
// @complexity: high
// @real-dependency: schema.sql §18's record_skill_mastery() SQL function, the
//   user_skill_mastery table, questions.skill_node_id column, and submitExam()'s
//   real integration point (its step-7 call to recordSkillMastery() after the
//   existing score write) — none of these may be mocked; per testing-principles'
//   "Mock Limitations for Data Layer," GROUP BY/FILTER/JOIN/ON CONFLICT
//   correctness cannot be proven by a mock.
// Primary failure mode: the SQL function's WHERE/JOIN silently drops or
//   double-counts a row — e.g. the `coalesce((pq->>'scored')::boolean, true)`
//   default is inverted, wrongly excluding undefined-scored rows that should
//   count as scored; OR the NULL-skill_node_id question is not filtered out by
//   the INNER JOIN and produces a spurious mastery row for a non-existent skill;
//   OR the `on conflict ... do update` accumulation ADDS instead of correctly
//   accumulating total_count on a re-run, silently double-counting on any retry
//   or duplicate submitExam() invocation.
// Proof obligation: after the real submitExam() call, SELECT user_skill_mastery
//   WHERE user_id = <fixture user> AND skill_node_id IN
//   ('sn-fixture-a','sn-fixture-b') and assert: (a) the 'sn-fixture-a' row has
//   correct_count=1, total_count=2 (values independently computed from the
//   fixture's own known correct/incorrect answers, not re-derived from the SQL
//   under test); (b) the 'sn-fixture-b' row has correct_count=1, total_count=1;
//   (c) NO user_skill_mastery row exists for the NULL-skill_node_id question —
//   assert the total row COUNT for this user across these fixture skill nodes
//   equals exactly 2, not 3, proving the untagged question contributed NOTHING,
//   not merely "didn't error"; (d) submitExam() itself still resolves/redirects
//   successfully (AC-010's "causes no error" half) even though one of the 4
//   questions carried no skill tag.

// =============================================================================
// Test 2 — AC-011: trust boundary — a student's own JWT cannot call
// record_skill_mastery() directly (mirrors ADR-0010's mechanism for score writes)
// =============================================================================
// AC-011: "Given the mastery write path, it shall respect the same trust
//   boundary as score writing — resolved by ADR-0011."
// ROI: 81 (see header — this IS the Design Summary's own top-named risk)
// Behavior: an attempt to call `record_skill_mastery()` directly under a real
//   STUDENT's own authenticated JWT (not service_role) -> the call must fail,
//   because EXECUTE on this function is granted ONLY to service_role (§18:
//   `revoke all on function public.record_skill_mastery(uuid, jsonb) from
//   public, anon, authenticated`).
// @category: core-functionality
// @lane: service-integration-e2e
// @dependency: full-system (real Postgres function-level GRANT/REVOKE
//   enforcement — cannot be simulated by a mock)
// @complexity: medium
// @real-dependency: the `revoke all on function
//   public.record_skill_mastery(uuid, jsonb) from public, anon, authenticated`
//   statement (§18) — a real Postgres privilege check.
// Primary failure mode: the revoke statement is missing, mistyped (wrong
//   function signature/overload — Supabase's default-privileges pitfall this
//   project has already been bitten by once, per schema.sql:732-739's incident
//   note), or landed against a stale DB because the §17 fingerprint procedure
//   wasn't followed after a manual apply — silently leaving the mastery write
//   callable by any authenticated student's own JWT, reopening exactly the hole
//   ADR-0010 closed for scores.
// Proof obligation: authenticate as a real (non-service-role) test user, call
//   `.rpc("record_skill_mastery", {p_attempt_id: <any>, p_per_question: []})`
//   directly against that user's own client, and assert the call errors with a
//   permission-denied-class error (not a silent no-op success and not a
//   different, unrelated error masking the real gap) — this is a NEGATIVE proof
//   (the call MUST fail). Complements SOURCE/supabase/test-rls.ts's own MM-a/
//   MM-b table-level RLS cases (see this generation run's report), which prove
//   table-level select/write isolation on user_skill_mastery but not this
//   function-level EXECUTE-grant boundary specifically.
