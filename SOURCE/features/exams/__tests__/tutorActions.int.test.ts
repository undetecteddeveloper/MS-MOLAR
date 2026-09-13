// hintDuringAttempt() [integration]
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0) —
//   § explainStep(); action đổi cổng 2026-09-13 (gợi ý KHI ĐANG LÀM BÀI thay vì
//   sau khi sai hai lần), hợp đồng typed-result và các bất biến chi phí/rò rỉ
//   giữ nguyên.
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-012/013/021/022/029)
//
// Mock boundary (backend DD Test Boundaries — Mock Boundary Decisions): Supabase
//   client bên trong action — mock (tiền lệ getResult.int.test.ts /
//   rating.int.test.ts, "server-only" stub như submitExam.int.test.ts).
//   generateHint()/callTutor.ts (ranh giới Gemini) — CŨNG mock: file này chứng
//   minh phần ĐIỀU PHỐI của chính action (sở hữu/trạng thái/câu-thuộc-đề/rate
//   limit/hạn mức/telemetry), không phải vòng gọi Gemini (callTutor.test.ts).
//
// Vì sao các ca "sai hai lần" cũ không còn: cổng ấy đọc lịch sử `exam_results`
// đã nộp, mà lượt ĐANG LÀM chưa có dòng nào ở đó — giữ cổng là gia sư không bao
// giờ mở trong lúc làm bài. Cổng thay thế: lượt CỦA MÌNH (RLS) + ĐANG MỞ
// (`status = in_progress`) + câu THUỘC ĐỀ của lượt (`exams.question_ids`).

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Entitlement } from "@/lib/billing/types";

const { fromMock, guardMock, generateHintMock, consumeQuotaMock, readEntitlementMock } = vi.hoisted(
  () => ({
    fromMock: vi.fn(),
    guardMock: vi.fn(),
    generateHintMock: vi.fn(),
    consumeQuotaMock: vi.fn(),
    readEntitlementMock: vi.fn(),
  })
);

// tutorActions.ts pulls in "server-only" transitively (supabase/server, gemini) —
// stub it, same pattern as getResult.int.test.ts / submitExam.int.test.ts.
vi.mock("server-only", () => ({}));

// Mock boundary 1 — the Supabase client.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

// Mock boundary 2 — guard() only. RATE_LIMITS stays REAL: `guard()`'s parameter
// type is `keyof typeof RATE_LIMITS`, so the `explainStep` member is proven by
// tsc rather than by a runtime assertion here.
vi.mock("@/lib/security/rateLimit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/security/rateLimit")>()),
  guard: guardMock,
}));

// Mock boundary 3 — the Gemini-facing call only. TutorCallError stays REAL so the
// failure fixtures below are the exact error class the implementation classifies on.
vi.mock("@/lib/tutor/callTutor", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tutor/callTutor")>()),
  generateHint: generateHintMock,
}));

// Mock boundary 4 — consumeQuota() only. PLAN_LIMITS, quotaKey() and
// periodStartEpoch() stay REAL: the gate under test is the CALL, not the
// counter arithmetic (quota.test.ts owns that end to end).
vi.mock("@/lib/billing/quota", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/quota")>()),
  consumeQuota: consumeQuotaMock,
}));

// Mock boundary 5 — readEntitlement(): a DATA SOURCE for the gate, not the thing
// under test; leaving it real would route unrelated reads through `from()` and
// make `tablesTouched` meaningless.
vi.mock("@/lib/billing/readEntitlement", () => ({ readEntitlement: readEntitlementMock }));

const { TutorCallError } = await import("@/lib/tutor/callTutor");
const { hintDuringAttempt } = await import("@/features/exams/tutorActions");

const USER_ID = "user-1";
const ATTEMPT_ID = "attempt-2";
const EXAM_ID = "exam-9";
/** Thuộc đề của lượt. */
const Q_IN_EXAM = "q-in-exam";
/** KHÔNG thuộc đề của lượt — một questionId tự soạn trỏ sang đề khác. */
const Q_FOREIGN = "q-foreign";
/** Bản nháp bài làm gửi từ client — chuỗi phân biệt được để chứng minh nó đi
 *  tới Gemini NGUYÊN VĂN (phép cắt 500 ký tự là việc của buildTutorPrompt). */
const DRAFT = "Em đang nghĩ là thay x = 2 vào…";

/** Nếu bất kỳ trường đáp án nào của fixture lọt vào payload telemetry HOẶC vào
 *  ngữ cảnh gửi Gemini, chuỗi này hiện ra trong JSON của lời gọi tương ứng. */
const ANSWER_KEY_SENTINEL = "ANSWER-KEY-SENTINEL-DO-NOT-LEAK";

const ATTEMPT_ROW = { user_id: USER_ID, exam_id: EXAM_ID, status: "in_progress" };
const EXAM_ROW = { question_ids: [Q_IN_EXAM, "q-also-in-exam"] };

/** questions row (DB shape). Ba cột đáp án đã bị REVOKE khỏi role `authenticated`
 *  (§10c) nên đường đọc thật không bao giờ nhận được chúng — vẫn đặt vào fixture
 *  để chứng minh call site không nhét chúng vào telemetry hay prompt kể cả khi
 *  hàng dữ liệu có mang theo. */
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
  attempt?: typeof ATTEMPT_ROW | Record<string, unknown> | null;
  attemptError?: { code: string; message: string } | null;
  exam?: { question_ids: string[] | null } | null;
  examError?: { code: string; message: string } | null;
  question?: Record<string, unknown> | null;
};

/** Nối fromMock cho chuỗi gọi của hintDuringAttempt(): exam_attempts
 *  (maybeSingle), exams (maybeSingle), questions (maybeSingle), telemetry_log
 *  (insert). Trả về các recorder cho từng nghĩa vụ chứng minh. */
function mockChain(scenario: Scenario) {
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
        if (table === "exam_attempts")
          return { data: scenario.attemptError ? null : (scenario.attempt ?? null), error: scenario.attemptError ?? null };
        if (table === "exams")
          return { data: scenario.examError ? null : (scenario.exam ?? EXAM_ROW), error: scenario.examError ?? null };
        if (table === "questions") return { data: scenario.question ?? null, error: null };
        throw new Error(`unexpected maybeSingle on ${table}`);
      },
      insert: (payload: Record<string, unknown>) => {
        insertPayloads.push(payload);
        return builder;
      },
      then: (onFulfilled: (value: unknown) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled),
    };
    return builder;
  });

  return { insertPayloads, selectArgsByTable, eqArgsByTable, tablesTouched };
}

const ENTITLEMENT: Entitlement = {
  plan: "free",
  expiresAt: null,
  inGracePeriod: false,
  tutor: { state: "known", used: 5, limit: 5, resetsAt: "2026-09-19T00:00:00.000Z" },
  upload: { state: "known", used: 0, limit: 3, resetsAt: "2026-09-19T00:00:00.000Z" },
};

beforeEach(() => {
  fromMock.mockReset();
  guardMock.mockReset();
  generateHintMock.mockReset();
  consumeQuotaMock.mockReset();
  readEntitlementMock.mockReset();
  guardMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  consumeQuotaMock.mockResolvedValue({ ok: true });
  readEntitlementMock.mockResolvedValue(ENTITLEMENT);
});

describe("hintDuringAttempt() — Test 1: cổng 'lượt của mình, đang mở, câu thuộc đề' là cổng thật, không phải trạng thái client", () => {
  it("lượt ĐÃ NỘP ⇒ not_eligible, 0 lượt Gemini, và không đọc tới đề hay câu hỏi", async () => {
    const { tablesTouched } = mockChain({
      attempt: { ...ATTEMPT_ROW, status: "submitted" },
      question: QUESTION_ROW,
    });

    const result = await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT);

    expect(result).toEqual({ error: "not_eligible" });
    expect(generateHintMock).toHaveBeenCalledTimes(0);
    // Chặn NGAY sau dòng attempt: không tốn lượt đọc nào khác, không tính phí
    // hạn mức (consumeQuota đứng sau cổng này).
    expect(tablesTouched).toEqual(["exam_attempts", "telemetry_log"]);
    expect(consumeQuotaMock).toHaveBeenCalledTimes(0);
  });

  it("câu KHÔNG thuộc đề của lượt ⇒ not_eligible, 0 lượt Gemini, và không đọc câu hỏi", async () => {
    const { tablesTouched } = mockChain({ attempt: ATTEMPT_ROW, question: QUESTION_ROW });

    const result = await hintDuringAttempt(ATTEMPT_ID, Q_FOREIGN, DRAFT);

    expect(result).toEqual({ error: "not_eligible" });
    expect(generateHintMock).toHaveBeenCalledTimes(0);
    // Cổng đọc `exams.question_ids` THẬT, không tin questionId client gửi.
    expect(tablesTouched).toContain("exams");
    expect(tablesTouched).not.toContain("questions");
  });

  it("positive control: cùng fixture, câu thuộc đề đi tới generateHint() và trả { hint }", async () => {
    mockChain({ attempt: ATTEMPT_ROW, question: QUESTION_ROW });
    generateHintMock.mockResolvedValue(HINT_TEXT);

    expect(await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT)).toEqual({ hint: HINT_TEXT });
    expect(generateHintMock).toHaveBeenCalledTimes(1);
  });

  it("đọc đề HỎNG ⇒ mã 'server' (không phải not_eligible): một lượt đọc ranh giới bảo mật thất bại không được trông như câu không đủ điều kiện", async () => {
    mockChain({
      attempt: ATTEMPT_ROW,
      examError: { code: "57014", message: "statement timeout" },
      question: QUESTION_ROW,
    });

    expect(await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT)).toEqual({ error: "server" });
    expect(generateHintMock).toHaveBeenCalledTimes(0);
  });

  it("lượt không tồn tại / không phải của mình (RLS trả rỗng) ⇒ not_eligible, KHÔNG ghi telemetry (không có danh tính để ghi)", async () => {
    const { insertPayloads } = mockChain({ attempt: null, question: QUESTION_ROW });

    expect(await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT)).toEqual({ error: "not_eligible" });
    expect(generateHintMock).toHaveBeenCalledTimes(0);
    expect(insertPayloads).toHaveLength(0);
  });

  it("lượt đang mở nhưng câu mang dạng lạ ngoài bốn dạng prompt biết đọc ⇒ not_eligible (fail-closed)", async () => {
    mockChain({ attempt: ATTEMPT_ROW, question: { ...QUESTION_ROW, question_type: "matching" } });

    expect(await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT)).toEqual({ error: "not_eligible" });
    expect(generateHintMock).toHaveBeenCalledTimes(0);
  });
});

describe("hintDuringAttempt() — Test 2 (AC-012/AC-013): telemetry có hình dạng truy vấn được, không rò đáp án, ở CẢ HAI kết cục", () => {
  it("đúng một dòng tutor_invoke mỗi lượt gọi — thành công lẫn thất bại — và không dòng nào mang đáp án", async () => {
    const { insertPayloads } = mockChain({ attempt: ATTEMPT_ROW, question: QUESTION_ROW });

    generateHintMock.mockResolvedValueOnce(HINT_TEXT);
    const success = await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT);

    generateHintMock.mockRejectedValueOnce(new TutorCallError("gemini_unavailable", "finishReason"));
    const failure = await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT);

    expect(success).toEqual({ hint: HINT_TEXT });
    expect(failure).toEqual({ error: "gemini_unavailable" });

    expect(insertPayloads).toHaveLength(2);
    expect(insertPayloads[0]).toMatchObject({
      event_type: "tutor_invoke",
      success: true,
      user_id: USER_ID,
      question_id: Q_IN_EXAM,
      error_code: null,
    });
    expect(insertPayloads[1]).toMatchObject({
      event_type: "tutor_invoke",
      success: false,
      user_id: USER_ID,
      question_id: Q_IN_EXAM,
      error_code: "gemini_unavailable",
    });
    for (const payload of insertPayloads) expect(payload.user_id).toBe(USER_ID);
    for (const payload of insertPayloads) {
      expect(JSON.stringify(payload)).not.toContain(ANSWER_KEY_SENTINEL);
    }
  });

  it("ngữ cảnh gửi Gemini KHÔNG mang đáp án, nhưng CÓ nội dung câu hỏi và bản nháp (AC-018/019 tại call site)", async () => {
    mockChain({ attempt: ATTEMPT_ROW, question: QUESTION_ROW });
    generateHintMock.mockResolvedValue(HINT_TEXT);

    await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT);

    expect(generateHintMock).toHaveBeenCalledTimes(1);
    const calls = JSON.stringify(generateHintMock.mock.calls);
    expect(calls).not.toContain(ANSWER_KEY_SENTINEL);
    expect(calls).toContain(QUESTION_ROW.content);
    expect(generateHintMock.mock.calls[0][0]).toMatchObject({
      questionType: "mcq",
      studentAnswer: DRAFT,
    });
  });

  it("bản nháp không phải string (payload tự soạn) ⇒ đi tới Gemini như chuỗi rỗng, không ném", async () => {
    mockChain({ attempt: ATTEMPT_ROW, question: QUESTION_ROW });
    generateHintMock.mockResolvedValue(HINT_TEXT);

    const result = await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, { evil: 1 } as unknown as string);

    expect(result).toEqual({ hint: HINT_TEXT });
    expect(generateHintMock.mock.calls[0][0]).toMatchObject({ studentAnswer: "" });
  });
});

describe("hintDuringAttempt() — câu TỰ LUẬN nay được kèm (2026-09-13)", () => {
  it("question_type = essay đi tới generateHint() với questionType 'essay' và bản nháp đang viết", async () => {
    mockChain({
      attempt: ATTEMPT_ROW,
      question: { ...QUESTION_ROW, question_type: "essay", choices: null },
    });
    generateHintMock.mockResolvedValue(HINT_TEXT);

    const draft = "Mở bài: giới thiệu tác giả…";
    expect(await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, draft)).toEqual({ hint: HINT_TEXT });
    expect(generateHintMock.mock.calls[0][0]).toMatchObject({
      questionType: "essay",
      studentAnswer: draft,
    });
    // Đáp án mẫu (essay_answer mang sentinel) vẫn không có đường sang Gemini.
    expect(JSON.stringify(generateHintMock.mock.calls)).not.toContain(ANSWER_KEY_SENTINEL);
  });
});

describe("hintDuringAttempt() — Test 3 (AC-029): câu chưa gắn skill_node_id vẫn hoạt động", () => {
  it("tới generateHint() và trả { hint }; danh sách cột đọc là ĐÚNG bộ cột an toàn", async () => {
    const { selectArgsByTable } = mockChain({
      attempt: ATTEMPT_ROW,
      question: { ...QUESTION_ROW, skill_node_id: null },
    });
    generateHintMock.mockResolvedValue(HINT_TEXT);

    expect(await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT)).toEqual({ hint: HINT_TEXT });
    expect(generateHintMock).toHaveBeenCalledTimes(1);
    // Khoá CHÍNH XÁC danh sách cột: một phép kiểm tra theo chuỗi con vẫn cho
    // `select("*")` đi qua, mà `*` kéo luôn ba cột đáp án vượt ranh giới SQL.
    expect(selectArgsByTable.questions).toEqual(["content, question_type, choices"]);
  });
});

describe("hintDuringAttempt() — hình dạng truy vấn ở ranh giới Supabase mock (row-identity proofs)", () => {
  it("lọc attempt theo attemptId, đề theo exam_id của attempt, câu theo questionId — và không bao giờ đọc exam_results", async () => {
    const { eqArgsByTable, tablesTouched } = mockChain({ attempt: ATTEMPT_ROW, question: QUESTION_ROW });
    generateHintMock.mockResolvedValue(HINT_TEXT);

    await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT);

    expect(eqArgsByTable.exam_attempts).toEqual([["id", ATTEMPT_ID]]);
    expect(eqArgsByTable.exams).toEqual([["id", EXAM_ID]]);
    expect(eqArgsByTable.questions).toEqual([["id", Q_IN_EXAM]]);
    // Cổng "sai hai lần" đã bỏ hẳn: không còn lượt quét lịch sử nào.
    expect(tablesTouched).not.toContain("exam_results");
  });
});

describe("hintDuringAttempt() — Test 4 (AC-022): rate limit từ chối TRƯỚC mọi lượt Gemini", () => {
  it("trả { error: 'rate_limited' } với 0 lượt generateHint() và chưa đọc câu hỏi", async () => {
    const { tablesTouched } = mockChain({ attempt: ATTEMPT_ROW, question: QUESTION_ROW });
    guardMock.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });

    const result = await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT);

    expect(result).toEqual({ error: "rate_limited" });
    expect(generateHintMock).toHaveBeenCalledTimes(0);
    // Khoá đếm là user lấy từ dòng attempt đã lọc qua RLS; tên khoá giữ nguyên
    // `explainStep` (đổi tên khoá đang chạy là reset ngầm bộ đếm của mọi người).
    expect(guardMock).toHaveBeenCalledWith("explainStep", USER_ID);
    expect(tablesTouched).not.toContain("questions");
    expect(tablesTouched).not.toContain("exams");
  });
});

describe("hintDuringAttempt() — Test 5: hạn mức từ chối TRƯỚC Gemini, và lý do chỉ nằm trong telemetry", () => {
  const CLIENT_CODE_FOR_QUOTA_REFUSAL = "not_eligible";

  it("user_quota: client nhận not_eligible, telemetry nhận user_quota_exhausted, 0 lượt Gemini, chỉ chạm hai bảng", async () => {
    const { insertPayloads, tablesTouched } = mockChain({ attempt: ATTEMPT_ROW, question: QUESTION_ROW });
    consumeQuotaMock.mockResolvedValue({ ok: false, reason: "user_quota" });

    const result = await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT);

    expect(result).toEqual({ error: CLIENT_CODE_FOR_QUOTA_REFUSAL });
    expect(generateHintMock).toHaveBeenCalledTimes(0);
    expect(insertPayloads).toHaveLength(1);
    expect(insertPayloads[0]).toMatchObject({
      event_type: "tutor_invoke",
      success: false,
      user_id: USER_ID,
      question_id: Q_IN_EXAM,
      error_code: "user_quota_exhausted",
    });
    expect(tablesTouched).toEqual(["exam_attempts", "telemetry_log"]);
  });

  it("project_budget: CÙNG mã client nhưng KHÁC mã telemetry — hai lý do không gộp thành một hằng", async () => {
    const { insertPayloads } = mockChain({ attempt: ATTEMPT_ROW, question: QUESTION_ROW });

    consumeQuotaMock.mockResolvedValueOnce({ ok: false, reason: "user_quota" });
    const userQuotaResult = await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT);
    consumeQuotaMock.mockResolvedValueOnce({ ok: false, reason: "project_budget" });
    const budgetResult = await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT);

    expect(userQuotaResult).toEqual({ error: CLIENT_CODE_FOR_QUOTA_REFUSAL });
    expect(budgetResult).toEqual(userQuotaResult);
    expect(insertPayloads.map((p) => p.error_code)).toEqual([
      "user_quota_exhausted",
      "project_budget_exhausted",
    ]);
    expect(insertPayloads[0].error_code).not.toBe(insertPayloads[1].error_code);
    expect(generateHintMock).toHaveBeenCalledTimes(0);
  });

  it("unavailable (Redis down): telemetry dùng lại 'server', vẫn 0 lượt Gemini", async () => {
    const { insertPayloads } = mockChain({ attempt: ATTEMPT_ROW, question: QUESTION_ROW });
    consumeQuotaMock.mockResolvedValue({ ok: false, reason: "unavailable" });

    expect(await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT)).toEqual({
      error: CLIENT_CODE_FOR_QUOTA_REFUSAL,
    });
    expect(insertPayloads).toHaveLength(1);
    expect(insertPayloads[0].error_code).toBe("server");
    expect(generateHintMock).toHaveBeenCalledTimes(0);
  });

  it("mã telemetry không bao giờ là giá trị trả cho client, ở cả ba lý do", async () => {
    const { insertPayloads } = mockChain({ attempt: ATTEMPT_ROW, question: QUESTION_ROW });

    const returned: string[] = [];
    for (const reason of ["user_quota", "project_budget", "unavailable"]) {
      consumeQuotaMock.mockResolvedValueOnce({ ok: false, reason });
      const result = await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT);
      returned.push((result as { error: string }).error);
    }

    expect(returned).toEqual(["not_eligible", "not_eligible", "not_eligible"]);
    expect(insertPayloads.map((p) => p.error_code)).toEqual([
      "user_quota_exhausted",
      "project_budget_exhausted",
      "server",
    ]);
    for (let i = 0; i < 3; i++) expect(insertPayloads[i].error_code).not.toBe(returned[i]);
  });

  it("positive control: còn hạn mức thì cùng fixture tới generateHint() một lần, dòng thành công không mang mã lỗi", async () => {
    const { insertPayloads } = mockChain({ attempt: ATTEMPT_ROW, question: QUESTION_ROW });
    generateHintMock.mockResolvedValue(HINT_TEXT);

    expect(await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT)).toEqual({ hint: HINT_TEXT });
    expect(generateHintMock).toHaveBeenCalledTimes(1);
    expect(insertPayloads).toHaveLength(1);
    expect(insertPayloads[0]).toMatchObject({ success: true, error_code: null });
  });

  it("gọi consumeQuota đúng một lần: kind tutor, userId từ RLS, entitlement vừa đọc, chi phí 1", async () => {
    mockChain({ attempt: ATTEMPT_ROW, question: QUESTION_ROW });
    generateHintMock.mockResolvedValue(HINT_TEXT);

    await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT);

    expect(consumeQuotaMock).toHaveBeenCalledTimes(1);
    expect(consumeQuotaMock).toHaveBeenCalledWith("tutor", USER_ID, ENTITLEMENT, 1);
    expect(readEntitlementMock).toHaveBeenCalledWith(USER_ID);
  });

  it("lượt bị rate limit không bao giờ tới cổng hạn mức — một lượt bị từ chối không được tính phí một suất", async () => {
    mockChain({ attempt: ATTEMPT_ROW, question: QUESTION_ROW });
    guardMock.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });

    await hintDuringAttempt(ATTEMPT_ID, Q_IN_EXAM, DRAFT);

    expect(consumeQuotaMock).toHaveBeenCalledTimes(0);
    expect(readEntitlementMock).toHaveBeenCalledTimes(0);
  });
});
