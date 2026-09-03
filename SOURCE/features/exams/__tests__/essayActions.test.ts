// `retryEssayGrading()` — Server Action chấm lại (AC-072, AC-025, AC-063,
// AC-064, EG-BE-022).
//
// BIÊN MOCK, chọn để MÃ THẬT chạy càng nhiều càng tốt:
//   · `fetch`                      — biên I/O ngoài. `groqClient` chạy MÃ THẬT.
//   · `@upstash/redis`             — biên I/O ngoài. `budget.ts` chạy MÃ THẬT,
//                                    nên "bộ đếm KHÔNG ĐỔI ở mọi lượt từ chối"
//                                    là một phép đo trên chính bộ đếm.
//   · `@/lib/supabase/server`      — phiên của học sinh; đầu kia là Postgres.
//   · `@/lib/supabase/service-role`— hai thao tác đặc quyền; cũng là hai spy
//                                    dùng để đo THỨ TỰ.
//   · `deriveEssayView`, `parseGrade`, `prompt`, `rateLimit` — KHÔNG mock. Đó là
//                                    các hàm thuần đang được kiểm gián tiếp; mock
//                                    chúng là kiểm dây nối.
//
// NGHĨA VỤ CHỨNG MINH TRUNG TÂM (EG-BE-022): với MỖI ca từ chối ở bước 1-3,
// ZERO request provider VÀ bộ đếm ngân sách KHÔNG ĐỔI. Một lượt từ chối vẫn tiêu
// ngân sách nghĩa là một người gọi bị chặn vẫn rút cạn được trần NGÀY của cả dự
// án — bộ đếm ấy là MỘT, dùng chung cho mọi học sinh (U1/AC-066).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const redis = { incrby: vi.fn(), decrby: vi.fn(), expire: vi.fn() };
vi.mock("@upstash/redis", () => ({
  Redis: class {
    incrby = redis.incrby;
    decrby = redis.decrby;
    expire = redis.expire;
  },
}));

const { claim, settle } = vi.hoisted(() => ({ claim: vi.fn(), settle: vi.fn() }));
vi.mock("@/lib/supabase/service-role", () => ({
  claimEssayGradingAttempt: claim,
  recordEssayGrade: settle,
}));

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { ESSAY_MAX_POINTS } from "@/lib/scoring/essayLifecycle";
import { __resetRateLimitForTests, RATE_LIMITS } from "@/lib/security/rateLimit";
import { retryEssayGrading } from "@/features/exams/essayActions";

const ATTEMPT = "11111111-2222-3333-4444-555555555555";
const EXAM = "22222222-3333-4444-5555-666666666666";
const USER = "99999999-8888-7777-6666-555555555555";
const QUESTION = "q1";

/** Một `per_question` ở đúng trạng thái cho phép chấm lại: `failed`, còn lượt. */
function failedEntry(over: Record<string, unknown> = {}) {
  return {
    questionId: QUESTION,
    selected: "bài làm của học sinh",
    scored: true,
    isCorrect: false,
    essayState: "failed",
    essayEarned: null,
    essayMax: null,
    essayLowConfidence: false,
    essayAttempts: 1,
    ...over,
  };
}

let attemptRow: Record<string, unknown> | null;
let attemptError: unknown;
let resultRow: Record<string, unknown> | null;
let resultError: unknown;
let answerKeyRows: unknown;
let answerKeyError: unknown;
let telemetryInsert: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;
let consoleError: ReturnType<typeof vi.spyOn>;

/** Client của học sinh. `.from()` phân nhánh theo BẢNG — cùng một client phục vụ
 *  hai lượt đọc và một lượt ghi telemetry, đúng như trong sản phẩm. */
function studentClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === "exam_attempts") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: attemptRow, error: attemptError }) }),
          }),
        };
      }
      if (table === "exam_results") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: resultRow, error: resultError }) }),
          }),
        };
      }
      if (table === "telemetry_log") return { insert: telemetryInsert };
      throw new Error(`bảng ngoài dự kiến: ${table}`);
    }),
    rpc: vi.fn(async (name: string) => {
      if (name !== "exam_answer_key") throw new Error(`rpc ngoài dự kiến: ${name}`);
      return { data: answerKeyRows, error: answerKeyError };
    }),
  };
}

/** Response 200 hợp lệ mang một band hợp lệ. */
function graded(band: number, lowConfidence = false): Response {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ band, low_confidence: lowConfidence }) } }],
    }),
    { status: 200 }
  );
}

function telemetryRows(): Array<Record<string, unknown>> {
  return telemetryInsert.mock.calls.map((c) => c[0] as Record<string, unknown>);
}

beforeEach(() => {
  __resetRateLimitForTests();
  process.env.ESSAY_GRADING_ENABLED = "true";
  process.env.KV_REST_API_URL = "https://example.upstash.io";
  process.env.KV_REST_API_TOKEN = "token";
  process.env.GROQ_BUDGET_DAILY_LIMIT = "600";
  process.env.GROQ_API_KEY = "gsk_test_key";

  attemptRow = { id: ATTEMPT, exam_id: EXAM, status: "submitted", user_id: USER };
  attemptError = null;
  resultRow = { per_question: [failedEntry()], created_at: new Date().toISOString() };
  resultError = null;
  answerKeyRows = [{ id: QUESTION, content: "Đề bài", essay_answer: "Đáp án mẫu" }];
  answerKeyError = null;

  redis.incrby.mockReset().mockResolvedValue(1);
  redis.decrby.mockReset().mockResolvedValue(0);
  redis.expire.mockReset().mockResolvedValue(1);
  claim.mockReset().mockResolvedValue({ claimed: true, attempts: 2, reason: null, error: null });
  settle.mockReset().mockResolvedValue({ written: true, error: null });
  telemetryInsert = vi.fn().mockResolvedValue({ error: null });
  createClientMock.mockReset().mockImplementation(async () => studentClient());

  // Mỗi lời gọi một Response MỚI: body stream khoá lại sau `res.json()`.
  fetchMock = vi.fn().mockImplementation(() => graded(0.75));
  vi.stubGlobal("fetch", fetchMock);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.ESSAY_GRADING_ENABLED;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.GROQ_BUDGET_DAILY_LIMIT;
  delete process.env.GROQ_API_KEY;
});

/** Bộ đếm ngân sách KHÔNG ĐỔI và provider KHÔNG được chạm. Gọi ở MỌI ca từ
 *  chối — đây là nghĩa vụ chứng minh, không phải một khẳng định trang trí. */
function expectNothingSpent() {
  expect(fetchMock).not.toHaveBeenCalled();
  expect(redis.incrby).not.toHaveBeenCalled();
  expect(redis.decrby).not.toHaveBeenCalled();
}

describe("đường thành công", () => {
  it("câu `failed` còn lượt ⇒ settle `graded` với band, trả { ok: true }", async () => {
    const res = await retryEssayGrading(ATTEMPT, QUESTION);

    expect(res).toEqual({ ok: true });
    expect(settle).toHaveBeenCalledWith(ATTEMPT, QUESTION, "graded", 0.75, ESSAY_MAX_POINTS, false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redis.incrby).toHaveBeenCalledTimes(1);
  });

  it("KHÔNG ném và KHÔNG redirect kể cả khi mọi thứ bên dưới hỏng", async () => {
    // `redirect()` của Next ném một control-flow exception; một lượt ném ở đây
    // đánh sập cả trang Chi tiết vì một nút phụ.
    createClientMock.mockRejectedValue(new Error("boom"));

    await expect(retryEssayGrading(ATTEMPT, QUESTION)).resolves.toEqual({
      ok: false,
      reason: "server",
    });
  });
});

describe("THỨ TỰ BẮT BUỘC: uỷ quyền TRƯỚC đo đếm (AC-072 / Gate G)", () => {
  it("claim chạy TRƯỚC lượt INCRBY đầu tiên, và cả hai TRƯỚC provider", async () => {
    await retryEssayGrading(ATTEMPT, QUESTION);

    // Bất đẳng thức nghiêm ngặt trên từng cặp liền kề. "Cả ba đều được gọi"
    // đúng cả trong thứ tự hỏng, nên nó không phân biệt được gì.
    expect(claim.mock.invocationCallOrder[0]).toBeLessThan(redis.incrby.mock.invocationCallOrder[0]);
    expect(redis.incrby.mock.invocationCallOrder[0]).toBeLessThan(
      fetchMock.mock.invocationCallOrder[0]
    );
    expect(fetchMock.mock.invocationCallOrder[0]).toBeLessThan(settle.mock.invocationCallOrder[0]);
  });

  it("mọi lượt đọc uỷ quyền chạy TRƯỚC claim — đặc quyền nâng lên sau cùng", async () => {
    const client = studentClient();
    createClientMock.mockImplementation(async () => client);

    await retryEssayGrading(ATTEMPT, QUESTION);

    // `.from()` (client của HỌC SINH, bước 2-3) đi trước `claim` (service_role,
    // bước 4). Ranh giới đặc quyền là chỗ duy nhất trong hàm được nâng quyền, và
    // nó phải nằm SAU toàn bộ phần kiểm tra.
    expect(client.from.mock.invocationCallOrder[0]).toBeLessThan(claim.mock.invocationCallOrder[0]);
  });
});

describe("NĂM ca từ chối — mỗi ca ĐÚNG MỘT lý do, ZERO chi tiêu (EG-BE-022)", () => {
  it("cờ tắt ⇒ `server`, và KHÔNG chạm cả database", async () => {
    delete process.env.ESSAY_GRADING_ENABLED;

    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: "server" });

    // Chỗ đọc cờ 2/3 là một CỔNG HÀNH VI: bỏ nó thì tắt cờ vẫn để nút chấm lại
    // đốt ngân sách Groq.
    expect(createClientMock).not.toHaveBeenCalled();
    expectNothingSpent();
  });

  it.each([" true ", "TRUE", "1", "yes", ""])(
    "cờ là %o (không phải chuỗi `true` đã trim) ⇒ fail-closed",
    async (value) => {
      process.env.ESSAY_GRADING_ENABLED = value;
      // `" true "` PHẢI bật (đã trim); phần còn lại phải tắt.
      const expected = value.trim() === "true";
      const res = await retryEssayGrading(ATTEMPT, QUESTION);
      expect(res.ok).toBe(expected);
    }
  );

  it("attempt không thuộc người gọi (RLS lọc mất) ⇒ `not_found`, ZERO chi tiêu", async () => {
    attemptRow = null;

    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: "not_found" });
    expect(claim).not.toHaveBeenCalled();
    expectNothingSpent();
    // KHÔNG telemetry: không có `userId` nào để ghi, và một dòng `user_id` null
    // bị `telemetry_insert_own` từ chối thẳng.
    expect(telemetryRows()).toHaveLength(0);
  });

  it("attempt chưa nộp ⇒ `not_found`, ZERO chi tiêu", async () => {
    attemptRow = { ...attemptRow, status: "in_progress" };

    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: "not_found" });
    expect(claim).not.toHaveBeenCalled();
    expectNothingSpent();
  });

  it("câu đã `graded` ⇒ `not_failed` (AC-063 — cuộc đua, KHÔNG phải lỗi)", async () => {
    resultRow = {
      per_question: [failedEntry({ essayState: "graded", essayEarned: 0.75, essayMax: 1 })],
      created_at: new Date().toISOString(),
    };

    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: "not_failed" });
    expect(claim).not.toHaveBeenCalled();
    expectNothingSpent();
  });

  it("hết lượt (essayAttempts = ESSAY_MAX_ATTEMPTS) ⇒ `exhausted`, ZERO chi tiêu", async () => {
    resultRow = {
      per_question: [failedEntry({ essayAttempts: 3 })],
      created_at: new Date().toISOString(),
    };

    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: "exhausted" });
    // AC-064: trần được cưỡng chế trong SQL, nhưng bước 3 tồn tại để lời từ chối
    // NÓI ĐÚNG lý do. Ở đây nó cũng giữ cho một lượt claim không bị đốt vô ích.
    expect(claim).not.toHaveBeenCalled();
    expectNothingSpent();
  });

  it("câu không tồn tại trong lượt thi ⇒ `not_found`, ZERO chi tiêu", async () => {
    expect(await retryEssayGrading(ATTEMPT, "khong-co-cau-nay")).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(claim).not.toHaveBeenCalled();
    expectNothingSpent();
  });

  it("câu không có đáp án mẫu ⇒ `not_found` TRƯỚC claim (AC-038)", async () => {
    answerKeyRows = [{ id: QUESTION, content: "Đề bài", essay_answer: null }];

    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: "not_found" });
    // Đốt một trong ba lượt cho một câu KHÔNG THỂ chấm là mất trắng.
    expect(claim).not.toHaveBeenCalled();
    expectNothingSpent();
  });

  it("vượt trần ngân sách dự án ⇒ `budget`, ZERO request provider", async () => {
    redis.incrby.mockResolvedValue(99_999);

    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: "budget" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("counter store hỏng ⇒ `server`, KHÔNG phải `budget`", async () => {
    // Nói "hết ngân sách hôm nay" khi thật ra Upstash đang chết là một câu SAI,
    // và nó bảo học sinh chờ tới mai cho một sự cố sẽ được sửa trong mười phút.
    redis.incrby.mockRejectedValue(new Error("down"));

    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: "server" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("rate limit (bước 1) — khoá lấy từ dòng attempt ĐÃ qua RLS", () => {
  it("vượt trần ⇒ `server`, ZERO chi tiêu", async () => {
    for (let i = 0; i < RATE_LIMITS.retryEssayGrading.limit; i += 1) {
      // Mỗi lượt hợp lệ tiêu một suất; đặt lại kết quả để chúng đều đi hết đường.
      await retryEssayGrading(ATTEMPT, QUESTION);
    }
    redis.incrby.mockClear();
    fetchMock.mockClear();

    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: "server" });
    expectNothingSpent();
  });
});

describe("claim bị SQL từ chối (bước 4) — cưỡng chế LẠI sau khi bước 3 đã qua", () => {
  it.each([
    ["already_graded", "not_failed"],
    ["bad_state", "not_failed"],
    ["exhausted", "exhausted"],
    ["not_submitted", "not_found"],
    ["no_element", "not_found"],
  ] as const)("reason %o ⇒ %o, và ZERO request provider", async (reason, expected) => {
    // Bước 3 đã cho qua (dữ liệu đọc nói câu còn chấm lại được) nhưng SQL nói
    // không — đó là cuộc đua thật, và SQL là bên thắng. Đây cũng là bằng chứng
    // bước 4 KHÔNG phải một lượt kiểm thừa của bước 3.
    claim.mockResolvedValue({ claimed: false, attempts: 3, reason, error: null });

    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: expected });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
  });

  it("claim trả lỗi hạ tầng ⇒ `server`", async () => {
    claim.mockResolvedValue({
      claimed: false,
      attempts: 0,
      reason: null,
      error: { code: "42501", message: "denied" },
    });

    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: "server" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("bước 6 — provider và settle", () => {
  it("provider hỏng ⇒ `server`, KHÔNG settle band nào", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 500 })));

    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: "server" });
    // KHÔNG settle: câu đã ở `failed` rồi, một lượt ghi nữa chỉ đẩy
    // `essayGradedAt` tới mà không đổi gì học sinh nhìn thấy.
    expect(settle).not.toHaveBeenCalled();
  });

  it("output không hợp lệ ⇒ `server`, và KHÔNG BAO GIỜ band 0 (AC-007)", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content: "không phải JSON" } }] }), {
          status: 200,
        })
      )
    );

    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: "server" });
    expect(settle).not.toHaveBeenCalled();
  });

  it("settle bị từ chối (`written: false`) ⇒ `not_failed`, KHÔNG phải một lỗi", async () => {
    settle.mockResolvedValue({ written: false, error: null });

    // Ghi-lần-đầu-thắng đã từ chối một bản trùng: band kia là THẬT. Học sinh
    // không được báo lỗi — `router.refresh()` sẽ hiện band ra.
    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: "not_failed" });
  });

  it("đúng MỘT request provider mỗi lượt chấm lại khi không có 429 (AC-025)", async () => {
    await retryEssayGrading(ATTEMPT, QUESTION);

    // Không có vòng lặp chấm lại tự động nào: một lần bấm = một lượt.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(redis.incrby).toHaveBeenCalledTimes(1);
  });
});

describe("telemetry (AC-054/AC-055)", () => {
  it("thành công ⇒ một dòng `essay_grade`, success true, KHÔNG mã lỗi", async () => {
    await retryEssayGrading(ATTEMPT, QUESTION);

    expect(telemetryRows()).toEqual([
      {
        user_id: USER,
        event_type: "essay_grade",
        question_id: QUESTION,
        skill_node_id: null,
        success: true,
        error_code: null,
      },
    ]);
  });

  it.each([
    ["câu đã graded", () => { resultRow = { per_question: [failedEntry({ essayState: "graded" })], created_at: new Date().toISOString() }; }],
    ["hết lượt", () => { resultRow = { per_question: [failedEntry({ essayAttempts: 3 })], created_at: new Date().toISOString() }; }],
    ["không có đáp án mẫu", () => { answerKeyRows = [{ id: QUESTION, content: "Đề bài", essay_answer: null }]; }],
  ])("từ chối uỷ quyền (%s) ⇒ `not_eligible`", async (_label, arrange) => {
    arrange();

    await retryEssayGrading(ATTEMPT, QUESTION);

    // `not_eligible` là mã TÁI DÙNG cho MỌI ca từ chối uỷ quyền ở entry point
    // chấm lại (AC-072). Khác hẳn đường TỰ ĐỘNG, nơi một claim bị từ chối
    // KHÔNG ghi dòng nào — ở đó không có ai vừa bấm nút để mà trả lời.
    expect(telemetryRows()[0]).toMatchObject({ success: false, error_code: "not_eligible" });
  });

  it("vượt trần ngân sách ⇒ `project_budget_exhausted`", async () => {
    redis.incrby.mockResolvedValue(99_999);
    await retryEssayGrading(ATTEMPT, QUESTION);
    expect(telemetryRows()[0]).toMatchObject({ error_code: "project_budget_exhausted" });
  });

  it("provider hỏng ⇒ `groq_unavailable`", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("{}", { status: 500 })));
    await retryEssayGrading(ATTEMPT, QUESTION);
    expect(telemetryRows()[0]).toMatchObject({ error_code: "groq_unavailable" });
  });

  it("output không hợp lệ ⇒ `invalid_output`", async () => {
    fetchMock.mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ choices: [{ message: { content: "méo" } }] }), { status: 200 })
      )
    );
    await retryEssayGrading(ATTEMPT, QUESTION);
    expect(telemetryRows()[0]).toMatchObject({ error_code: "invalid_output" });
  });

  it("settle bị từ chối ⇒ `duplicate_write`", async () => {
    settle.mockResolvedValue({ written: false, error: null });
    await retryEssayGrading(ATTEMPT, QUESTION);
    expect(telemetryRows()[0]).toMatchObject({ error_code: "duplicate_write" });
  });

  it("telemetry hỏng KHÔNG làm hỏng lượt chấm lại", async () => {
    telemetryInsert.mockRejectedValue(new Error("network down"));

    // Một lệnh ghi QUAN SÁT không bao giờ được trở thành điểm hỏng thứ hai.
    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: true });
    expect(settle).toHaveBeenCalledTimes(1);
  });
});

describe("quy tắc log: CHỈ `digest` (AC-056)", () => {
  it("lỗi Postgres KHÔNG đi ra console dưới dạng message", async () => {
    const PG_MESSAGE = "THONG_DIEP_POSTGRES_CO_THE_VONG_LAI_BAI_LAM";
    resultError = { code: "42501", message: PG_MESSAGE, digest: "abc123" };

    expect(await retryEssayGrading(ATTEMPT, QUESTION)).toEqual({ ok: false, reason: "server" });

    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain(PG_MESSAGE);
    // Nhưng PHẢI mang `digest`, nếu không dòng log này vô dụng cho chẩn đoán.
    expect(logged).toContain("abc123");
  });

  it("KHÔNG log bài làm, đề bài hay đáp án mẫu ở lối thoát nào", async () => {
    const STUDENT_ANSWER = "BAI_LAM_BI_MAT_CUA_HOC_SINH";
    const PROVIDER_MESSAGE = "THONG_DIEP_LOI_CUA_NHA_CUNG_CAP";
    resultRow = {
      per_question: [failedEntry({ selected: STUDENT_ANSWER })],
      created_at: new Date().toISOString(),
    };
    fetchMock.mockImplementation(() => Promise.reject(new Error(PROVIDER_MESSAGE)));

    await retryEssayGrading(ATTEMPT, QUESTION);

    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain(STUDENT_ANSWER);
    expect(logged).not.toContain(PROVIDER_MESSAGE);
    expect(logged).not.toContain("Đáp án mẫu");
    expect(logged).not.toContain("Đề bài");
  });

  it("telemetry KHÔNG mang bài làm của học sinh", async () => {
    const STUDENT_ANSWER = "BAI_LAM_BI_MAT_CUA_HOC_SINH";
    resultRow = {
      per_question: [failedEntry({ selected: STUDENT_ANSWER })],
      created_at: new Date().toISOString(),
    };

    await retryEssayGrading(ATTEMPT, QUESTION);

    expect(JSON.stringify(telemetryRows())).not.toContain(STUDENT_ANSWER);
  });
});
