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
// Proof obligation:
//   (a) Additive extension (query shape) — the exam_attempts mock is invoked
//       with .select("exam_id, started_at, submitted_at"), not the old
//       .select("exam_id") 1-column form.
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

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

// queries.ts imports "server-only" (throws outside a Next server/react-server bundle)
// → stub, same pattern as rating.int.test.ts.
vi.mock("server-only", () => ({}));

// Mock boundary: Supabase client only (backend DD Test Boundaries) — proves JS call
// construction; no real-Postgres semantics are newly introduced by this additive change.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
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

// exams_with_difficulty row (DB shape) — getResult() surfaces only id/title from this.
const EXAM_ROW = {
  id: "exam-1",
  title: "Sample Exam",
  question_ids: ["q1"],
  duration_minutes: 45,
  subject: "Math",
  grade: 10,
  school: null,
  school_year: null,
  semester: null,
  author_display_name: null,
  parts: null,
  rating_count: 0,
  avg_overall: null,
};

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

/** Wires fromMock for getResult()'s call chain: exam_results -> exam_attempts ->
 * exams_with_difficulty (via getExam()) -> questions. `attemptRow` drives the
 * extension under test (started_at/submitted_at); the returned
 * `examAttemptsSelectMock` records the exact .select() call argument for
 * obligation (a). */
function mockGetResultChain(attemptRow: {
  exam_id: string;
  started_at: string;
  submitted_at: string | null;
}) {
  const examAttemptsSelectMock = vi.fn(() => ({
    eq: () => ({
      maybeSingle: async () => ({ data: attemptRow, error: null }),
    }),
  }));

  fromMock.mockImplementation((table: string) => {
    if (table === "exam_results") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: RESULT_ROW, error: null }),
          }),
        }),
      };
    }
    if (table === "exam_attempts") {
      return { select: examAttemptsSelectMock };
    }
    if (table === "exams_with_difficulty") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: EXAM_ROW, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === "questions") {
      return {
        select: () => ({
          in: async () => ({ data: QUESTION_ROWS, error: null }),
        }),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return { examAttemptsSelectMock };
}

describe("getResult() — additive select extension, byte-identical pre-existing output, correctly-mapped new fields, null-submittedAt path (Test 2)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it('obligation (a): the exam_attempts mock is invoked with .select("exam_id, started_at, submitted_at")', async () => {
    const { examAttemptsSelectMock } = mockGetResultChain({
      exam_id: "exam-1",
      started_at: "2026-07-20T10:00:00.000Z",
      submitted_at: "2026-07-20T10:30:00.000Z",
    });

    await getResult(ATTEMPT_ID);

    expect(examAttemptsSelectMock).toHaveBeenCalledWith("exam_id, started_at, submitted_at");
  });

  it("obligation (b): Output Comparison — pre-existing fields toEqual an independently-authored fixture; startedAt/submittedAt correctly mapped (non-null case)", async () => {
    mockGetResultChain({
      exam_id: "exam-1",
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
      exam_id: "exam-1",
      started_at: "2026-07-20T10:00:00.000Z",
      submitted_at: null,
    });

    const result = await getResult(ATTEMPT_ID);

    expect(result).not.toBeNull();
    expect(result!.submittedAt).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(result!, "submittedAt")).toBe(true);
  });
});
