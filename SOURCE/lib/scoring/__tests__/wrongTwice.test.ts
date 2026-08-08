// computeWrongTwiceQuestionIds() [unit] Test Skeleton
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0) — backend half of UI Spec D1
//   ("hasBeenWrongTwice is computed server-side in getResult()...")
// Generated: 2026-08-08
//
// NOT part of the integration/fixture-e2e/service-integration-e2e lane budget —
// Design-Doc-mandated unit coverage (backend DD Implementation Path Mapping:
// "SOURCE/lib/scoring/__tests__/wrongTwice.test.ts", "Cross-attempt aggregation
// correctness"), selected as a required cross-layer contract: this SAME function
// is the single source of truth both getResult() (display gating) and
// explainStep() (server-side re-verification, the actual security boundary) call
// — a bug here is a bug in two call sites at once.
//
// Mock boundary (backend DD Test Boundaries): computeWrongTwiceQuestionIds() — No,
//   real implementation, direct pure-function unit test (no I/O to mock).
// Contract under test (backend DD § Data Contracts):
//   computeWrongTwiceQuestionIds(attempts: {attemptId, perQuestion}[]): Set<string>
//   — questionId scored incorrect (scored !== false && isCorrect === false) on
//   >=2 DISTINCT attemptIds, across all of one user's attempts including the one
//   currently being viewed.

// =============================================================================
// Test 1 — cross-attempt >=2-distinct-attempts threshold
// =============================================================================
// AC (D1, backend half): "...true only when the current row is itself
//   scored !== false && isCorrect === false and the question has been scored
//   incorrect on >=2 distinct submitted attempts by the same user (across exams)."
// ROI: 64 (BV:8 x Freq:7 + Legal:0 + Defect:8)
// Behavior: a literal 3-attempt fixture where questionId "Q1" is scored incorrect
//   on attempts 1 and 2, correct on attempt 3 -> computeWrongTwiceQuestionIds()
//   returns a Set containing "Q1"; a questionId wrong on only 1 attempt across
//   the same fixture is excluded.
// @category: core-functionality
// @lane: unit
// @dependency: none (pure function; literal attempt/perQuestion fixtures)
// @complexity: medium
// @real-dependency: N/A
// Primary failure mode: the function counts wrong OCCURRENCES within a flattened
//   list (e.g. a duplicate row inside one attempt's own perQuestion array) instead
//   of DISTINCT attemptIds, over-including a question only ever attempted once; or
//   it treats "wrong on exactly 1 attempt" as already satisfying ">=2" (off-by-one).
// Proof obligation: literal 3-attempt fixture (independently authored, not
//   derived from any computeScore() output) — assert the returned Set toEqual
//   (new Set(["Q1"])) EXACTLY (not merely toContain — proves no other questionId
//   leaked in), and a parallel fixture question wrong on exactly 1 attempt is
//   provably absent from the returned Set.

// =============================================================================
// Test 2 — scored:false exclusion + "undefined = scored" convention parity
// =============================================================================
// No standalone AC number — Invariant stated directly in backend DD § Data
//   Contracts: "'scored !== false' mirrors computeScore.ts's own isScored()
//   convention exactly (undefined = scored)."
// ROI: 60 (BV:7 x Freq:7 + Legal:0 + Defect:8)
// Behavior: a perQuestion row with scored: false and isCorrect: false, wrong on 2
//   attempts, is NOT counted (essay/ungraded rows never contribute to wrong-twice
//   eligibility). A parallel row with scored omitted entirely (undefined) and
//   isCorrect: false, wrong on 2 attempts, IS counted.
// @category: edge-case
// @lane: unit
// @dependency: none
// @complexity: low
// @real-dependency: N/A
// Primary failure mode: the predicate is written as `scored === true` instead of
//   `scored !== false`, silently excluding every question whose scored field was
//   never explicitly set to true — breaking parity with computeScore.ts's own
//   isScored() convention this function is required to mirror (Code Inspection
//   Evidence: computeScore.ts:36-42).
// Proof obligation: two parallel literal fixtures (one scored:false, one
//   scored:undefined/omitted), both otherwise identical and wrong on 2 distinct
//   attempts — assert the scored:false question's id is absent from the returned
//   Set and the scored:undefined question's id is present.

// =============================================================================
// Test 3 — cross-exam question identity (global, not per-exam)
// =============================================================================
// No standalone AC number — backend DD § Data Contracts Invariant: "Cross-EXAM:
//   a question shared by two different exams' question_ids still counts toward
//   the same threshold (question identity is global, per PRD A4's own framing)."
// ROI: 56 (BV:7 x Freq:6 + Legal:0 + Defect:8)
// Behavior: the same questionId appears in two different exams' attempts — wrong
//   on one attempt belonging to exam X and one attempt belonging to exam Y -> the
//   two wrong occurrences still count toward the same >=2-distinct-attempts
//   threshold.
// @category: edge-case
// @lane: unit
// @dependency: none
// @complexity: low
// @real-dependency: N/A
// Primary failure mode: the aggregation is accidentally scoped per-exam (e.g.
//   grouped by an implicit exam/attempt-context key) instead of globally by
//   questionId across ALL of the user's attempts, undercounting a cross-exam
//   wrong-twice case the PRD's own A4 framing requires to count.
// Proof obligation: a literal 2-attempt fixture from two attempts belonging to
//   different exam contexts, sharing one questionId, both wrong -> assert that
//   questionId is present in the returned Set.
