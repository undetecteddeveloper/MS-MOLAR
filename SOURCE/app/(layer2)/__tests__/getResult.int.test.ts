// getResult() Extension [integration] Test Skeleton
// Design Doc: docs/design/history-backend-design.md (v1.2)
// PRD: docs/prd/history-prd.md (v1.3, AC-009)
// Generated: 2026-07-30 | Budget Used: integration 3/3 (this file is slot 3 of 3
//   by ROI rank — see SOURCE/app/(HM)/__tests__/history.int.test.ts's header
//   for the full feature-level budget accounting)
//
// Converted from skeleton (history backend Task 1.1): getResult()'s extension
// (exam_attempts select gaining "started_at, submitted_at"; ExamResult type
// gaining startedAt/submittedAt) is implemented alongside these tests, TDD
// Red -> Green in one commit.
//
// Mock boundary: same sanctioned boundary as history.int.test.ts/rating.int.test.ts
// — the Supabase client only (backend DD Test Boundaries: "Supabase client inside
// listMyHistory()/getResult() — Yes (mock)").

// =============================================================================
// Test 2 — getResult(): additive select extension, byte-identical
// pre-existing output, correctly-mapped new fields, null-submittedAt path
// =============================================================================
// AC-009: "Given a History row or the Result page, when Save/Share is
//   triggered, then all PDF-required data (score, exam title, startedAt/
//   submittedAt) is already present in the data the page/row already
//   loaded... with no additional backend round trip." (getResult()'s half:
//   startedAt/submittedAt must be present on the SAME call already made for
//   examId/examTitle/result/questions — no second query is ever issued.)
// Regression risk R-2 (backend DD Risks and Mitigation table): "getResult()'s
//   extension regresses either of its 2 existing consumers if not strictly
//   additive." Both result/page.tsx and result/detail/page.tsx are existing,
//   already-shipped, live-traffic consumers of getResult()'s current output —
//   this is the only automated proof that this feature does not break them.
// ROI: 80 (BV:9 x Freq:8 + Legal:0 + Defect:8) — getResult() already backs 2
//   shipped pages; a non-additive regression here breaks the existing Result
//   page for every user viewing any past attempt, not merely the new History
//   surface — elevated above a typical "new read" ROI specifically because of
//   this backward-compatibility blast radius.
// Behavior: getResult(attemptId) is called against a mocked Supabase client
//   boundary -> the exam_attempts select gains started_at/submitted_at
//   alongside the existing exam_id -> asserts every pre-existing field's value
//   and null-ness is byte-identical to the pre-change shape (Output
//   Comparison) and the 2 new fields are correctly mapped from the mocked
//   snake_case columns, including the reachable null-submittedAt race-window
//   case (a direct hit on the attempt's URL before submitExam's status-update
//   step completes).
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/app/(layer2)/queries.ts (getResult) + mocked Supabase
//   client (createClient() boundary)
// @complexity: low
// @real-dependency: none — same sanctioned mock boundary as
//   history.int.test.ts; this test proves JS call-construction/mapping
//   correctness only, not real-Postgres semantics (none are newly introduced
//   by this additive change).
// Primary failure mode: the exam_attempts select silently drops or misnames
//   one of the 2 new columns (e.g. selects "started_at" but not
//   "submitted_at"); OR the extension inadvertently changes a pre-existing
//   field's value or null-ness (examId, examTitle, result.totalScore/correct/
//   total/perQuestion/topicBreakdown, or questions); OR a null submitted_at is
//   coerced to an empty string or omitted from the returned object instead of
//   staying exactly `null` on ExamResult.submittedAt.
// Round-trip collapse (2026-08-03 perf pass): getResult() previously issued 4
//   sequential round trips (exam_results -> exam_attempts -> exams_with_difficulty
//   via getExam() -> questions, measured ~816ms). The first 3 are now a single
//   PostgREST request embedding exam_attempts and, through it, the
//   exams_with_difficulty view (~385ms, verified output-identical against the old
//   chain on the real DB). Obligations (a)-(c) below are unchanged in substance;
//   (a)'s columns simply moved into the embed, and (d)/(e) were added because the
//   collapse gave this function two new responsibilities of its own: carrying
//   getExam()'s published-visibility guard, and staying collapsed.
// Proof obligation:
//   (a) Additive extension (query shape) — the exam_results select embeds
//       exam_attempts!inner(...) and that projection still carries both
//       started_at and submitted_at (dropping either still breaks AC-009).
//   (b) Output Comparison — with a fixture attempt/result/exam/questions row
//       set, the returned ExamResult's pre-existing sub-object
//       { examId, examTitle, result, questions } is toEqual an independently
//       authored literal fixture value (not merely "whatever the mock
//       returned unchanged" — per testing-principles' "Literal Expected
//       Values", the expected value must be computed independently of the
//       implementation so a real regression would be caught); startedAt is a
//       non-empty string equal to the fixture's started_at; submittedAt
//       equals the fixture's submitted_at (non-null case).
//   (c) Null-submittedAt path — with a mocked exam_attempts row where
//       submitted_at is null, ExamResult.submittedAt === null exactly (not
//       coerced to "" and not omitted as a missing key from the returned
//       object).
//   (d) Visibility guard survived the collapse — the join applies
//       .eq("exam_attempts.exams_with_difficulty.status", "published"), the guard
//       previously owned by getExam(). Without it an unpublished/withdrawn exam's
//       result would become readable: a visibility regression, not a perf one.
//   (e) Round-trip no-regression guard — exactly 2 .from() calls are issued, in
//       order: "exam_results" then "questions". Re-splitting the join would undo
//       the optimization while every output assertion still passed.
// Verification points / expected results / pass criteria:
//   - Obligation (a): the exam_attempts mock's recorded .select() call
//     argument equals the exact literal string
//     "exam_id, started_at, submitted_at".
//   - Obligation (b): `toEqual` on the extracted
//     { examId, examTitle, result, questions } sub-object against a literal
//     expected fixture object authored independently of the mock's return
//     value; startedAt is a non-empty string matching the fixture's
//     started_at; submittedAt (string case) equals the fixture's
//     submitted_at.
//   - Obligation (c): ExamResult.submittedAt === null (strict equality); the
//     key "submittedAt" is present on the returned object
//     (Object.prototype.hasOwnProperty.call(result, "submittedAt") === true),
//     not silently absent.

// Answer-key lockdown (2026-08-03, Security review Critical #1): round trip 2 is
// now supabase.rpc("exam_answer_key") instead of .from("questions") —
// sub_answers/essay_answer are REVOKEd from the `authenticated` role, so the
// SECURITY DEFINER function (schema.sql §10a) is the only path that still yields
// them, and only to the exam's author or someone who has already submitted an
// attempt on it. Obligation (e) below still counts 2 round trips; it just counts
// one .from() and one .rpc() instead of two .from()s.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

// queries.ts imports "server-only" (throws outside a Next server/react-server bundle)
// → stub, same pattern as rating.int.test.ts.
vi.mock("server-only", () => ({}));

// Mock boundary: Supabase client only (backend DD Test Boundaries) — proves JS call
// construction; no real-Postgres semantics are newly introduced by this additive change.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock, rpc: rpcMock })),
}));

const { getResult } = await import("../queries");

const ATTEMPT_ID = "attempt-1";

// exam_results row (DB shape, snake_case) — feeds ScoreResult; untouched by this task.
const RESULT_ROW = {
  total_score: 8.5,
  correct: 4,
  total: 5,
  per_question: [{ questionId: "q1", selected: "A", correct: "A", isCorrect: true, scored: true }],
  topic_breakdown: [{ topic: "Algebra", correct: 1, total: 1 }],
};

// Embedded exams_with_difficulty projection — getResult() selects only id/title
// through the join, because those are the only two fields it surfaces.
const EMBEDDED_EXAM = { id: "exam-1", title: "Sample Exam" };

// questions row (DB shape).
const QUESTION_ROWS = [
  {
    id: "q1",
    content: "What is 2+2?",
    choices: [
      { id: "A", text: "3" },
      { id: "B", text: "4" },
    ],
    question_type: "mcq",
    sub_answers: null,
    essay_answer: null,
  },
];

// Independently-authored expected fixture for getResult()'s PRE-EXISTING output
// shape ({ examId, examTitle, result, questions }) — computed by hand from
// RESULT_ROW/EXAM_ROW/QUESTION_ROWS above, not copied from the implementation
// (testing-principles' "Literal Expected Values").
const EXPECTED_PRE_EXISTING_OUTPUT = {
  examId: "exam-1",
  examTitle: "Sample Exam",
  result: {
    totalScore: 8.5,
    correct: 4,
    total: 5,
    perQuestion: [{ questionId: "q1", selected: "A", correct: "A", isCorrect: true, scored: true }],
    topicBreakdown: [{ topic: "Algebra", correct: 1, total: 1 }],
  },
  questions: {
    q1: {
      content: "What is 2+2?",
      choices: [
        { id: "A", text: "3" },
        { id: "B", text: "4" },
      ],
      questionType: "mcq",
      subItems: undefined,
      subAnswers: undefined,
      essayAnswer: undefined,
    },
  },
};

/** Wires fromMock for getResult()'s call chain, now 2 round trips instead of 4:
 * exam_results (with exam_attempts -> exams_with_difficulty embedded in the same
 * request) -> questions. `attemptRow` drives the extension under test
 * (started_at/submitted_at); the returned mocks/recorders back obligations
 * (a)/(d)/(e). */
function mockGetResultChain(attemptRow: {
  started_at: string;
  submitted_at: string | null;
}) {
  const examResultsSelectMock = vi.fn();
  const eqCalls: unknown[][] = [];

  rpcMock.mockImplementation(async (fn: string) => {
    if (fn === "exam_answer_key") return { data: QUESTION_ROWS, error: null };
    throw new Error(`unexpected rpc: ${fn}`);
  });

  fromMock.mockImplementation((table: string) => {
    if (table === "exam_results") {
      const builder: Record<string, unknown> = {
        select: (...args: unknown[]) => {
          examResultsSelectMock(...args);
          return builder;
        },
        eq: (...args: unknown[]) => {
          eqCalls.push(args);
          return builder;
        },
        maybeSingle: async () => ({
          data: {
            ...RESULT_ROW,
            exam_attempts: { ...attemptRow, exams_with_difficulty: EMBEDDED_EXAM },
          },
          error: null,
        }),
      };
      return builder;
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return { examResultsSelectMock, eqCalls };
}

describe("getResult() — additive select extension, byte-identical pre-existing output, correctly-mapped new fields, null-submittedAt path (Test 2)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("obligation (a): the embedded exam_attempts projection still carries started_at and submitted_at", async () => {
    const { examResultsSelectMock } = mockGetResultChain({
      started_at: "2026-07-20T10:00:00.000Z",
      submitted_at: "2026-07-20T10:30:00.000Z",
    });

    await getResult(ATTEMPT_ID);

    // The 2 columns are now requested through the embed rather than a separate
    // exam_attempts round trip, but dropping either still breaks AC-009 — so the
    // obligation is unchanged in substance, only in where the columns appear.
    const selectArg = examResultsSelectMock.mock.calls[0][0] as string;
    expect(selectArg).toContain("exam_attempts!inner(");
    expect(selectArg).toContain("started_at");
    expect(selectArg).toContain("submitted_at");
  });

  it("obligation (d): the published-visibility filter is applied on the embedded exam (round-trip collapse must not drop getExam()'s guard)", async () => {
    const { eqCalls } = mockGetResultChain({
      started_at: "2026-07-20T10:00:00.000Z",
      submitted_at: "2026-07-20T10:30:00.000Z",
    });

    await getResult(ATTEMPT_ID);

    // Collapsing the getExam() call into this join moved its
    // .eq("status","published") guard here. Losing it would surface results for
    // an unpublished/withdrawn exam — a visibility regression, not a perf one.
    expect(eqCalls).toContainEqual(["attempt_id", ATTEMPT_ID]);
    expect(eqCalls).toContainEqual(["exam_attempts.exams_with_difficulty.status", "published"]);
  });

  it("obligation (e): exactly 2 round trips are issued — exam_results (joined) then the exam_answer_key RPC (no-regression guard on the round-trip collapse)", async () => {
    mockGetResultChain({
      started_at: "2026-07-20T10:00:00.000Z",
      submitted_at: "2026-07-20T10:30:00.000Z",
    });

    await getResult(ATTEMPT_ID);

    // Was 4 sequential round trips (exam_results -> exam_attempts -> exams_with_
    // difficulty -> questions, ~816ms measured); the embed collapses the first 3
    // into one (~385ms). A future edit that re-splits them would silently undo
    // that without failing any output assertion. The 2nd trip became an RPC when
    // the answer columns were locked down (Critical #1) — still one trip, and
    // still keyed off the exam the join already resolved (no extra lookup).
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual(["exam_results"]);
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("exam_answer_key", { p_exam_id: "exam-1" });
  });

  it("obligation (b): Output Comparison — pre-existing fields toEqual an independently-authored fixture; startedAt/submittedAt correctly mapped (non-null case)", async () => {
    mockGetResultChain({
      started_at: "2026-07-20T10:00:00.000Z",
      submitted_at: "2026-07-20T10:30:00.000Z",
    });

    const result = await getResult(ATTEMPT_ID);

    expect(result).not.toBeNull();
    const { examId, examTitle, result: score, questions } = result!;
    expect({ examId, examTitle, result: score, questions }).toEqual(EXPECTED_PRE_EXISTING_OUTPUT);
    expect(typeof result!.startedAt).toBe("string");
    expect(result!.startedAt.length).toBeGreaterThan(0);
    expect(result!.startedAt).toBe("2026-07-20T10:00:00.000Z");
    expect(result!.submittedAt).toBe("2026-07-20T10:30:00.000Z");
  });

  it("obligation (c): a null submitted_at maps to ExamResult.submittedAt === null exactly (not coerced, not omitted)", async () => {
    mockGetResultChain({
      started_at: "2026-07-20T10:00:00.000Z",
      submitted_at: null,
    });

    const result = await getResult(ATTEMPT_ID);

    expect(result).not.toBeNull();
    expect(result!.submittedAt).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(result!, "submittedAt")).toBe(true);
  });
});
