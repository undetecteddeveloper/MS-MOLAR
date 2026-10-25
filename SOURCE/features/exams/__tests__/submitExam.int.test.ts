// Short-Answer Scoring — sửa select+ánh xạ essay_answer của submitExam() [integration] Test
// Design Doc: docs/design/short-answer-scoring-backend-design.md (v1.1)
// UI Spec: N/A (file chỉ-backend)
// Chuyển từ skeleton (backend task 3): bản sửa select+ánh xạ SA-BE-012 (backend
// task 2, đã đáp xuống) được khẳng định ở đây — file này không thêm
// thay đổi code production nào của riêng nó.
//
// Hạng mục phạm vi bắt buộc (KHÔNG phải lựa chọn tuỳ ý theo ROI) — Design Doc backend
// nâng file này từ một khuyến nghị không chặn của Work Plan lên phạm vi
// bắt buộc (Agreement Checklist Scope; Fact Disposition `submitExam-select-test-gap`;
// Technical Dependencies and Implementation Order bước 4) vì nó đóng
// rủi ro được nêu thứ 2 của chính tài liệu (Design Summary `biggest_risks`): đưa
// nhánh short_answer của computeScore.ts lên mà không có bản sửa select+ánh xạ này (hoặc
// với chuỗi select gõ sai) là một no-op thầm lặng trên production mà
// fixture unit thuần của computeScore.test.ts không phát hiện được ("Mock Limitations
// for Data Layer" của testing-principles — sai khớp schema/hình dạng truy vấn lọt qua
// mà không bị phát hiện với test chỉ mock/chỉ unit).
//
// =============================================================================
// Test 1 — submitExam(): SELECT questions có thêm essay_answer; phép ánh xạ
// hàng-sang-Question điền đúng essayAnswer (kể cả null -> undefined)
// =============================================================================
// AC: SA-BE-012 — "Khi submitExam() lấy câu hỏi để chấm, hệ thống
//   phải đưa essay_answer vào SELECT và ánh xạ nó sang Question.essayAnswer
//   (null -> undefined) cho mọi hàng câu hỏi bất kể questionType,
//   khớp tiền lệ chuỗi-select sẵn có của getResult()."
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/features/exams/actions.ts (submitExam) + client Supabase
//   mock (ranh giới createClient()) + computeScore() (thật, trong cùng tiến trình — không
//   mock; nó là bên tiêu thụ mà hình dạng đầu vào của nó được test này chứng minh là đúng)
// @complexity: medium
// @real-dependency: không có — test ranh giới mock được phê duyệt (Test
//   Boundaries của backend DD: "Supabase client (createClient()) bên trong submitExam() — Có
//   (mock)... bản thân computeScore() rõ ràng là 'Không — cài đặt thật,
//   unit test hàm thuần trực tiếp... không có I/O nào để mock'"). computeScore
//   được spy (gọi xuyên, giữ cài đặt thật) — không stub —
//   chỉ để test này kiểm được đúng Question[] mà submitExam() dựng,
//   vì bản thân ScoreResult không bao giờ mang essayAnswer (Field
//   Propagation Map của backend DD: essayAnswer bị "bỏ" sau phép so sánh
//   đúng-sai, không bao giờ lưu vào per_question).

// 2026-08-03 (Security review Critical #1) — khoá đáp án không còn đến từ
// `.from("questions").select(...)`: correct_answer/sub_answers/essay_answer bị
// REVOKE khỏi role `authenticated`, và submitExam() chạy bằng JWT của chính học sinh.
// Các cột giờ băng qua ranh giới qua hàm SECURITY DEFINER
// claim_attempt_answer_key() (schema.sql §10b), hàm khoá lượt làm trước khi
// trả bất cứ thứ gì. Bản chất của SA-BE-012 không đổi và tách làm hai:
//   - danh sách cột chuyển vào SQL   -> nghĩa vụ (a) giờ canh schema.sql
//   - phép ánh xạ hàng -> Question vẫn ở actions.ts -> nghĩa vụ (b)-(d) như trước
// cộng nghĩa vụ (e), mới: khoá phải ở lại bên trong RPC đó và không được
// cài lại thành một lệnh update exam_attempts phía app (mở lại lỗ hổng).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 2026-08-03 (Security review Critical #2) — exam_results không còn được ghi
// qua client riêng của người dùng: `authenticated` mất hoàn toàn INSERT trên bảng đó
// (schema.sql §11a), nên lượt ghi chuyển sang recordExamResult(), một lời gọi
// service-role chỉ-server. Nghĩa vụ (f) bên dưới ghim rằng nó ở nguyên đó.

const { fromMock, rpcMock, computeScoreSpy, recordExamResultMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  computeScoreSpy: vi.fn(),
  recordExamResultMock: vi.fn(),
}));

// actions.ts import "server-only" (ném lỗi ngoài bundle server Next/react-server)
// → stub, cùng mẫu với getResult.int.test.ts/rating.int.test.ts.
vi.mock("server-only", () => ({}));

// Ranh giới mock: chỉ client Supabase (Test Boundaries của backend DD) — chứng minh cách dựng
// lời gọi JS/tính đúng của ánh xạ; không ngữ nghĩa Postgres thật nào mới được đưa vào
// bởi thay đổi cộng thêm này.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock, rpc: rpcMock })),
}));

// module service-role: được mock ở cùng ranh giới được phê duyệt. Nó import
// "server-only" và nếu không sẽ dựng một client đặc quyền thật.
vi.mock("@/lib/supabase/service-role", () => ({
  recordExamResult: recordExamResultMock,
}));

// computeScore() không bị stub — computeScoreSpy uỷ quyền cho cài đặt thật
// bên dưới, nên logic chấm điểm của nó vẫn chạy trong cùng tiến trình. Lớp bọc
// chỉ ghi lại tham số gọi, cho test này truy cập Question[] đã ánh xạ
// mà submitExam() dựng (nghĩa vụ (b)-(d)), điều mà không ranh giới quan sát được nào khác
// (payload mock của attempt_answers/exam_results) để lộ.
vi.mock("@/lib/scoring/computeScore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scoring/computeScore")>();
  return {
    ...actual,
    computeScore: computeScoreSpy.mockImplementation(actual.computeScore),
  };
});

const { submitExam } = await import("@/features/exams/actions");

const ATTEMPT_ID = "attempt-1";
const EXAM_ID = "exam-1";
const QUESTION_IDS = ["q1", "q2"];

// các hàng questions (dạng DB, snake_case) — q1 là ca short_answer khác null
// (nghĩa vụ b), q2 là ca essay_answer null (nghĩa vụ c; một hàng mcq cũ,
// theo ví dụ của chính skeleton — schema.sql:237 xác nhận essay_answer là
// nullable và không có CHECK).
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

// Ánh xạ kỳ vọng tự soạn độc lập cho q1 ("Literal
// Expected Values" của testing-principles) — tính tay từ QUESTION_ROWS[0] ở trên, không chép từ
// cài đặt của actions.ts.
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

/** Nối fromMock/rpcMock cho toàn bộ chuỗi gọi của submitExam(): exam_attempts
 * (select) -> exams -> claim_attempt_answer_key (RPC: khoá + trả khoá
 * đáp án) -> attempt_answers (upsert) -> exam_results (insert), theo cấu trúc
 * mockGetResultChain của getResult.int.test.ts. `attemptRow.status`
 * quyết định submitExam tiếp tục chấm điểm hay redirect sớm;
 * `examAttemptsUpdateMock` tồn tại chỉ để nghĩa vụ (e) chứng minh nó không bao giờ
 * được gọi — khoá giờ thuộc về RPC. */
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
    // exam_results cố ý KHÔNG được nối: với tới nó qua client của
    // người dùng giờ là lỗi quyền trên production, nên một lời gọi ở đây
    // phải làm test hỏng to chứ không được qua trên một mock thân thiện.
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    attemptAnswersUpsertMock,
    examResultsInsertMock,
    examAttemptsUpdateMock,
  };
}

/** Đúng các bảng mà submitExam() được phép chạm qua client của chính HỌC SINH.
 *  exam_results vắng mặt theo thiết kế (Critical #2) — xem nghĩa vụ (f). */
const EXPECTED_USER_CLIENT_TABLES = [
  "exam_attempts",
  "exams",
  "attempt_answers",
];

/** submitExam() luôn kết thúc (đường thành công) bằng redirect() của next/navigation,
 * thứ ném lỗi luồng điều khiển NEXT_REDIRECT theo thiết kế (thật, không mock —
 * nhất quán với việc test này chỉ phê duyệt ranh giới mock client Supabase).
 * Nuốt đúng lỗi ném ra mong đợi đó để các khẳng định bên dưới chạy
 * sau khi mọi lời gọi DB ở đường thành công đã được thực thi; ném lại
 * mọi thứ khác. */
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

/** schema.sql là DDL mà dự án này áp bằng tay trong Supabase SQL Editor —
 * không có công cụ migration, nên nó LÀ hợp đồng đã triển khai cho hình dạng của RPC. */
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

    // Nửa JS — đúng một lời gọi, trên RPC khoá, cho lượt làm này. Một lượt đọc
    // .from("questions") thường giờ sẽ hỏng trên production với 42501, nên
    // *hình dạng* của lời gọi này là thứ đáng ghim.
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("claim_attempt_answer_key", {
      p_attempt_id: ATTEMPT_ID,
    });

    // Nửa SQL — danh sách cột mà SA-BE-012 nói tới đã chuyển vào
    // RETURNS TABLE của hàm. Bỏ essay_answer ở đó chính là no-op thầm lặng
    // trên production mà khẳng định chuỗi-select ban đầu canh giữ;
    // không mock nào thấy được, nên khẳng định trên chính DDL.
    const returnsTable = /create function public\.exam_answer_key[\s\S]*?\)\s*\nlanguage sql/.exec(
      SCHEMA_SQL
    );
    expect(returnsTable).not.toBeNull();
    expect(returnsTable![0]).toContain("essay_answer");
    // Cộng thêm, không thay thế — sub_answers/correct_answer sẵn có vẫn ở nguyên.
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
    // Không bao giờ bị ép thành null hay "".
    expect(q2.essayAnswer).not.toBeNull();
    expect(q2.essayAnswer).not.toBe("");
  });

  it("obligation (d): the pre-existing mapped fields stay byte-identical to the pre-change mapping for the same fixture row (regression guard)", async () => {
    mockSubmitExamChain({ id: ATTEMPT_ID, exam_id: EXAM_ID, status: "in_progress" });

    await callSubmitExam(ATTEMPT_ID, { q1: "1260", q2: "B" });

    const [questions] = computeScoreSpy.mock.calls[0];
    const q1 = questions.find((q: { id: string }) => q.id === "q1");
    // Literal tự soạn độc lập, không gồm essayAnswer (đã phủ bởi nghĩa vụ b) —
    // chỉ là cột cộng thêm, không logic ánh xạ của trường sẵn có nào đổi.
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

    // Toàn bộ lý do giao khoá đáp án cho một lời gọi JWT học sinh là an toàn
    // là claim_attempt_answer_key() đóng lượt làm trong CÙNG transaction,
    // trước khi trả một hàng nào. Thêm lại một
    // `.from("exam_attempts").update({status:'submitted'})` phía app sau khi chấm
    // trông vô hại và qua mọi khẳng định đầu ra, trong khi báo hiệu rằng
    // khoá đã bị chuyển ngược ra khỏi DB.
    expect(examAttemptsUpdateMock).not.toHaveBeenCalled();
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual(EXPECTED_USER_CLIENT_TABLES);
  });

  it("obligation (f): the score is written through the service-role path, never through the student's own client (security guard, Critical #2)", async () => {
    mockSubmitExamChain({ id: ATTEMPT_ID, exam_id: EXAM_ID, status: "in_progress" });

    await callSubmitExam(ATTEMPT_ID, { q1: "1260", q2: "B" });

    // `authenticated` không còn INSERT trên exam_results (§11a), nên một
    // hồi quy về `supabase.from("exam_results").insert(...)` là 42501 trên
    // production. Mock từ chối thẳng bảng đó, và dòng này ghim
    // mặt dương: đúng một lượt ghi service-role, mang điểm số
    // mà computeScore thực sự tạo ra — và không có tham số user_id, vì
    // record_exam_result() suy ra chủ sở hữu từ lượt làm (§11b).
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

    // KHÔNG được nuốt: lúc đó lượt làm đã bị khoá 'submitted' rồi,
    // nên redirect lặng lẽ sẽ bỏ rơi người dùng ở một trang kết quả mà hàng
    // chưa bao giờ được ghi.
    await expect(submitExam(ATTEMPT_ID, { q1: "1260", q2: "B" })).rejects.toThrow(
      /Could not save your result/
    );
  });
});
