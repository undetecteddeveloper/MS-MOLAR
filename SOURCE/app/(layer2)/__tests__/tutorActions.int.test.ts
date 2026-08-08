// explainStep() [integration] Test Skeleton
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-012/013/021/022/029)
// Generated: 2026-08-08 | Budget Used: integration 1/3 (backend sub-budget)
//
// BUDGET NOTE: this feature spans two companion Design Docs (backend + frontend),
// each with its own Mock Boundary Decisions, dependency graph, and test runtime
// (node for backend *.int.test.ts vs jsdom for frontend *.test.tsx). This
// generation run tracks a backend-integration sub-budget (this file +
// getSkillRecommendation.int.test.ts, 2/3) separately from a frontend-integration
// sub-budget (ExplainStepAffordance.test.tsx + SkillRecommendationCard.test.tsx,
// 2/3) rather than one combined MAX-3 pool, because both Design Docs
// independently and explicitly name their own required test files in their own
// Agreement Checklist / Implementation Path Mapping — see the generation report
// for the full rationale.
//
// Mock boundary (backend DD Test Boundaries — Mock Boundary Decisions): Supabase
//   client inside explainStep() — Yes, mock, for integration tests — matches the
//   project's sanctioned getResult.int.test.ts / rating.int.test.ts precedent
//   (mocked @/lib/supabase/server createClient(); "server-only" stubbed, same
//   pattern as submitExam.int.test.ts). generateHint()/callTutor.ts (the
//   Gemini-facing boundary) is ALSO mocked here — this file proves explainStep()'s
//   OWN orchestration (auth/ownership/re-verification/rate-limit/telemetry call
//   shape), not the Gemini round trip itself (that is callTutor.ts's own,
//   separate unit-test responsibility per Mock Boundary Decisions).
//   computeWrongTwiceQuestionIds() is NOT mocked — it runs for real, in-process
//   (backend DD: "No — real implementation, direct pure-function unit test"), so
//   this file proves explainStep() actually CALLS it with the right fixture data,
//   not merely that a mock returned whatever the test wanted.
//
// IMPORTANT terminology note for the implementer: the backend DD's
//   Implementation Path Mapping row for this file describes AC-012 as "seeding
//   success/failure calls and querying the count/outcome split" — read this as
//   seeding FIXTURE ROWS into the MOCKED Supabase builder's recorded-calls list,
//   NOT a real Postgres INSERT/SELECT round trip. The authoritative Mock Boundary
//   Decisions table classifies this Supabase client as mocked for this file. Do
//   not swap this file to a real dev-Supabase client without updating this header
//   and the backend DD's own Test Boundaries section — the file that DOES require
//   a real Postgres instance is recordSkillMastery.int.test.ts (different
//   subsystem, record_skill_mastery()'s SQL logic), not this one.

// =============================================================================
// Test 1 — AC-021 + Integration Verification Points: server-side wrong-twice
// re-verification is the real eligibility gate, independent of client state
// =============================================================================
// AC-021: "Given a tutor call that fails (503/429/timeout), the Server Action
//   shall return a typed, actionable error; the caller (Server Component page)
//   is unaffected."
// Backend DD Test Boundaries, Integration Verification Points: "asserts
//   explainStep() returns not_eligible when the server-side wrong-twice
//   re-verification fails even if a caller passes an arbitrary questionId."
// ROI: 63 (BV:9 x Freq:6 + Legal:0 + Defect:9)
// Behavior: explainStep(attemptId, questionId) called for a questionId NOT
//   present in the server-recomputed wrong-twice set (simulating a caller
//   passing an arbitrary/forged questionId despite a stale or forged client-side
//   hasBeenWrongTwice claim) -> resolves { error: "not_eligible" } WITHOUT ever
//   invoking the mocked generateHint()/callTutor.ts boundary — proving the
//   server-side re-verification, not the UI's conditional render, is the actual
//   security gate (UI Spec D1's own stated position, honored here).
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/app/(layer2)/tutorActions.ts (explainStep) + mocked
//   Supabase client (createClient() boundary) + mocked generateHint()/callTutor.ts
//   boundary + computeWrongTwiceQuestionIds() (real, in-process)
// @complexity: high
// @real-dependency: none — sanctioned mock boundary (backend DD Test Boundaries).
// Primary failure mode: explainStep() trusts a client-supplied eligibility signal
//   (or skips server-side recomputation entirely for latency reasons), letting a
//   forged/stale questionId reach generateHint()/Gemini — the exact abuse case UI
//   Spec D1's security note flags, and this test is the sole automated proof
//   against it.
// Proof obligation: literal fixture — a user's full attempt history where
//   questionId "Q-not-eligible" was scored incorrect on only 1 attempt (does not
//   qualify) -> explainStep(attemptId, "Q-not-eligible") resolves
//   { error: "not_eligible" }; separately assert the mocked
//   generateHint()/callTutor boundary recorded 0 calls for this invocation — the
//   absence-of-call assertion is the actual proof, not merely the returned error
//   shape (a stub could coincidentally return the right error while still having
//   called Gemini).

// =============================================================================
// Test 2 — AC-012/AC-013: telemetry insert fires with a queryable, containment-
// safe shape on both success and failure outcomes
// =============================================================================
// AC-012: "...record an event sufficient to answer 'how many tutor calls
//   happened, for whom, and how many failed' via a telemetry_log query."
// AC-013 (integration-level complement to lib/tutor/__tests__/telemetry.test.ts's
//   unit-level proof): every inserted row's constructed arguments cannot
//   structurally hold correct_answer/sub_answers/essay_answer.
// ROI: 63 (BV:9 x Freq:6 + Legal:0 + Defect:9)
// Behavior: two explainStep() invocations against the mocked boundary — one
//   resolving success ({hint}, mocked generateHint() resolves), one resolving
//   failure ({error: "gemini_unavailable"}, mocked generateHint() rejects) — each
//   must trigger exactly one telemetry_log insert call with event_type=
//   'tutor_invoke', success:boolean matching the outcome, and a user_id/
//   error_code shape that answers "how many calls, for whom, how many failed"
//   (the insert call's recorded arguments, inspected via the mocked builder, are
//   the queryable-shape proof — no live Postgres SELECT is required since the
//   boundary is mocked, per the terminology note above).
// @category: core-functionality
// @lane: integration
// @dependency: same as Test 1
// @complexity: medium
// @real-dependency: none
// Primary failure mode: the telemetry insert is skipped entirely on the FAILURE
//   path (only success calls are logged), making "how many tutor calls failed"
//   permanently unanswerable in production — a silent observability gap with no
//   crash to surface it, exactly the kind of omission a call-shape assertion
//   (not merely "did explainStep() still return the right value") is needed to
//   catch.
// Proof obligation: assert the mocked insert builder recorded exactly 2 calls
//   total (one per explainStep() invocation), with the success call's arguments
//   toMatchObject (literal, independently-authored expected values, not merely
//   "whatever the mock returned unchanged") {event_type: "tutor_invoke",
//   success: true, user_id: <fixture id>, question_id: <fixture id>}, and the
//   failure call's arguments toMatchObject {event_type: "tutor_invoke",
//   success: false, error_code: "gemini_unavailable"}; separately assert NEITHER
//   call's argument object contains any AC-018-style sentinel answer-key value
//   (integration-level complement to telemetry.test.ts's own unit-level proof —
//   see that file for the sentinel technique).

// =============================================================================
// Test 3 — AC-029: untagged question (skill_node_id NULL) still functions
// =============================================================================
// AC-029: "Given a question with skill_node_id NULL, when the student answers it
//   wrong twice, the tutor shall still function (needs question content, not a
//   skill tag)."
// ROI: 50 (BV:6 x Freq:5 + Legal:0 + Defect:8)
// Behavior: explainStep() called for a wrong-twice-eligible question whose
//   fixture row has skill_node_id: null -> resolves { hint: ... } successfully
//   (mocked generateHint() resolves), never short-circuits on the null skill tag.
// @category: edge-case
// @lane: integration
// @dependency: same as Test 1
// @complexity: low
// @real-dependency: none
// Primary failure mode: a future maintainer adds a "skill_node_id IS NOT NULL"
//   precondition to explainStep() (e.g. mistakenly assuming the tutor always
//   needs a skill context to build its prompt), silently breaking the tutor for
//   the unclassified-content subset of the corpus the batch tagger has not yet
//   reached — a real-world-common case, not a rare edge.
// Proof obligation: literal fixture with skill_node_id: null on the target
//   question row -> assert explainStep() still reaches and calls the mocked
//   generateHint() boundary (not short-circuited before it, i.e. call count is 1,
//   not 0) and resolves { hint } for a mocked-success case.

// =============================================================================
// Test 4 — AC-022: rate limiting rejects before any Gemini call
// =============================================================================
// AC-022: "Given the tutor entry point, it shall be a Server Action behind the
//   existing session pipeline, rate-limited per user via guard()."
// ROI: 45 (BV:6 x Freq:4 + Legal:0 + Defect:9)
// Behavior: the mocked guard() return simulates a rate-limit-exceeded response
//   -> explainStep() resolves { error: "rate_limited" } without ever calling the
//   mocked generateHint() boundary.
// @category: edge-case
// @lane: integration
// @dependency: same as Test 1, plus mocked SOURCE/lib/security/rateLimit.ts guard()
// @complexity: low
// @real-dependency: none
// Primary failure mode: a rate-limit rejection is miscoded as a generic "server"
//   error instead of the specific "rate_limited" code (defeating the code's own
//   purpose, even though the current UI copy is generic per Minimal Surface
//   Element 2 — the distinct code still exists for future differentiation and
//   for this cost-guard's own observability); or the rate-limit check runs AFTER
//   the Gemini call instead of before it, defeating its purpose as a cost guard.
// Proof obligation: assert the mocked generateHint() boundary recorded 0 calls
//   when guard() signals rate-limited, and the returned error is literally
//   "rate_limited" (not "server" or any other code).
