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

// =============================================================================
// Skeleton -> real tests (backend task 13). Written Red-before-Green in the same
// commit as SOURCE/app/(layer2)/tutorActions.ts, this repo's convention.
// =============================================================================

import { beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, guardMock, generateHintMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  guardMock: vi.fn(),
  generateHintMock: vi.fn(),
}));

// tutorActions.ts pulls in "server-only" transitively (supabase/server, gemini) —
// stub it, same pattern as getResult.int.test.ts / submitExam.int.test.ts.
vi.mock("server-only", () => ({}));

// Mock boundary 1 — the Supabase client (sanctioned per the header above).
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

// Mock boundary 2 — guard() only. RATE_LIMITS stays REAL: `guard()`'s parameter
// type is `keyof typeof RATE_LIMITS`, so the new `explainStep` member is proven
// by tsc rather than by a runtime assertion here; replacing the whole module
// would throw that proof away.
vi.mock("@/lib/security/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/security/rateLimit")>()),
  guard: guardMock,
}));

// Mock boundary 3 — the Gemini-facing call only. TutorCallError stays REAL so the
// failure fixtures below are the exact error class the implementation classifies
// on (a hand-rolled look-alike would let an `instanceof`-less implementation pass).
vi.mock("@/lib/tutor/callTutor", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tutor/callTutor")>()),
  generateHint: generateHintMock,
}));

const { TutorCallError } = await import("@/lib/tutor/callTutor");
const { explainStep } = await import("../tutorActions");

const USER_ID = "user-1";
/** Lượt đang xem. */
const ATTEMPT_ID = "attempt-2";
const OTHER_ATTEMPT_ID = "attempt-1";
const OLDEST_ATTEMPT_ID = "attempt-0";
/** Sai ở CẢ HAI lượt → thuộc tập wrong-twice do computeWrongTwiceQuestionIds() tính. */
const Q_ELIGIBLE = "q-wrong-twice";
/** Sai ở ĐÚNG MỘT lượt (chính lượt đang xem) → KHÔNG đủ điều kiện. Cố ý vẫn là
 *  câu SAI và CÓ CHẤM trong lượt hiện tại, nên điều kiện duy nhất nó trượt là
 *  ngưỡng "2 lượt khác nhau" — tức chính thứ mà test 1 muốn chứng minh là cổng. */
const Q_NOT_ELIGIBLE = "q-not-eligible";
/** Nửa còn lại của cổng, ngược chiều Q_NOT_ELIGIBLE: sai ở hai lượt CŨ nên CÓ
 *  nằm trong tập wrong-twice, nhưng ở chính lượt đang xem thì em ấy đã làm
 *  ĐÚNG. Không được kèm — và đây là ca nguy hiểm nhất trong ba ca, vì `selected`
 *  của một câu đã làm đúng chính là đáp án đúng. */
const Q_FIXED_IN_THIS_ATTEMPT = "q-fixed-in-this-attempt";

/** Nếu bất kỳ trường đáp án nào của fixture lọt vào payload telemetry HOẶC vào
 *  ngữ cảnh gửi Gemini, chuỗi này hiện ra trong JSON của lời gọi tương ứng (kỹ
 *  thuật sentinel của telemetry.test.ts/prompt.test.ts). */
const ANSWER_KEY_SENTINEL = "ANSWER-KEY-SENTINEL-DO-NOT-LEAK";

/** exam_results rows (DB shape) — đúng projection "attempt_id, per_question".
 *  `correct` mang sentinel: PerQuestionResult CÓ trường đáp án, nên đây là một
 *  đường rò thật chứ không phải giả định. */
const HISTORY_ROWS = [
  {
    attempt_id: OLDEST_ATTEMPT_ID,
    per_question: [
      {
        questionId: Q_FIXED_IN_THIS_ATTEMPT,
        selected: "A",
        correct: ANSWER_KEY_SENTINEL,
        isCorrect: false,
        scored: true,
      },
    ],
  },
  {
    attempt_id: OTHER_ATTEMPT_ID,
    per_question: [
      {
        questionId: Q_ELIGIBLE,
        selected: "A",
        correct: ANSWER_KEY_SENTINEL,
        isCorrect: false,
        scored: true,
      },
      {
        questionId: Q_FIXED_IN_THIS_ATTEMPT,
        selected: "A",
        correct: ANSWER_KEY_SENTINEL,
        isCorrect: false,
        scored: true,
      },
    ],
  },
  {
    attempt_id: ATTEMPT_ID,
    per_question: [
      {
        questionId: Q_ELIGIBLE,
        selected: "C",
        correct: ANSWER_KEY_SENTINEL,
        isCorrect: false,
        scored: true,
      },
      {
        questionId: Q_NOT_ELIGIBLE,
        selected: "D",
        correct: ANSWER_KEY_SENTINEL,
        isCorrect: false,
        scored: true,
      },
      {
        // `selected` = chính đáp án đúng, vì em ấy làm đúng câu này ở lượt này.
        questionId: Q_FIXED_IN_THIS_ATTEMPT,
        selected: ANSWER_KEY_SENTINEL,
        correct: ANSWER_KEY_SENTINEL,
        isCorrect: true,
        scored: true,
      },
    ],
  },
];

/** questions row (DB shape). Ba cột đáp án đã bị REVOKE khỏi role `authenticated`
 *  (§10c) nên đường đọc thật không bao giờ nhận được chúng — vẫn đặt vào fixture
 *  để chứng minh call site không nhét chúng vào telemetry kể cả khi hàng dữ liệu
 *  có mang theo. */
const QUESTION_ROW = {
  content: "Giải phương trình $x^2 - 5x + 6 = 0$.",
  question_type: "mcq",
  choices: [
    { id: "A", text: "$x = 1$ hoặc $x = 6$" },
    { id: "B", text: "$x = 2$ hoặc $x = 3$" },
  ],
  correct_answer: ANSWER_KEY_SENTINEL,
  sub_answers: { a: ANSWER_KEY_SENTINEL },
  essay_answer: ANSWER_KEY_SENTINEL,
  skill_node_id: "math.quadratic-equation",
};

const HINT_TEXT = "Em thử thay $x = 2$ vào vế trái xem hai vế có bằng nhau không?";

type Scenario = {
  attempt?: { user_id: string } | null;
  history?: typeof HISTORY_ROWS;
  historyError?: { code: string; message: string } | null;
  question?: Record<string, unknown> | null;
};

/** Nối fromMock cho chuỗi gọi của explainStep(): exam_attempts (maybeSingle),
 *  exam_results (await thẳng builder — builder của PostgREST là thenable),
 *  questions (maybeSingle), telemetry_log (insert). Trả về các recorder cho
 *  từng nghĩa vụ chứng minh. */
function mockExplainStepChain(scenario: Scenario) {
  const insertPayloads: Record<string, unknown>[] = [];
  const selectArgsByTable: Record<string, string[]> = {};
  const eqArgsByTable: Record<string, unknown[][]> = {};
  const tablesTouched: string[] = [];

  fromMock.mockImplementation((table: string) => {
    tablesTouched.push(table);
    const builder: Record<string, unknown> = {
      select: (arg?: string) => {
        (selectArgsByTable[table] ??= []).push(String(arg ?? ""));
        return builder;
      },
      // Ghi lại THAM SỐ chứ không nuốt: lọc nhầm cột/nhầm khoá là lỗi hình dạng
      // truy vấn, mà đó chính là thứ ranh giới mock này tồn tại để chứng minh.
      eq: (...args: unknown[]) => {
        (eqArgsByTable[table] ??= []).push(args);
        return builder;
      },
      maybeSingle: async () => {
        if (table === "exam_attempts") return { data: scenario.attempt ?? null, error: null };
        if (table === "questions") return { data: scenario.question ?? null, error: null };
        throw new Error(`unexpected maybeSingle on ${table}`);
      },
      insert: (payload: Record<string, unknown>) => {
        insertPayloads.push(payload);
        return builder;
      },
      then: (onFulfilled: (value: unknown) => unknown) =>
        Promise.resolve(
          table === "exam_results"
            ? { data: scenario.history ?? HISTORY_ROWS, error: scenario.historyError ?? null }
            : { data: null, error: null }
        ).then(onFulfilled),
    };
    return builder;
  });

  return { insertPayloads, selectArgsByTable, eqArgsByTable, tablesTouched };
}

beforeEach(() => {
  fromMock.mockReset();
  guardMock.mockReset();
  generateHintMock.mockReset();
  // Mặc định: KHÔNG bị rate limit — mỗi test tự bật ca ngược lại nếu cần.
  guardMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
});

describe("explainStep() — Test 1 (AC-021): server-side wrong-twice re-verification is the real eligibility gate", () => {
  it("resolves { error: 'not_eligible' } for a questionId outside the server-recomputed set, and never reaches generateHint()", async () => {
    const { tablesTouched } = mockExplainStepChain({
      attempt: { user_id: USER_ID },
      question: QUESTION_ROW,
    });

    const result = await explainStep(ATTEMPT_ID, Q_NOT_ELIGIBLE);

    expect(result).toEqual({ error: "not_eligible" });
    // Bằng chứng THẬT của nghĩa vụ này: Gemini không hề được gọi. Một bản cài
    // đặt tin vào cờ hasBeenWrongTwice do client gửi lên vẫn có thể trả đúng mã
    // lỗi ở trên trong một ca khác, nhưng không thể qua được dòng dưới.
    expect(generateHintMock).toHaveBeenCalledTimes(0);
    // Và cổng ấy đọc lịch sử THẬT của user (exam_results), không phải trạng thái client.
    expect(tablesTouched).toContain("exam_results");
  });

  it("positive control: the SAME fixture history lets an eligible questionId through to generateHint()", async () => {
    // Không có ca này thì "0 lần gọi" ở test trên có thể chỉ vì hàm hỏng ở một
    // bước sớm hơn, chứ không phải vì cổng tái kiểm tra làm đúng việc.
    mockExplainStepChain({ attempt: { user_id: USER_ID }, question: QUESTION_ROW });
    generateHintMock.mockResolvedValue(HINT_TEXT);

    const result = await explainStep(ATTEMPT_ID, Q_ELIGIBLE);

    expect(result).toEqual({ hint: HINT_TEXT });
    expect(generateHintMock).toHaveBeenCalledTimes(1);
  });

  it("resolves { error: 'not_eligible' } for a question in the wrong-twice set that the student got RIGHT in this attempt — the per-attempt half of the gate", async () => {
    // Nửa còn lại của điều kiện (DD Validation bước 2): đúng là câu này đã sai ở
    // hai lượt trước, nhưng ở lượt đang xem em ấy đã làm đúng. Bỏ vế này đi thì
    // một câu ĐÃ LÀM ĐÚNG vẫn được kèm, và tệ hơn: `selected` của nó chính là
    // đáp án đúng, tức ta sẽ gửi đáp án sang Gemini làm ngữ cảnh.
    mockExplainStepChain({ attempt: { user_id: USER_ID }, question: QUESTION_ROW });

    const result = await explainStep(ATTEMPT_ID, Q_FIXED_IN_THIS_ATTEMPT);

    expect(result).toEqual({ error: "not_eligible" });
    expect(generateHintMock).toHaveBeenCalledTimes(0);
  });

  it("surfaces the typed 'server' error (not 'not_eligible') when the history read fails — a failed security-boundary read must not look like an ineligible question", async () => {
    mockExplainStepChain({
      attempt: { user_id: USER_ID },
      history: [],
      historyError: { code: "57014", message: "statement timeout" },
      question: QUESTION_ROW,
    });

    expect(await explainStep(ATTEMPT_ID, Q_ELIGIBLE)).toEqual({ error: "server" });
    expect(generateHintMock).toHaveBeenCalledTimes(0);
  });
});

describe("explainStep() — Test 2 (AC-012/AC-013): telemetry fires with a queryable, containment-safe shape on BOTH outcomes", () => {
  it("records exactly one tutor_invoke insert per invocation — success and failure alike — and neither payload can carry answer-key material", async () => {
    const { insertPayloads } = mockExplainStepChain({
      attempt: { user_id: USER_ID },
      question: QUESTION_ROW,
    });

    generateHintMock.mockResolvedValueOnce(HINT_TEXT);
    const success = await explainStep(ATTEMPT_ID, Q_ELIGIBLE);

    generateHintMock.mockRejectedValueOnce(new TutorCallError("gemini_unavailable", "finishReason"));
    const failure = await explainStep(ATTEMPT_ID, Q_ELIGIBLE);

    expect(success).toEqual({ hint: HINT_TEXT });
    expect(failure).toEqual({ error: "gemini_unavailable" });

    // "Bao nhiêu lượt gọi, của ai, bao nhiêu lượt hỏng" — cả hai lượt đều phải
    // có dòng log, kể cả lượt HỎNG (đúng chỗ dễ bị bỏ quên nhất).
    expect(insertPayloads).toHaveLength(2);
    expect(insertPayloads[0]).toMatchObject({
      event_type: "tutor_invoke",
      success: true,
      user_id: USER_ID,
      question_id: Q_ELIGIBLE,
      error_code: null,
    });
    expect(insertPayloads[1]).toMatchObject({
      event_type: "tutor_invoke",
      success: false,
      user_id: USER_ID,
      question_id: Q_ELIGIBLE,
      error_code: "gemini_unavailable",
    });
    // §19 `with check (user_id = auth.uid())` từ chối NULL với role authenticated
    // → dòng log sẽ mất trắng. Call site không bao giờ được ghi null user_id.
    for (const payload of insertPayloads) expect(payload.user_id).toBe(USER_ID);
    // AC-013 ở mức tích hợp: bổ sung cho bằng chứng đơn vị của telemetry.test.ts.
    for (const payload of insertPayloads) {
      expect(JSON.stringify(payload)).not.toContain(ANSWER_KEY_SENTINEL);
    }
  });

  it("never puts answer-key material into the context handed to Gemini either (AC-018/019 at the call site)", async () => {
    // Đường rò NGUY HIỂM hơn telemetry, và không có kiểu nào chặn giúp:
    // `questionContent`/`studentAnswer` của TutorPromptInput là chuỗi tự do, nên
    // chỉ cần nới select thành "*" rồi nối nhầm một cột, hoặc lấy `selected` từ
    // trường `correct`, là đáp án đi thẳng sang model. Fixture đã đặt sentinel ở
    // đúng ba cột đáp án của questions VÀ ở `correct` của mọi dòng per_question.
    mockExplainStepChain({ attempt: { user_id: USER_ID }, question: QUESTION_ROW });
    generateHintMock.mockResolvedValue(HINT_TEXT);

    await explainStep(ATTEMPT_ID, Q_ELIGIBLE);

    expect(generateHintMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(generateHintMock.mock.calls)).not.toContain(ANSWER_KEY_SENTINEL);
    // Kiểm chứng ngược: ngữ cảnh gửi đi có mang nội dung THẬT của câu hỏi và bài
    // làm của học sinh — nếu không, câu trên sẽ xanh một cách rỗng tuếch.
    expect(JSON.stringify(generateHintMock.mock.calls)).toContain(QUESTION_ROW.content);
    expect(generateHintMock.mock.calls[0][0]).toMatchObject({
      questionType: "mcq",
      studentAnswer: "C",
    });
  });
});

describe("explainStep() — Test 3 (AC-029): a question with skill_node_id NULL still works", () => {
  it("reaches generateHint() and resolves { hint } for an eligible untagged question, and never reads skill_node_id at all", async () => {
    const { selectArgsByTable } = mockExplainStepChain({
      attempt: { user_id: USER_ID },
      question: { ...QUESTION_ROW, skill_node_id: null },
    });
    generateHintMock.mockResolvedValue(HINT_TEXT);

    expect(await explainStep(ATTEMPT_ID, Q_ELIGIBLE)).toEqual({ hint: HINT_TEXT });
    // Call count là 1, không phải 0: chứng minh không có bước rẽ nào cắt ngang
    // trước Gemini vì cái tag rỗng.
    expect(generateHintMock).toHaveBeenCalledTimes(1);
    // Khoá CHÍNH XÁC danh sách cột, không phải "không chứa skill_node_id": một
    // phép kiểm tra theo chuỗi con vẫn cho `select("*")` đi qua, mà `*` kéo luôn
    // ba cột đáp án vượt ranh giới SQL. Một dòng này khoá cùng lúc hai thứ: cột
    // skill_node_id không được đọc (nên không thể mọc ra điều kiện
    // "skill_node_id IS NOT NULL" phá AC-029), và bộ cột an toàn §10c không được
    // nới ra.
    expect(selectArgsByTable.questions).toEqual(["content, question_type, choices"]);
  });
});

describe("explainStep() — query shape at the mocked Supabase boundary (row-identity proofs)", () => {
  it("filters the attempt read by attemptId and the question read by questionId — never the other way round", async () => {
    // Hai tham số đều là string nên hoán vị biên dịch trót lọt; ở phía server
    // thì hậu quả không phải là lỗi mà là một bài giảng cho SAI CÂU (hoặc một
    // lượt đọc nhầm dòng attempt của người khác nếu bộ lọc id rơi mất).
    const { eqArgsByTable } = mockExplainStepChain({
      attempt: { user_id: USER_ID },
      question: QUESTION_ROW,
    });
    generateHintMock.mockResolvedValue(HINT_TEXT);

    await explainStep(ATTEMPT_ID, Q_ELIGIBLE);

    expect(eqArgsByTable.exam_attempts).toEqual([["id", ATTEMPT_ID]]);
    expect(eqArgsByTable.questions).toEqual([["id", Q_ELIGIBLE]]);
    // Lịch sử wrong-twice cố ý KHÔNG lọc gì: RLS results_select_own đã giới hạn
    // về của chính người gọi, và ngưỡng "hai lượt" phải tính trên TOÀN BỘ lịch
    // sử — thêm một .eq() ở đây là thu hẹp sai phạm vi của chính cổng bảo mật.
    expect(eqArgsByTable.exam_results).toBeUndefined();
  });
});

describe("explainStep() — Test 4 (AC-022): rate limiting rejects before any Gemini call", () => {
  it("resolves { error: 'rate_limited' } (not 'server') with 0 calls to generateHint() and no question read", async () => {
    const { tablesTouched } = mockExplainStepChain({
      attempt: { user_id: USER_ID },
      question: QUESTION_ROW,
    });
    guardMock.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });

    // Câu ĐỦ điều kiện: thứ duy nhất chặn lượt gọi này là rate limit.
    const result = await explainStep(ATTEMPT_ID, Q_ELIGIBLE);

    expect(result).toEqual({ error: "rate_limited" });
    expect(generateHintMock).toHaveBeenCalledTimes(0);
    // Khoá đếm là user lấy từ dòng attempt đã lọc qua RLS, và action name phải
    // đúng member mới của RATE_LIMITS.
    expect(guardMock).toHaveBeenCalledWith("explainStep", USER_ID);
    // "Trước" chứ không chỉ "thay vì": chưa hề đọc tới câu hỏi khi bị chặn.
    expect(tablesTouched).not.toContain("questions");
  });
});
