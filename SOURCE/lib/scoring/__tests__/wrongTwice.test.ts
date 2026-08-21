// computeWrongTwiceQuestionIds() [unit]
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0) — backend half of UI Spec D1
//   ("hasBeenWrongTwice is computed server-side in getResult()...")
// Generated: 2026-08-08 | Converted from skeleton: 2026-08-14 (backend task 09,
//   Red -> Green in one commit, this repo's convention)
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

import { describe, expect, it } from "vitest";

import { computeWrongTwiceQuestionIds } from "../wrongTwice";
import type { WrongTwiceAttempt } from "../wrongTwice";

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
describe("computeWrongTwiceQuestionIds — cross-attempt >=2-distinct-attempts threshold (Test 1)", () => {
  // Three attempts, hand-authored (not produced by computeScore()):
  //   Q1 — wrong on attempt-1 AND attempt-2, correct on attempt-3  -> qualifies.
  //   Q2 — wrong TWICE inside attempt-1 alone (a duplicate row in one attempt's
  //        own array), never wrong on a second attempt                -> must not qualify.
  //   Q3 — wrong on exactly 1 attempt (the ">=2" off-by-one probe)    -> must not qualify.
  const THREE_ATTEMPTS: WrongTwiceAttempt[] = [
    {
      attemptId: "attempt-1",
      perQuestion: [
        { questionId: "Q1", selected: "A", isCorrect: false, scored: true },
        { questionId: "Q2", selected: "B", isCorrect: false, scored: true },
        { questionId: "Q2", selected: "C", isCorrect: false, scored: true },
        { questionId: "Q3", selected: "D", isCorrect: false, scored: true },
      ],
    },
    {
      attemptId: "attempt-2",
      perQuestion: [
        { questionId: "Q1", selected: "B", isCorrect: false, scored: true },
        { questionId: "Q3", selected: "A", isCorrect: true, scored: true },
      ],
    },
    {
      attemptId: "attempt-3",
      perQuestion: [{ questionId: "Q1", selected: "A", isCorrect: true, scored: true }],
    },
  ];

  it("should return exactly the questions wrong on >=2 distinct attempts when a fixture mixes 2-attempt, same-attempt-duplicate and 1-attempt wrongs", () => {
    const wrongTwice = computeWrongTwiceQuestionIds(THREE_ATTEMPTS);

    // toEqual on the whole Set (not toContain): proves no other questionId leaked in.
    expect(wrongTwice).toEqual(new Set(["Q1"]));
  });

  it("should exclude a question wrong on exactly 1 attempt (>=2 is not satisfied by 1)", () => {
    const wrongTwice = computeWrongTwiceQuestionIds(THREE_ATTEMPTS);

    expect(wrongTwice.has("Q3")).toBe(false);
  });

  it("should count DISTINCT attemptIds, not wrong occurrences, when one attempt lists the same question wrong twice", () => {
    const wrongTwice = computeWrongTwiceQuestionIds(THREE_ATTEMPTS);

    // Q2 is wrong twice, but both wrongs belong to attempt-1 — 1 distinct attempt.
    expect(wrongTwice.has("Q2")).toBe(false);
  });
});

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
describe("computeWrongTwiceQuestionIds — scored:false exclusion and scored:undefined inclusion (Test 2)", () => {
  // Two questions, identical in every respect except the `scored` field, both
  // wrong on the SAME 2 distinct attempts:
  //   Q-ESSAY  — scored: false          (essay/ungraded: never eligible)
  //   Q-LEGACY — `scored` omitted       (row cũ trước v2.1: undefined = scored)
  const PARALLEL_SCORED_FIXTURES: WrongTwiceAttempt[] = [
    {
      attemptId: "attempt-1",
      perQuestion: [
        { questionId: "Q-ESSAY", selected: "bài làm", isCorrect: false, scored: false },
        { questionId: "Q-LEGACY", selected: "bài làm", isCorrect: false },
      ],
    },
    {
      attemptId: "attempt-2",
      perQuestion: [
        { questionId: "Q-ESSAY", selected: "bài làm", isCorrect: false, scored: false },
        { questionId: "Q-LEGACY", selected: "bài làm", isCorrect: false },
      ],
    },
  ];

  it("should exclude a scored:false question even when it is wrong on 2 distinct attempts", () => {
    const wrongTwice = computeWrongTwiceQuestionIds(PARALLEL_SCORED_FIXTURES);

    expect(wrongTwice.has("Q-ESSAY")).toBe(false);
  });

  it("should include a question whose scored field is omitted (undefined = scored, mirroring computeScore.ts)", () => {
    const wrongTwice = computeWrongTwiceQuestionIds(PARALLEL_SCORED_FIXTURES);

    expect(wrongTwice.has("Q-LEGACY")).toBe(true);
    // Whole-Set assertion: the scored:false row contributed nothing at all.
    expect(wrongTwice).toEqual(new Set(["Q-LEGACY"]));
  });
});

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
// Primary failure mode (corrected — the skeleton's original wording named a
//   failure this function cannot have): per-exam scoping is UNREPRESENTABLE here.
//   WrongTwiceAttempt carries no exam identifier, so no mutation of wrongTwice.ts
//   can group by exam; this test can only fail if the aggregation stops being
//   keyed on questionId at all. The real per-exam/per-attempt scoping risk lives
//   one level up, in the CALLER's query shape — a `.eq()` narrowing the history
//   read below "all of this user's attempts" — and is covered by obligation (f)
//   of app/(layer2)/__tests__/getResult.int.test.ts. This test is kept as
//   executable documentation that the contract is global by construction.
// Proof obligation: a literal 2-attempt fixture from two attempts belonging to
//   different exam contexts, sharing one questionId, both wrong -> assert that
//   questionId is present in the returned Set.
describe("computeWrongTwiceQuestionIds — cross-exam (global) question identity (Test 3)", () => {
  // The contract's input type deliberately carries NO exam identifier — that
  // absence is exactly why the aggregation is global. The two exams are modelled
  // here by two attempts whose question sets are disjoint apart from Q-SHARED:
  //   attempt-exam-X: Q-X-ONLY + Q-SHARED (both wrong)
  //   attempt-exam-Y: Q-Y-ONLY + Q-SHARED (both wrong)
  const TWO_EXAMS: WrongTwiceAttempt[] = [
    {
      attemptId: "attempt-exam-X",
      perQuestion: [
        { questionId: "Q-X-ONLY", selected: "A", isCorrect: false, scored: true },
        { questionId: "Q-SHARED", selected: "A", isCorrect: false, scored: true },
      ],
    },
    {
      attemptId: "attempt-exam-Y",
      perQuestion: [
        { questionId: "Q-Y-ONLY", selected: "C", isCorrect: false, scored: true },
        { questionId: "Q-SHARED", selected: "B", isCorrect: false, scored: true },
      ],
    },
  ];

  it("should count a question shared by two different exams' attempts toward the same >=2 threshold", () => {
    const wrongTwice = computeWrongTwiceQuestionIds(TWO_EXAMS);

    expect(wrongTwice.has("Q-SHARED")).toBe(true);
    // Each exam-exclusive question is wrong on only its own single attempt.
    expect(wrongTwice).toEqual(new Set(["Q-SHARED"]));
  });
});
