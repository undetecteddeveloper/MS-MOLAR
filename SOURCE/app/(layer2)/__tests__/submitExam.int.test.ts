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

// 2026-08-03 (Security review Critical #1) — the answer key no longer comes from
// a `.from("questions").select(...)`: correct_answer/sub_answers/essay_answer are
// REVOKEd from the `authenticated` role, and submitExam() runs on the student's own
// JWT. The columns now cross the boundary through the SECURITY DEFINER function
// claim_attempt_answer_key() (schema.sql §10b), which locks the attempt before it
// returns anything. SA-BE-012's substance is unchanged and split in two:
//   - the column list moved into SQL   -> obligation (a) now guards schema.sql
//   - the row -> Question mapping stayed in actions.ts -> obligations (b)-(d) as before
// plus obligation (e), new: the lock must stay inside that RPC and must not be
// re-implemented as an app-side exam_attempts update (which would reopen the hole).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-08-03 (Security review Critical #2) — exam_results is no longer written
// through the user's own client: `authenticated` lost INSERT on that table
// entirely (schema.sql §11a), so the write moved to recordExamResult(), a
// server-only service-role call. Obligation (f) below pins that it stays there.

const { fromMock, rpcMock, computeScoreSpy, recordExamResultMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  computeScoreSpy: vi.fn(),
  recordExamResultMock: vi.fn(),
}));

// actions.ts imports "server-only" (throws outside a Next server/react-server bundle)
// → stub, same pattern as getResult.int.test.ts/rating.int.test.ts.
vi.mock("server-only", () => ({}));

// Mock boundary: Supabase client only (backend DD Test Boundaries) — proves JS call
// construction/mapping correctness; no real-Postgres semantics are newly introduced
// by this additive change.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock, rpc: rpcMock })),
}));

// service-role module: mocked at the same sanctioned boundary. It imports
// "server-only" and would build a real privileged client otherwise.
vi.mock("@/lib/supabase/service-role", () => ({
  recordExamResult: recordExamResultMock,
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

/** Wires fromMock/rpcMock for submitExam()'s full call chain: exam_attempts
 * (select) -> exams -> claim_attempt_answer_key (RPC: locks + returns the answer
 * key) -> attempt_answers (upsert) -> exam_results (insert), mirroring
 * getResult.int.test.ts's mockGetResultChain structure. `attemptRow.status`
 * drives whether submitExam proceeds to scoring or redirects early;
 * `examAttemptsUpdateMock` exists only so obligation (e) can prove it is never
 * called — the lock belongs to the RPC now. */
function mockSubmitExamChain(attemptRow: { id: string; exam_id: string; status: string }) {
  const attemptAnswersUpsertMock = vi.fn(async () => ({ error: null }));
  const examResultsInsertMock = vi.fn(async () => ({ error: null }));
  const examAttemptsUpdateMock = vi.fn(() => ({
    eq: async () => ({ error: null }),
  }));

  recordExamResultMock.mockResolvedValue({ error: null });

  rpcMock.mockImplementation(async (fn: string) => {
    if (fn === "claim_attempt_answer_key") return { data: QUESTION_ROWS, error: null };
    throw new Error(`unexpected rpc: ${fn}`);
  });

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
    if (table === "attempt_answers") {
      return { upsert: attemptAnswersUpsertMock };
    }
    // exam_results is deliberately NOT wired: reaching for it through the
    // user's client is now a permission error in production, so a call here
    // must fail the test loudly rather than pass against a friendly mock.
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    attemptAnswersUpsertMock,
    examResultsInsertMock,
    examAttemptsUpdateMock,
  };
}

/** Exactly the tables submitExam() may touch through the STUDENT's own client.
 *  exam_results is absent by design (Critical #2) — see obligation (f). */
const EXPECTED_USER_CLIENT_TABLES = [
  "exam_attempts",
  "exams",
  "attempt_answers",
];

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

/** schema.sql is the DDL this project applies by hand in the Supabase SQL Editor —
 * there is no migration tool, so it IS the deployed contract for the RPC's shape. */
const SCHEMA_SQL = readFileSync(resolve(__dirname, "../../../supabase/schema.sql"), "utf8");

describe("submitExam() — answer key arrives via claim_attempt_answer_key; row-to-Question mapping correctly populates essayAnswer (Test 1)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    recordExamResultMock.mockReset();
    computeScoreSpy.mockClear();
  });

  it("obligation (a): the answer key is fetched through claim_attempt_answer_key(attemptId), and that function still projects essay_answer alongside the other answer columns", async () => {
    mockSubmitExamChain({
      id: ATTEMPT_ID,
      exam_id: EXAM_ID,
      status: "in_progress",
    });

    await callSubmitExam(ATTEMPT_ID, { q1: "1260", q2: "B" });

    // JS half — exactly one call, on the locking RPC, for this attempt. A plain
    // .from("questions") read would now fail in production with 42501, so the
    // *shape* of this call is the thing worth pinning.
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("claim_attempt_answer_key", {
      p_attempt_id: ATTEMPT_ID,
    });

    // SQL half — the column list SA-BE-012 is about moved into the function's
    // RETURNS TABLE. Dropping essay_answer there is exactly the silent
    // production no-op the original select-string assertion guarded against;
    // no mock can see it, so assert on the DDL itself.
    const returnsTable = /create function public\.exam_answer_key[\s\S]*?\)\s*\nlanguage sql/.exec(
      SCHEMA_SQL
    );
    expect(returnsTable).not.toBeNull();
    expect(returnsTable![0]).toContain("essay_answer");
    // Additive, not replacing — the pre-existing sub_answers/correct_answer stay.
    expect(returnsTable![0]).toContain("sub_answers");
    expect(returnsTable![0]).toContain("correct_answer");
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

  it("obligation (e): the attempt is locked by the RPC only — submitExam never issues its own exam_attempts update (security guard, Critical #1)", async () => {
    const { examAttemptsUpdateMock } = mockSubmitExamChain({
      id: ATTEMPT_ID,
      exam_id: EXAM_ID,
      status: "in_progress",
    });

    await callSubmitExam(ATTEMPT_ID, { q1: "1260", q2: "B" });

    // The whole reason handing the answer key to a student-JWT call is safe is
    // that claim_attempt_answer_key() closes the attempt in the SAME transaction,
    // before returning a single row. Re-adding an app-side
    // `.from("exam_attempts").update({status:'submitted'})` after scoring would
    // look harmless and pass every output assertion, while signalling that the
    // lock had been moved back out of the DB.
    expect(examAttemptsUpdateMock).not.toHaveBeenCalled();
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual(EXPECTED_USER_CLIENT_TABLES);
  });

  it("obligation (f): the score is written through the service-role path, never through the student's own client (security guard, Critical #2)", async () => {
    mockSubmitExamChain({ id: ATTEMPT_ID, exam_id: EXAM_ID, status: "in_progress" });

    await callSubmitExam(ATTEMPT_ID, { q1: "1260", q2: "B" });

    // `authenticated` has no INSERT on exam_results any more (§11a), so a
    // regression to `supabase.from("exam_results").insert(...)` is a 42501 in
    // production. The mock refuses that table outright, and this pins the
    // positive side: exactly one service-role write, carrying the score
    // computeScore actually produced — and no user_id argument, because
    // record_exam_result() derives the owner from the attempt (§11b).
    expect(fromMock.mock.calls.map(([table]) => table)).not.toContain("exam_results");
    expect(recordExamResultMock).toHaveBeenCalledTimes(1);

    const [attemptIdArg, scoreArg] = recordExamResultMock.mock.calls[0];
    expect(attemptIdArg).toBe(ATTEMPT_ID);
    expect(recordExamResultMock.mock.calls[0]).toHaveLength(2);
    expect(scoreArg).toBe(computeScoreSpy.mock.results[0].value);
  });

  it("obligation (g): a failed service-role write surfaces as a thrown error and never redirects to a result page that has no result row", async () => {
    mockSubmitExamChain({ id: ATTEMPT_ID, exam_id: EXAM_ID, status: "in_progress" });
    recordExamResultMock.mockResolvedValue({
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });

    // Must NOT be swallowed: the attempt is already locked 'submitted' by then,
    // so silently redirecting would strand the user on a result page whose row
    // was never written.
    await expect(submitExam(ATTEMPT_ID, { q1: "1260", q2: "B" })).rejects.toThrow(
      /Could not save your result/
    );
  });
});
