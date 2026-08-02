// Short-Answer Scoring — submitExam() essay_answer select+mapping fix [integration] Test
// Design Doc: docs/design/short-answer-scoring-backend-design.md (v1.1)
// UI Spec: N/A (backend-only file)
// Converted from skeleton (backend task 3): SA-BE-012's select+mapping fix (backend
// task 2, already landed) is asserted against here — this file adds no production
// code change of its own.
//
// Required scope item (NOT a discretionary ROI pick) — the backend Design Doc
// promotes this file from a non-blocking Work Plan recommendation to required
// scope (Agreement Checklist Scope; Fact Disposition `submitExam-select-test-gap`;
// Technical Dependencies and Implementation Order step 4) because it closes the
// document's own top-2 named risk (Design Summary `biggest_risks`): landing
// computeScore.ts's short_answer branch without this select+mapping fix (or
// with a typo'd select string) is a silent production no-op that
// computeScore.test.ts's pure-unit fixtures cannot detect (testing-principles'
// "Mock Limitations for Data Layer" — schema/query-shape mismatches pass
// through undetected with mock-only/unit-only testing).
//
// =============================================================================
// Test 1 — submitExam(): questions SELECT gains essay_answer; row-to-Question
// mapping correctly populates essayAnswer (incl. null -> undefined)
// =============================================================================
// AC: SA-BE-012 — "When submitExam() fetches questions for scoring, the system
//   shall include essay_answer in the SELECT and map it to Question.essayAnswer
//   (null -> undefined) for every question row regardless of questionType,
//   matching getResult()'s existing select-string precedent."
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/app/(layer2)/actions.ts (submitExam) + mocked Supabase
//   client (createClient() boundary) + computeScore() (real, in-process — not
//   mocked; it is the consumer whose input shape this test proves is correct)
// @complexity: medium
// @real-dependency: none — sanctioned mock-boundary test (backend DD Test
//   Boundaries: "Supabase client (createClient()) inside submitExam() — Yes
//   (mock)... computeScore() itself is explicitly 'No — real implementation,
//   direct pure-function unit test... no I/O exists to mock'"). computeScore
//   is spied (call-through, real implementation preserved) — not stubbed —
//   solely so this test can inspect the exact Question[] submitExam() builds,
//   since ScoreResult itself never carries essayAnswer (backend DD Field
//   Propagation Map: essayAnswer is "dropped" after the correctness
//   comparison, never persisted into per_question).

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, computeScoreSpy } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  computeScoreSpy: vi.fn(),
}));

// actions.ts imports "server-only" (throws outside a Next server/react-server bundle)
// → stub, same pattern as getResult.int.test.ts/rating.int.test.ts.
vi.mock("server-only", () => ({}));

// Mock boundary: Supabase client only (backend DD Test Boundaries) — proves JS call
// construction/mapping correctness; no real-Postgres semantics are newly introduced
// by this additive change.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

// computeScore() is not stubbed — computeScoreSpy delegates to the real
// implementation below, so its scoring logic still runs in-process. The wrapper
// only records call arguments, giving this test access to the mapped Question[]
// submitExam() constructs (obligations (b)-(d)), which no other observable
// boundary (attempt_answers/exam_results mock payloads) exposes.
vi.mock("@/lib/scoring/computeScore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scoring/computeScore")>();
  return {
    ...actual,
    computeScore: computeScoreSpy.mockImplementation(actual.computeScore),
  };
});

const { submitExam } = await import("../actions");

const ATTEMPT_ID = "attempt-1";
const EXAM_ID = "exam-1";
const QUESTION_IDS = ["q1", "q2"];

// questions rows (DB shape, snake_case) — q1 is the short_answer non-null case
// (obligation b), q2 is the null essay_answer case (obligation c; a legacy mcq
// row, per the skeleton's own example — schema.sql:237 confirms essay_answer is
// nullable with no CHECK).
const QUESTION_ROWS = [
  {
    id: "q1",
    content: "Tính giá trị x trong phương trình 2x = 2520",
    choices: [],
    correct_answer: null,
    subject: "Toán",
    grade: 12,
    topic: "Phương trình",
    question_type: "short_answer",
    sub_answers: null,
    essay_answer: "1260",
  },
  {
    id: "q2",
    content: "2 + 2 = ?",
    choices: [
      { id: "A", text: "3" },
      { id: "B", text: "4" },
    ],
    correct_answer: "B",
    subject: "Toán",
    grade: 10,
    topic: "Số học",
    question_type: "mcq",
    sub_answers: null,
    essay_answer: null,
  },
];

// Independently-authored expected mapping for q1 (testing-principles' "Literal
// Expected Values") — hand-computed from QUESTION_ROWS[0] above, not copied from
// actions.ts's implementation.
const EXPECTED_Q1_QUESTION = {
  id: "q1",
  content: "Tính giá trị x trong phương trình 2x = 2520",
  choices: [],
  correctAnswer: null,
  subject: "Toán",
  grade: 12,
  topic: "Phương trình",
  questionType: "short_answer",
  subAnswers: undefined,
  essayAnswer: "1260",
};

/** Wires fromMock for submitExam()'s full call chain: exam_attempts (select) ->
 * exams -> questions -> attempt_answers (upsert) -> exam_results (insert) ->
 * exam_attempts (update), mirroring getResult.int.test.ts's mockGetResultChain
 * structure. `attemptRow.status` drives whether submitExam proceeds to scoring
 * or redirects early; the returned `questionsSelectMock` records the exact
 * .select() call argument for obligation (a). */
function mockSubmitExamChain(attemptRow: { id: string; exam_id: string; status: string }) {
  const questionsSelectMock = vi.fn<(columns: string) => { in: () => Promise<{ data: typeof QUESTION_ROWS; error: null }> }>(
    () => ({
      in: async () => ({ data: QUESTION_ROWS, error: null }),
    })
  );
  const attemptAnswersUpsertMock = vi.fn(async () => ({ error: null }));
  const examResultsInsertMock = vi.fn(async () => ({ error: null }));
  const examAttemptsUpdateMock = vi.fn(() => ({
    eq: async () => ({ error: null }),
  }));

  fromMock.mockImplementation((table: string) => {
    if (table === "exam_attempts") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: attemptRow, error: null }),
          }),
        }),
        update: examAttemptsUpdateMock,
      };
    }
    if (table === "exams") {
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { question_ids: QUESTION_IDS }, error: null }),
          }),
        }),
      };
    }
    if (table === "questions") {
      return { select: questionsSelectMock };
    }
    if (table === "attempt_answers") {
      return { upsert: attemptAnswersUpsertMock };
    }
    if (table === "exam_results") {
      return { insert: examResultsInsertMock };
    }
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    questionsSelectMock,
    attemptAnswersUpsertMock,
    examResultsInsertMock,
    examAttemptsUpdateMock,
  };
}

/** submitExam() always ends (success path) with next/navigation's redirect(),
 * which throws a NEXT_REDIRECT control-flow error by design (real, unmocked —
 * consistent with this test only sanctioning the Supabase-client mock
 * boundary). Swallow exactly that expected throw so the assertions below can
 * run after every DB call in the happy path has already executed; re-throw
 * anything else. */
async function callSubmitExam(attemptId: string, answers: Record<string, string>) {
  try {
    await submitExam(attemptId, answers);
  } catch (err) {
    const digest = (err as { digest?: unknown } | null)?.digest;
    if (typeof digest !== "string" || !digest.startsWith("NEXT_REDIRECT")) {
      throw err;
    }
  }
}

describe("submitExam() — questions SELECT gains essay_answer; row-to-Question mapping correctly populates essayAnswer (Test 1)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    computeScoreSpy.mockClear();
  });

  it('obligation (a): the questions mock is invoked with a .select(...) string including "essay_answer" additively alongside the pre-existing columns', async () => {
    const { questionsSelectMock } = mockSubmitExamChain({
      id: ATTEMPT_ID,
      exam_id: EXAM_ID,
      status: "in_progress",
    });

    await callSubmitExam(ATTEMPT_ID, { q1: "1260", q2: "B" });

    expect(questionsSelectMock).toHaveBeenCalledTimes(1);
    const selectArg = questionsSelectMock.mock.calls[0][0];
    expect(typeof selectArg).toBe("string");
    expect(selectArg).toContain("essay_answer");
    // Additive, not replacing — the pre-existing sub_answers precedent stays present.
    expect(selectArg).toContain("sub_answers");
  });

  it("obligation (b): a mocked row with essay_answer:\"1260\" maps to Question.essayAnswer === \"1260\" via an independently-authored literal (non-null case)", async () => {
    mockSubmitExamChain({ id: ATTEMPT_ID, exam_id: EXAM_ID, status: "in_progress" });

    await callSubmitExam(ATTEMPT_ID, { q1: "1260", q2: "B" });

    expect(computeScoreSpy).toHaveBeenCalledTimes(1);
    const [questions] = computeScoreSpy.mock.calls[0];
    const q1 = questions.find((q: { id: string }) => q.id === "q1");
    expect(q1).toEqual(EXPECTED_Q1_QUESTION);
    expect(q1.essayAnswer).toBe("1260");
  });

  it("obligation (c): a mocked row with essay_answer:null maps to Question.essayAnswer === undefined strictly, key present (null case)", async () => {
    mockSubmitExamChain({ id: ATTEMPT_ID, exam_id: EXAM_ID, status: "in_progress" });

    await callSubmitExam(ATTEMPT_ID, { q1: "1260", q2: "B" });

    expect(computeScoreSpy).toHaveBeenCalledTimes(1);
    const [questions] = computeScoreSpy.mock.calls[0];
    const q2 = questions.find((q: { id: string }) => q.id === "q2");
    expect("essayAnswer" in q2).toBe(true);
    expect(q2.essayAnswer).toBeUndefined();
    // Never coerced to null or "".
    expect(q2.essayAnswer).not.toBeNull();
    expect(q2.essayAnswer).not.toBe("");
  });

  it("obligation (d): the pre-existing mapped fields stay byte-identical to the pre-change mapping for the same fixture row (regression guard)", async () => {
    mockSubmitExamChain({ id: ATTEMPT_ID, exam_id: EXAM_ID, status: "in_progress" });

    await callSubmitExam(ATTEMPT_ID, { q1: "1260", q2: "B" });

    const [questions] = computeScoreSpy.mock.calls[0];
    const q1 = questions.find((q: { id: string }) => q.id === "q1");
    // Independently-authored literal, excluding essayAnswer (covered by obligation b) —
    // additive column only, no existing field's mapping logic changes.
    expect(q1).toMatchObject({
      id: "q1",
      content: "Tính giá trị x trong phương trình 2x = 2520",
      choices: [],
      correctAnswer: null,
      subject: "Toán",
      grade: 12,
      topic: "Phương trình",
      questionType: "short_answer",
      subAnswers: undefined,
    });
  });
});
