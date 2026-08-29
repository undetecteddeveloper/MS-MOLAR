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
//   (e) Round-trip no-regression guard — the collapsed join must never be
//       re-split into SEQUENTIAL round trips. Engine 1 added a second
//       exam_results read (the cross-attempt wrong-twice history) issued inside
//       the same Promise.all, so a call count alone can no longer tell
//       "parallel" apart from "re-split": the obligation is therefore proven by
//       holding BOTH reads open on their own gates and asserting both were
//       issued while NEITHER had resolved. Holding only one open would make the
//       guard directional — the opposite sequential ordering would stay green.
//       Re-splitting would undo the optimization while every output assertion
//       still passed.
//   (f) hasBeenWrongTwice end-to-end (Engine 1 backend task 09) — the flag is
//       computed from the cross-attempt history and applied only to scored,
//       incorrect rows, and the history read is UNSCOPED (no .eq() narrowing it
//       to one exam/attempt). Obligations (a)-(e) all pass with the history
//       mapped to nothing, i.e. with the feature permanently dead; this is the
//       only one that fails. It needs a thenable fake builder, because the
//       history read awaits the builder directly rather than .maybeSingle().
//   (g) Additive-enrichment degradation — a failing history read must NOT reject
//       getResult(). The joined read stays fail-loud (no row means no page), but
//       this one is display gating: on error it logs and yields an EMPTY history,
//       so no row can be flagged. UI Spec § D1 / AC-024 defines false and absent
//       as the same fail-closed state ("Absent/false = affordance does not
//       render"), so the mapping formula is applied unchanged and needs no
//       "history unavailable" mode of its own.
//       Without this, a transient failure of a feature the page shipped without
//       would break the whole already-live result-detail page.
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
// attempt on it. Obligation (e) counts that trip as the .rpc() rather than as a
// second .from().

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
        // Lệnh đọc lịch sử wrong-twice đi qua `readBounded` (P3), nó áp biên bằng
        // .limit() trước khi await builder.
        limit: () => builder,
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
    //
    // The join is located by its SHAPE, not by call index: two exam_results reads
    // now share this recorder (the join and the cross-attempt history read), and
    // swapping the two entries inside getResult()'s Promise.all is behaviour-
    // identical yet would flip the index and fail this obligation spuriously.
    const selectArgs = examResultsSelectMock.mock.calls.map(([arg]) => arg as string);
    const joinSelectArg = selectArgs.find((arg) => arg.includes("exam_attempts!inner("));
    expect(joinSelectArg).toBeDefined();
    expect(joinSelectArg).toContain("started_at");
    expect(joinSelectArg).toContain("submitted_at");
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

  it("obligation (e): the joined read and the cross-attempt history read are both in flight before EITHER resolves, and the answer key still costs exactly one further round trip (no-regression guard on the round-trip collapse)", async () => {
    // Deliberately NOT mockGetResultChain: this obligation needs BOTH exam_results
    // reads held open mid-flight, which that shared helper cannot express. Holding
    // only one open makes the guard directional — the opposite sequential ordering
    // (history first, then join) would stay green.
    let joinSettled = false;
    let historySettled = false;
    let releaseJoin!: () => void;
    let releaseHistory!: () => void;
    const joinGate = new Promise<void>((resolve) => {
      releaseJoin = resolve;
    });
    const historyGate = new Promise<void>((resolve) => {
      releaseHistory = resolve;
    });

    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "exam_answer_key") return { data: QUESTION_ROWS, error: null };
      throw new Error(`unexpected rpc: ${fn}`);
    });

    fromMock.mockImplementation((table: string) => {
      if (table !== "exam_results") throw new Error(`unexpected table: ${table}`);
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        limit: () => builder,
        // The joined read completes through maybeSingle()...
        maybeSingle: async () => {
          await joinGate;
          joinSettled = true;
          return {
            data: {
              ...RESULT_ROW,
              exam_attempts: {
                started_at: "2026-07-20T10:00:00.000Z",
                submitted_at: "2026-07-20T10:30:00.000Z",
                exams_with_difficulty: EMBEDDED_EXAM,
              },
            },
            error: null,
          };
        },
        // ...the history read awaits the builder itself (PostgREST builders are
        // thenable), so its trip completes here instead.
        then: (onFulfilled: (value: unknown) => unknown) =>
          historyGate.then(() => {
            historySettled = true;
            return onFulfilled({ data: [], error: null });
          }),
      };
      return builder;
    });

    const pending = getResult(ATTEMPT_ID);
    // A macrotask boundary drains every pending microtask, so by this point the
    // implementation has issued every read it is going to issue before either
    // gate opens. Deterministic, not a race.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Was 4 SEQUENTIAL round trips (exam_results -> exam_attempts -> exams_with_
    // difficulty -> questions, ~816ms measured); the embed collapses the first 3
    // into one (~385ms). A future edit that re-splits them would silently undo
    // that without failing any output assertion.
    //
    // Engine 1 added a 2nd exam_results read (the cross-attempt history) inside
    // the SAME Promise.all, so counting .from() calls no longer distinguishes
    // "parallel" from "re-split". The property guarded instead is symmetric:
    // both reads are already issued while NEITHER has resolved. Either sequential
    // ordering — join-then-history or history-then-join — leaves exactly one call
    // recorded here and fails.
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual(["exam_results", "exam_results"]);
    expect({ joinSettled, historySettled }).toEqual({ joinSettled: false, historySettled: false });

    releaseJoin();
    releaseHistory();
    await pending;

    // What is NOT guarded by this obligation: the cost of the parallel reads
    // themselves (a 3rd parallel exam_results read would still pass the check
    // above once added to this literal), nor what the history read returns —
    // that is obligation (f)'s job. What IS guarded: nothing becomes sequential,
    // and the answer key still costs exactly one further trip, keyed off the exam
    // the join already resolved (no extra lookup) — it became an RPC when the
    // answer columns were locked down (Critical #1).
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual(["exam_results", "exam_results"]);
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

  it("obligation (f): hasBeenWrongTwice is computed from the UNSCOPED cross-attempt history and applied only to scored, incorrect rows", async () => {
    // The attempt being viewed — the three branches of the gating formula
    // (scored+wrong / correct / unscored), authored by hand.
    const viewedPerQuestion = [
      { questionId: "q-wrong-twice", selected: "A", isCorrect: false, scored: true },
      { questionId: "q-correct", selected: "B", isCorrect: true, scored: true },
      { questionId: "q-essay", selected: "bài làm", isCorrect: false, scored: false },
    ];
    // This user's FULL exam_results history, i.e. what the unscoped read returns.
    // q-wrong-twice: scored-wrong on 2 DISTINCT attempts        -> eligible.
    // q-essay:       wrong on those same 2 attempts but scored:false -> never eligible.
    // q-correct:     correct throughout                          -> not eligible.
    const historyRows = [
      { attempt_id: "attempt-1", per_question: viewedPerQuestion },
      {
        attempt_id: "attempt-2",
        per_question: [
          { questionId: "q-wrong-twice", selected: "C", isCorrect: false, scored: true },
          { questionId: "q-correct", selected: "B", isCorrect: true, scored: true },
          { questionId: "q-essay", selected: "bài làm", isCorrect: false, scored: false },
        ],
      },
    ];

    const historyEqCalls: unknown[][] = [];
    let historySelectArg = "";

    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "exam_answer_key") return { data: QUESTION_ROWS, error: null };
      throw new Error(`unexpected rpc: ${fn}`);
    });

    fromMock.mockImplementation((table: string) => {
      if (table !== "exam_results") throw new Error(`unexpected table: ${table}`);
      let isHistoryRead = false;
      const builder: Record<string, unknown> = {
        select: (arg: string) => {
          isHistoryRead = !arg.includes("exam_attempts!inner(");
          if (isHistoryRead) historySelectArg = arg;
          return builder;
        },
        eq: (...args: unknown[]) => {
          if (isHistoryRead) historyEqCalls.push(args);
          return builder;
        },
        limit: () => builder,
        maybeSingle: async () => ({
          data: {
            ...RESULT_ROW,
            per_question: viewedPerQuestion,
            exam_attempts: {
              started_at: "2026-07-20T10:00:00.000Z",
              submitted_at: "2026-07-20T10:30:00.000Z",
              exams_with_difficulty: EMBEDDED_EXAM,
            },
          },
          error: null,
        }),
        // PostgREST query builders are THENABLE and the history read awaits the
        // builder directly (no .maybeSingle()). Without this, `await builder`
        // yields the builder object, data/error destructure to undefined, the
        // history degrades to [] — and mapping it to nothing would pass every
        // other obligation in this file while the feature is permanently dead.
        then: (onFulfilled: (value: unknown) => unknown) =>
          Promise.resolve().then(() => onFulfilled({ data: historyRows, error: null })),
      };
      return builder;
    });

    const result = await getResult(ATTEMPT_ID);

    expect(result).not.toBeNull();
    const [wrongTwiceRow, correctRow, essayRow] = result!.result.perQuestion;

    // Scored + currently wrong + wrong on >=2 distinct attempts -> true, with every
    // pre-existing field of the row carried through untouched.
    expect(wrongTwiceRow).toEqual({
      questionId: "q-wrong-twice",
      selected: "A",
      isCorrect: false,
      scored: true,
      hasBeenWrongTwice: true,
    });
    // The flag is meaningless for a correct row and for an unscored row: undefined,
    // not false (UI Spec D1's rule, applied consumer-side by getResult()).
    expect(correctRow.questionId).toBe("q-correct");
    expect(correctRow.hasBeenWrongTwice).toBeUndefined();
    expect(essayRow.questionId).toBe("q-essay");
    expect(essayRow.hasBeenWrongTwice).toBeUndefined();

    // The history read must span ALL of the user's attempts. RLS (results_select_own)
    // already scopes it to the caller, so any .eq() here would narrow it further —
    // that is where the real per-exam/per-attempt scoping failure mode lives, and it
    // is unrepresentable in computeWrongTwiceQuestionIds() itself (its input type
    // carries no exam identity at all).
    expect(historyEqCalls).toEqual([]);
    // attempt_id is what makes "2 DISTINCT attempts" countable; dropping it would
    // collapse every row into a single anonymous attempt.
    expect(historySelectArg).toContain("attempt_id");
    expect(historySelectArg).toContain("per_question");
  });

  it("obligation (g): a failing history read degrades to no flag instead of rejecting the whole page", async () => {
    // Same viewed attempt as (f) — its first row WOULD be hasBeenWrongTwice:true
    // if the history read had succeeded, so this fixture isolates the degradation.
    const viewedPerQuestion = [
      { questionId: "q-wrong-twice", selected: "A", isCorrect: false, scored: true },
      { questionId: "q-correct", selected: "B", isCorrect: true, scored: true },
    ];
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "exam_answer_key") return { data: QUESTION_ROWS, error: null };
      throw new Error(`unexpected rpc: ${fn}`);
    });

    fromMock.mockImplementation((table: string) => {
      if (table !== "exam_results") throw new Error(`unexpected table: ${table}`);
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        limit: () => builder,
        // The joined read still succeeds: the page's core data is fine, which is
        // exactly the situation in which rejecting would be the wrong behaviour.
        maybeSingle: async () => ({
          data: {
            ...RESULT_ROW,
            per_question: viewedPerQuestion,
            exam_attempts: {
              started_at: "2026-07-20T10:00:00.000Z",
              submitted_at: "2026-07-20T10:30:00.000Z",
              exams_with_difficulty: EMBEDDED_EXAM,
            },
          },
          error: null,
        }),
        then: (onFulfilled: (value: unknown) => unknown) =>
          Promise.resolve().then(() =>
            onFulfilled({ data: null, error: { code: "57014", message: "statement timeout" } })
          ),
      };
      return builder;
    });

    const result = await getResult(ATTEMPT_ID);

    // Resolves rather than rejecting — the already-shipped result-detail page
    // keeps working when only this additive enrichment fails.
    expect(result).not.toBeNull();
    expect(result!.examId).toBe("exam-1");
    expect(result!.examTitle).toBe("Sample Exam");
    expect(result!.result.totalScore).toBe(8.5);
    // Fail-closed per UI Spec § D1 / AC-024, which treats false and absent
    // identically ("hasBeenWrongTwice false or absent -> shall not render").
    // The degraded history is an EMPTY history, so the Reference Contract's
    // formula is applied unchanged and a scored+wrong row yields false — not
    // undefined. Forcing undefined here would mean teaching the mapping to tell
    // "history unavailable" apart from "history empty": a new mode for zero
    // observable difference. The property that matters is that it is never true.
    expect(result!.result.perQuestion[0].questionId).toBe("q-wrong-twice");
    expect(result!.result.perQuestion[0].hasBeenWrongTwice).toBe(false);
    // The correct row is still gated out entirely.
    expect(result!.result.perQuestion[1].hasBeenWrongTwice).toBeUndefined();

    // The degradation is logged, not swallowed — and the log carries no row content.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warnSpy.mock.calls[0])).toContain("57014");
    expect(JSON.stringify(warnSpy.mock.calls[0])).not.toContain("q-wrong-twice");

    warnSpy.mockRestore();
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

// =============================================================================
// Test 3 — getResult(): created_at in the select, and the three derived essay
//          fields attached at read time (ADR-0018, Task B2.1)
// =============================================================================
// AC: EG-BE-023 (deadline boundary, EXCLUSIVE `>`), EG-BE-024/025 (missing key
//   is silent; an unrecognised value warns exactly once and never carries the
//   student's writing), EG-BE-026 (`retryAvailable` is a boolean and no attempt
//   count crosses to the client), EG-BE-027 (only `graded` contributes to earned
//   AND max), EG-BE-031/AC-012 (a row written before the feature ships reads out
//   identically to today).
// @lane: integration
// @dependency: SOURCE/app/(layer2)/queries.ts (getResult) + REAL
//   SOURCE/lib/scoring/essayLifecycle.ts + mocked Supabase client
// @real-dependency: none — the same sanctioned createClient() boundary as Test 2.
//
// WHAT THIS FILE ADDS OVER essayLifecycle's own unit tests, which is the only
// thing that justifies the cases being here: H1 proves the derivations. This
// proves the QUERY LAYER feeds them correctly — that `created_at` is actually
// requested, that the value handed to `deriveEssayView` is `exam_results`'s own
// timestamp and not the attempt's, and that one frozen `now` is shared by all
// three attachments. None of that is visible to a pure-function test.
//
// TIME IS FROZEN, never read from the real clock: the deadline is 600 000 ms and
// the boundary is exclusive, so a real clock turns the three cases below into
// three time bombs — green today, red on an afternoon nobody touched them.

const ESSAY_NOW = new Date("2026-08-29T12:00:00.000Z");
const DEADLINE_MS = 600_000;

/** created_at values expressed as an offset from the frozen `now`, so the
 *  relationship each case is about is visible at the call site rather than
 *  hidden inside two ISO strings the reader has to subtract. */
function createdAtBefore(ms: number): string {
  return new Date(ESSAY_NOW.getTime() - ms).toISOString();
}

const ESSAY_EXAM = { id: "exam-essay", title: "Đề có câu tự luận", subject: "Ngữ văn" };
const ESSAY_STARTED_AT = "2026-08-29T11:00:00.000Z";
const ESSAY_SUBMITTED_AT = "2026-08-29T11:50:00.000Z";

/** A stored `per_question` element with no `essay*` key at all — the legacy /
 *  feature-off shape, byte-identical to what `computeScore()` emits today. */
const LEGACY_ELEMENT = {
  questionId: "q-essay",
  selected: "Bài làm của học sinh, không bao giờ được vào log.",
  isCorrect: false,
  scored: false,
};

function pendingElement(overrides: Record<string, unknown> = {}) {
  return {
    ...LEGACY_ELEMENT,
    essayState: "pending",
    essayEarned: null,
    essayMax: null,
    essayLowConfidence: false,
    essayAttempts: 0,
    ...overrides,
  };
}

/** Wires the mocked client for getResult()'s two round trips with an essay-shaped
 *  result row. Deliberately a separate helper from `mockGetResultChain`: this one
 *  drives `per_question` and `created_at`, which that one does not express, and
 *  widening the shared helper would make Test 2's fixtures depend on this task. */
function mockEssayResultChain(perQuestion: unknown[], createdAt: string) {
  rpcMock.mockImplementation(async (fn: string) => {
    if (fn === "exam_answer_key") return { data: [], error: null };
    throw new Error(`unexpected rpc: ${fn}`);
  });

  const selectArgs: string[] = [];

  fromMock.mockImplementation((table: string) => {
    if (table !== "exam_results") throw new Error(`unexpected table: ${table}`);
    const builder: Record<string, unknown> = {
      select: (arg: string) => {
        selectArgs.push(arg);
        return builder;
      },
      eq: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({
        data: {
          total_score: 5,
          correct: 1,
          total: 2,
          per_question: perQuestion,
          topic_breakdown: [{ topic: "Nghị luận", correct: 1, total: 1 }],
          overtime_seconds: 0,
          created_at: createdAt,
          exam_attempts: {
            started_at: ESSAY_STARTED_AT,
            submitted_at: ESSAY_SUBMITTED_AT,
            exams_with_difficulty: ESSAY_EXAM,
          },
        },
        error: null,
      }),
    };
    return builder;
  });

  return { selectArgs };
}

describe("getResult() — created_at in the select and the three derived essay fields (Test 3)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(ESSAY_NOW);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.useRealTimers();
  });

  it("the joined select requests exam_results.created_at (D-02 — it was absent before this task)", async () => {
    const { selectArgs } = mockEssayResultChain([pendingElement()], createdAtBefore(0));

    await getResult(ATTEMPT_ID);

    // Located by shape, not by index — two exam_results reads share this recorder.
    const joinSelectArg = selectArgs.find((arg) => arg.includes("exam_attempts!inner("));
    expect(joinSelectArg).toBeDefined();
    expect(joinSelectArg).toContain("created_at");
    // NOT satisfied by the attempt's timestamps: the deadline is measured from
    // when the RESULT row was written, and the two differ by however long
    // record_exam_result() took. A select carrying only submitted_at would pass
    // any assertion made on the mapped output, because the mock hands back
    // whatever it is asked for.
    expect(joinSelectArg).toMatch(/(^|,\s*)created_at(\s*,|,|$)/);
  });

  it.each([
    ["599 999 ms — under the deadline", DEADLINE_MS - 1, "pending"],
    ["exactly 600 000 ms — ON the deadline, still pending (EXCLUSIVE >)", DEADLINE_MS, "pending"],
    ["600 001 ms — past the deadline", DEADLINE_MS + 1, "failed"],
  ])(
    "EG-BE-023 deadline boundary: created_at %s ⇒ state %s",
    async (_label, age, expected) => {
      mockEssayResultChain([pendingElement()], createdAtBefore(age as number));

      const result = await getResult(ATTEMPT_ID);

      // The middle case is the one that matters. `>=` instead of `>` flips it and
      // nothing else in the suite would notice: an attempt read at exactly the
      // deadline would be told its grading failed while a writer could still be
      // alive.
      expect(result!.result.perQuestion[0].essay?.state).toBe(expected);
    },
  );

  it("EG-BE-024: an element with no essay key yields essay === undefined and logs NOTHING", async () => {
    mockEssayResultChain([LEGACY_ELEMENT], createdAtBefore(DEADLINE_MS * 10));

    const result = await getResult(ATTEMPT_ID);

    expect(result!.result.perQuestion[0].essay).toBeUndefined();
    // A warning per legacy question per render would turn every old result page
    // into a log flood, and the deadline being long past must not change that.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("EG-BE-025: an unrecognised essayState yields undefined, warns EXACTLY once, and the warning never carries the student's writing", async () => {
    mockEssayResultChain(
      [pendingElement({ essayState: "in_review" })],
      createdAtBefore(0),
    );

    const result = await getResult(ATTEMPT_ID);

    expect(result!.result.perQuestion[0].essay).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledTimes(1);

    // AC-056: the student's answer is UGC and never reaches a server log. Assert
    // on the serialised payload rather than on the object's shape — the failure
    // this guards is prose arriving through some field nobody thought about.
    const logged = JSON.stringify(warnSpy.mock.calls[0]);
    expect(logged).toContain("q-essay");
    expect(logged).toContain("in_review");
    expect(logged).not.toContain("Bài làm của học sinh");
  });

  it("EG-BE-025 second half: a mixed row warns once for the bad element and the summary counts only the derivable ones", async () => {
    // The filtering that keeps the warning count at one must not also drop a
    // GOOD element from the aggregates. This is the case that separates
    // "warned once" from "warned once because it stopped looking".
    mockEssayResultChain(
      [
        pendingElement({
          questionId: "q-graded",
          essayState: "graded",
          essayEarned: 0.5,
          essayMax: 1,
        }),
        pendingElement({ questionId: "q-broken", essayState: "in_review" }),
      ],
      createdAtBefore(0),
    );

    const result = await getResult(ATTEMPT_ID);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(result!.essaySummary).toEqual({
      earned: 0.5,
      max: 1,
      gradedCount: 1,
      pendingCount: 0,
      failedCount: 0,
      unresolvedCount: 0,
    });
    expect(result!.result.perQuestion[0].essay?.state).toBe("graded");
    expect(result!.result.perQuestion[1].essay).toBeUndefined();
  });

  it("EG-BE-026: the client-facing essay view carries a BOOLEAN retryAvailable and no attempt count under any name", async () => {
    mockEssayResultChain(
      [pendingElement({ essayState: "failed", essayAttempts: 1 })],
      createdAtBefore(0),
    );

    const result = await getResult(ATTEMPT_ID);
    const view = result!.result.perQuestion[0].essay!;

    expect(typeof view.retryAvailable).toBe("boolean");
    expect(view.retryAvailable).toBe(true);
    // Exhaustive key set, not "essayAttempts is absent": AC-044 forbids the
    // COUNT reaching the client, and a count renamed on the way out would pass
    // any assertion that only checks the old name.
    expect(Object.keys(view).sort()).toEqual([
      "earned",
      "lowConfidence",
      "max",
      "retryAvailable",
      "state",
    ]);
    expect(JSON.stringify(view)).not.toContain("1");
  });

  it("EG-BE-027: only a graded essay contributes to earned AND to max; hasIncompleteEssay is true when one essay has stopped at RS-6", async () => {
    mockEssayResultChain(
      [
        pendingElement({
          questionId: "q-graded",
          essayState: "graded",
          essayEarned: 0.75,
          essayMax: 1,
          essayAttempts: 1,
        }),
        pendingElement({ questionId: "q-pending" }),
        pendingElement({
          questionId: "q-exhausted",
          essayState: "failed",
          essayAttempts: 3,
        }),
      ],
      createdAtBefore(0),
    );

    const result = await getResult(ATTEMPT_ID);

    // Independently authored: 1 graded question ⇒ max is 1, NOT 3. A failed essay
    // adding 0 to earned and 1 to max is the silent zero AC-015 forbids, and it
    // would look entirely reasonable at the point someone wrote it.
    expect(result!.essaySummary).toEqual({
      earned: 0.75,
      max: 1,
      gradedCount: 1,
      pendingCount: 1,
      failedCount: 1,
      unresolvedCount: 1,
    });
    // RS-6 = failed AND out of retries. q-exhausted is the only one.
    expect(result!.hasIncompleteEssay).toBe(true);
  });

  it("EG-BE-031 / AC-012: a legacy row reads out IDENTICALLY to today — the whole ExamResult equals a hand-built pre-change literal", async () => {
    mockEssayResultChain([LEGACY_ELEMENT], createdAtBefore(DEADLINE_MS * 10));

    const result = await getResult(ATTEMPT_ID);

    // Hand-built from the mocked row above, in the shape getResult() returned
    // BEFORE this task — plus the one required new field. This is AC-012's
    // sharpest edge: if an old row grows a populated field, "no backfill" broke
    // on the READ path, where it is much harder to see than on the write path.
    expect(result).toEqual({
      examId: "exam-essay",
      examTitle: "Đề có câu tự luận",
      subject: "Ngữ văn",
      result: {
        totalScore: 5,
        correct: 1,
        total: 2,
        perQuestion: [
          {
            questionId: "q-essay",
            selected: "Bài làm của học sinh, không bao giờ được vào log.",
            isCorrect: false,
            scored: false,
          },
        ],
        topicBreakdown: [{ topic: "Nghị luận", correct: 1, total: 1 }],
      },
      questions: {},
      startedAt: ESSAY_STARTED_AT,
      submittedAt: ESSAY_SUBMITTED_AT,
      overtimeSeconds: 0,
      hasIncompleteEssay: false,
    });

    // `toEqual` treats a key holding `undefined` as absent, so the two fields
    // that must be ABSENT-OR-UNDEFINED are asserted on their own rather than
    // being trusted to the comparison above.
    expect(result!.essaySummary).toBeUndefined();
    expect(result!.result.perQuestion.every((r) => r.essay === undefined)).toBe(true);
    // Required, always computable — a PDF annotation cannot be decided by an
    // `undefined`, so the type being `boolean` is only half the guarantee.
    expect(typeof result!.hasIncompleteEssay).toBe("boolean");
  });
});
