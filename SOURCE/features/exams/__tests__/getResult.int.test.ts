// Bộ khung test integration cho phần mở rộng getResult() [integration]
// Design Doc: docs/design/history-backend-design.md (v1.2)
// PRD: docs/prd/history-prd.md (v1.3, AC-009)
// Sinh ngày: 2026-07-30 | Ngân sách đã dùng: integration 3/3 (file này là suất 3 trong 3
//   theo xếp hạng ROI — xem comment đầu SOURCE/features/history/__tests__/history.int.test.ts
//   để biết kế toán ngân sách cấp tính năng đầy đủ)
//
// Đã chuyển từ skeleton (history backend Task 1.1): phần mở rộng của getResult()
// (select exam_attempts có thêm "started_at, submitted_at"; kiểu ExamResult
// có thêm startedAt/submittedAt) được cài đặt cùng các test này,
// TDD Red -> Green trong một commit.
//
// Ranh giới mock: cùng ranh giới được phê duyệt với history.int.test.ts/rating.int.test.ts
// — chỉ client Supabase (Test Boundaries của backend DD: "Supabase client bên trong
// listMyHistory()/getResult() — Có (mock)").

// =============================================================================
// Test 2 — getResult(): phần mở rộng select mang tính cộng thêm, đầu ra sẵn có
// giống từng byte, các trường mới ánh xạ đúng, đường submittedAt null
// =============================================================================
// AC-009: "Cho một hàng History hoặc trang Kết quả, khi Lưu/Chia sẻ được
//   kích hoạt, thì mọi dữ liệu PDF cần (điểm, tên đề, startedAt/
//   submittedAt) đã có sẵn trong dữ liệu mà trang/hàng đã
//   tải... không thêm lượt khứ hồi backend nào." (nửa của getResult():
//   startedAt/submittedAt phải có mặt trên CHÍNH lời gọi đã thực hiện cho
//   examId/examTitle/result/questions — không bao giờ phát truy vấn thứ hai.)
// Rủi ro hồi quy R-2 (bảng Risks and Mitigation của backend DD): "phần mở rộng của getResult()
//   làm hồi quy một trong 2 nơi tiêu thụ sẵn có nếu không thuần cộng thêm."
//   Cả result/page.tsx lẫn result/detail/page.tsx đều là nơi tiêu thụ đã ship,
//   đang có lưu lượng thật của đầu ra hiện tại của getResult() —
//   đây là bằng chứng tự động duy nhất rằng tính năng này không phá chúng.
// ROI: 80 (BV:9 x Freq:8 + Legal:0 + Defect:8) — getResult() đã nuôi 2
//   trang đã ship; một hồi quy không thuần cộng thêm ở đây phá trang Kết quả
//   hiện có cho mọi người dùng xem bất kỳ lượt làm cũ nào, không chỉ bề mặt
//   History mới — nâng cao hơn ROI "lượt đọc mới" thông thường chính vì
//   bán kính ảnh hưởng về tương thích ngược này.
// Hành vi: getResult(attemptId) được gọi trên ranh giới client Supabase mock
//   -> select exam_attempts có thêm started_at/submitted_at
//   bên cạnh exam_id sẵn có -> khẳng định giá trị và tính null của mọi trường sẵn có
//   giống từng byte với hình dạng trước khi đổi (So sánh đầu ra) và 2 trường mới
//   được ánh xạ đúng từ các cột snake_case mock, kể cả ca
//   submittedAt null có thể xảy ra trong cửa sổ race (truy cập thẳng URL của lượt làm
//   trước khi bước cập nhật trạng thái của submitExam hoàn tất).
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/features/exams/queries.ts (getResult) + client Supabase
//   mock (ranh giới createClient())
// @complexity: low
// @real-dependency: không có — cùng ranh giới mock được phê duyệt như
//   history.int.test.ts; test này chỉ chứng minh tính đúng của cách dựng lời gọi/ánh xạ JS,
//   không chứng minh ngữ nghĩa Postgres thật (không cái nào mới được đưa vào
//   bởi thay đổi cộng thêm này).
// Kiểu hỏng chính: select exam_attempts lặng lẽ bỏ hoặc gọi sai tên
//   một trong 2 cột mới (ví dụ select "started_at" mà không có
//   "submitted_at"); HOẶC phần mở rộng vô tình đổi giá trị hoặc tính null của một
//   trường sẵn có (examId, examTitle, result.totalScore/correct/
//   total/perQuestion/topicBreakdown, hay questions); HOẶC submitted_at null bị
//   ép thành chuỗi rỗng hoặc bị bỏ khỏi object trả về thay vì
//   giữ đúng `null` trên ExamResult.submittedAt.
// Gộp lượt khứ hồi (đợt hiệu năng 2026-08-03): getResult() trước đây phát 4
//   lượt khứ hồi tuần tự (exam_results -> exam_attempts -> exams_with_difficulty
//   qua getExam() -> questions, đo ~816ms). 3 lượt đầu giờ là một request
//   PostgREST duy nhất nhúng exam_attempts và, qua nó, view
//   exams_with_difficulty (~385ms, đã kiểm đầu ra giống hệt chuỗi cũ trên DB thật).
//   Các nghĩa vụ (a)-(c) bên dưới không đổi về bản chất; các cột của
//   (a) chỉ chuyển vào phần nhúng, và (d)/(e) được thêm vì việc gộp
//   trao cho hàm này hai trách nhiệm mới của riêng nó: mang chốt hiển thị-đã-đăng
//   của getExam(), và giữ nguyên trạng thái đã gộp.
// Nghĩa vụ chứng minh:
//   (a) Phần mở rộng cộng thêm (hình dạng truy vấn) — select exam_results nhúng
//       exam_attempts!inner(...) và phép chiếu đó vẫn mang cả
//       started_at lẫn submitted_at (bỏ cột nào cũng vẫn phá AC-009).
//   (b) So sánh đầu ra — với một bộ hàng fixture attempt/result/exam/questions,
//       sub-object sẵn có của ExamResult trả về
//       { examId, examTitle, result, questions } toEqual một giá trị fixture literal
//       tự soạn độc lập (không chỉ "whatever mock trả về không đổi" — theo
//       "Literal Expected Values" của testing-principles, giá trị kỳ vọng phải được tính
//       độc lập với cài đặt để một hồi quy thật bị bắt); startedAt là
//       chuỗi không rỗng bằng started_at của fixture; submittedAt
//       bằng submitted_at của fixture (ca không null).
//   (c) Đường submittedAt null — với hàng exam_attempts mock mà
//       submitted_at là null, ExamResult.submittedAt === null đúng như vậy (không bị
//       ép thành "" và không bị bỏ như một khoá thiếu khỏi object
//       trả về).
//   (d) Chốt hiển thị sống sót sau khi gộp — join áp dụng
//       .eq("exam_attempts.exams_with_difficulty.status", "published"), chốt
//       trước đây thuộc getExam(). Thiếu nó, kết quả của một đề chưa đăng/đã rút
//       sẽ đọc được: hồi quy về khả năng hiển thị, không phải về hiệu năng.
//   (e) Chốt không hồi quy lượt khứ hồi — join đã gộp không bao giờ được
//       tách lại thành các lượt khứ hồi TUẦN TỰ. Engine 1 thêm lượt đọc exam_results
//       thứ hai (lịch sử wrong-twice xuyên lượt làm) phát trong cùng
//       Promise.all, nên chỉ đếm số lời gọi không còn phân biệt được
//       "song song" với "tách lại": nghĩa vụ vì vậy được chứng minh bằng cách
//       giữ mở CẢ HAI lượt đọc trên cổng riêng của chúng và khẳng định cả hai đã
//       được phát trong khi CHƯA cái nào resolve. Chỉ giữ mở một lượt sẽ làm
//       chốt chặn có hướng — thứ tự tuần tự ngược lại vẫn xanh.
//       Tách lại sẽ huỷ tối ưu hoá trong khi mọi khẳng định đầu ra
//       vẫn qua.
//   (f) hasBeenWrongTwice đầu-cuối (Engine 1 backend task 09) — cờ được
//       tính từ lịch sử xuyên lượt làm và chỉ áp lên các hàng đã chấm,
//       sai, và lượt đọc lịch sử KHÔNG có phạm vi (không .eq() nào thu hẹp nó
//       về một đề/lượt làm). Các nghĩa vụ (a)-(e) đều qua khi lịch sử
//       ánh xạ ra không gì, tức khi tính năng chết vĩnh viễn; đây là
//       nghĩa vụ duy nhất hỏng. Nó cần một builder giả thenable, vì lượt đọc lịch sử
//       await trực tiếp builder chứ không qua .maybeSingle().
//   (g) Suy giảm của phần làm giàu cộng thêm — một lượt đọc lịch sử lỗi KHÔNG được reject
//       getResult(). Lượt đọc join vẫn fail-loud (không có hàng nghĩa là không có trang), nhưng
//       lượt này là chặn hiển thị: khi lỗi nó ghi log và trả lịch sử RỖNG,
//       nên không hàng nào bị gắn cờ. UI Spec § D1 / AC-024 định nghĩa false và vắng mặt
//       là cùng một trạng thái fail-closed ("Absent/false = affordance không
//       render"), nên công thức ánh xạ được áp dụng không đổi và không cần
//       chế độ "lịch sử không khả dụng" riêng.
//       Thiếu điều này, một sự cố thoáng qua của một tính năng mà trang đã ship mà không có nó
//       sẽ phá cả trang chi tiết kết quả đang chạy.
// Điểm kiểm chứng / kết quả mong đợi / tiêu chí qua:
//   - Nghĩa vụ (a): tham số lời gọi .select() được ghi lại của mock exam_attempts
//     bằng đúng chuỗi literal
//     "exam_id, started_at, submitted_at".
//   - Nghĩa vụ (b): `toEqual` trên sub-object
//     { examId, examTitle, result, questions } đã trích so với một object fixture
//     kỳ vọng literal tự soạn độc lập với giá trị trả về của mock;
//     startedAt là chuỗi không rỗng khớp started_at của fixture;
//     submittedAt (ca chuỗi) bằng submitted_at của fixture.
//   - Nghĩa vụ (c): ExamResult.submittedAt === null (bằng nghiêm ngặt); khoá
//     "submittedAt" có mặt trên object trả về
//     (Object.prototype.hasOwnProperty.call(result, "submittedAt") === true),
//     không bị vắng mặt một cách lặng lẽ.

// Khoá đáp án (2026-08-03, Security review Critical #1): lượt khứ hồi thứ 2 giờ là
// supabase.rpc("exam_answer_key") thay vì .from("questions") —
// sub_answers/essay_answer bị REVOKE khỏi role `authenticated`, nên hàm
// SECURITY DEFINER (schema.sql §10a) là đường duy nhất còn trả chúng,
// và chỉ cho tác giả của đề hoặc người đã nộp một lượt làm trên đề đó.
// Nghĩa vụ (e) đếm lượt đó là .rpc() chứ không phải một .from() thứ hai.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

// queries.ts import "server-only" (ném lỗi ngoài bundle server Next/react-server)
// → stub, cùng mẫu với rating.int.test.ts.
vi.mock("server-only", () => ({}));

// Ranh giới mock: chỉ client Supabase (Test Boundaries của backend DD) — chứng minh cách dựng
// lời gọi JS; thay đổi cộng thêm này không đưa vào ngữ nghĩa Postgres thật nào mới.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock, rpc: rpcMock })),
}));

const { getResult } = await import("@/features/exams/queries");

const ATTEMPT_ID = "attempt-1";

// hàng exam_results (dạng DB, snake_case) — nuôi ScoreResult; task này không đụng.
const RESULT_ROW = {
  total_score: 8.5,
  correct: 4,
  total: 5,
  per_question: [{ questionId: "q1", selected: "A", correct: "A", isCorrect: true, scored: true }],
  topic_breakdown: [{ topic: "Algebra", correct: 1, total: 1 }],
};

// Phép chiếu exams_with_difficulty nhúng — getResult() chỉ select id/title
// qua join, vì đó là hai trường duy nhất nó đưa ra.
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

// Fixture kỳ vọng tự soạn độc lập cho hình dạng đầu ra SẴN CÓ của getResult()
// ({ examId, examTitle, result, questions }) — tính tay từ
// RESULT_ROW/EXAM_ROW/QUESTION_ROWS ở trên, không chép từ cài đặt
// ("Literal Expected Values" của testing-principles).
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

/** Nối fromMock cho chuỗi gọi của getResult(), giờ là 2 lượt khứ hồi thay vì 4:
 * exam_results (với exam_attempts -> exams_with_difficulty nhúng trong cùng
 * request) -> questions. `attemptRow` điều khiển phần mở rộng đang kiểm
 * (started_at/submitted_at); các mock/recorder trả về nuôi các nghĩa vụ
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

    // 2 cột giờ được yêu cầu qua phần nhúng thay vì một lượt khứ hồi
    // exam_attempts riêng, nhưng bỏ cột nào cũng vẫn phá AC-009 — nên
    // nghĩa vụ không đổi về bản chất, chỉ đổi ở chỗ các cột xuất hiện.
    //
    // Join được định vị theo HÌNH DẠNG của nó, không theo chỉ số lời gọi: hai lượt đọc exam_results
    // giờ dùng chung recorder này (join và lượt đọc lịch sử xuyên lượt làm), và
    // đổi chỗ hai mục trong Promise.all của getResult() có hành vi
    // y hệt nhưng sẽ lật chỉ số và làm nghĩa vụ này hỏng giả.
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

    // Gộp lời gọi getExam() vào join này đã chuyển chốt
    // .eq("status","published") của nó về đây. Mất nó thì sẽ lộ kết quả của
    // một đề chưa đăng/đã rút — hồi quy về khả năng hiển thị, không phải về hiệu năng.
    expect(eqCalls).toContainEqual(["attempt_id", ATTEMPT_ID]);
    expect(eqCalls).toContainEqual(["exam_attempts.exams_with_difficulty.status", "published"]);
  });

  it("obligation (e): the joined read and the cross-attempt history read are both in flight before EITHER resolves, and the answer key still costs exactly one further round trip (no-regression guard on the round-trip collapse)", async () => {
    // Cố ý KHÔNG dùng mockGetResultChain: nghĩa vụ này cần giữ mở CẢ HAI lượt đọc exam_results
    // giữa chừng, điều mà helper dùng chung kia không diễn đạt được. Chỉ giữ
    // mở một lượt làm chốt chặn có hướng: thứ tự tuần tự ngược lại
    // (lịch sử trước, rồi join) vẫn xanh.
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
        // Lượt đọc join hoàn tất qua maybeSingle()...
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
        // ...lượt đọc lịch sử tự await builder (builder PostgREST là
        // thenable), nên lượt khứ hồi của nó hoàn tất ở đây.
        then: (onFulfilled: (value: unknown) => unknown) =>
          historyGate.then(() => {
            historySettled = true;
            return onFulfilled({ data: [], error: null });
          }),
      };
      return builder;
    });

    const pending = getResult(ATTEMPT_ID);
    // Một ranh giới macrotask xả mọi microtask đang chờ, nên đến đây
    // cài đặt đã phát mọi lượt đọc nó sẽ phát trước khi cổng nào mở. Xác
    // định, không phải race.
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Từng là 4 lượt khứ hồi TUẦN TỰ (exam_results -> exam_attempts -> exams_with_
    // difficulty -> questions, đo ~816ms); phần nhúng gộp 3 lượt đầu
    // thành một (~385ms). Một lần sửa sau này tách lại sẽ lặng lẽ huỷ
    // điều đó mà không làm hỏng khẳng định đầu ra nào.
    //
    // Engine 1 thêm lượt đọc exam_results thứ 2 (lịch sử xuyên lượt làm) trong
    // CÙNG Promise.all, nên đếm lời gọi .from() không còn phân biệt được
    // "song song" với "tách lại". Thuộc tính được canh thay vào đó là đối xứng:
    // cả hai lượt đọc đã được phát trong khi CHƯA cái nào resolve. Cả hai thứ tự
    // tuần tự — join-rồi-lịch-sử hay lịch-sử-rồi-join — đều để lại đúng một lời gọi
    // được ghi ở đây và làm hỏng.
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual(["exam_results", "exam_results"]);
    expect({ joinSettled, historySettled }).toEqual({ joinSettled: false, historySettled: false });

    releaseJoin();
    releaseHistory();
    await pending;

    // Điều nghĩa vụ này KHÔNG canh: chi phí của chính các lượt đọc song song
    // (lượt đọc exam_results song song thứ 3 vẫn qua phép kiểm ở trên
    // khi được thêm vào literal này), cũng như lượt đọc lịch sử trả về gì —
    // đó là việc của nghĩa vụ (f). Điều ĐƯỢC canh: không gì trở nên tuần tự,
    // và khoá đáp án vẫn tốn đúng một lượt nữa, dựa vào đề
    // mà join đã giải quyết (không tra cứu thêm) — nó thành RPC khi
    // các cột đáp án bị khoá (Critical #1).
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
    // Lượt làm đang xem — ba nhánh của công thức chặn
    // (chấm-và-sai / đúng / không chấm), soạn tay.
    const viewedPerQuestion = [
      { questionId: "q-wrong-twice", selected: "A", isCorrect: false, scored: true },
      { questionId: "q-correct", selected: "B", isCorrect: true, scored: true },
      { questionId: "q-essay", selected: "bài làm", isCorrect: false, scored: false },
    ];
    // Lịch sử exam_results ĐẦY ĐỦ của người dùng này, tức thứ lượt đọc không phạm vi trả về.
    // q-wrong-twice: chấm-sai ở 2 lượt làm KHÁC NHAU                  -> đủ điều kiện.
    // q-essay:       sai ở đúng 2 lượt làm đó nhưng scored:false      -> không bao giờ đủ điều kiện.
    // q-correct:     đúng suốt                                       -> không đủ điều kiện.
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
        // Builder truy vấn PostgREST là THENABLE và lượt đọc lịch sử await trực tiếp
        // builder (không có .maybeSingle()). Thiếu điều này, `await builder`
        // cho ra chính object builder, data/error destructure ra undefined, lịch sử
        // rơi về [] — và ánh xạ nó ra không gì sẽ qua mọi nghĩa vụ
        // khác trong file này trong khi tính năng chết vĩnh viễn.
        then: (onFulfilled: (value: unknown) => unknown) =>
          Promise.resolve().then(() => onFulfilled({ data: historyRows, error: null })),
      };
      return builder;
    });

    const result = await getResult(ATTEMPT_ID);

    expect(result).not.toBeNull();
    const [wrongTwiceRow, correctRow, essayRow] = result!.result.perQuestion;

    // Đã chấm + hiện đang sai + sai ở >=2 lượt làm khác nhau -> true, với mọi
    // trường sẵn có của hàng được mang qua không đụng tới.
    expect(wrongTwiceRow).toEqual({
      questionId: "q-wrong-twice",
      selected: "A",
      isCorrect: false,
      scored: true,
      hasBeenWrongTwice: true,
    });
    // Cờ vô nghĩa với hàng đúng và hàng không chấm: undefined,
    // không phải false (luật của UI Spec D1, áp phía người tiêu dùng bởi getResult()).
    expect(correctRow.questionId).toBe("q-correct");
    expect(correctRow.hasBeenWrongTwice).toBeUndefined();
    expect(essayRow.questionId).toBe("q-essay");
    expect(essayRow.hasBeenWrongTwice).toBeUndefined();

    // Lượt đọc lịch sử phải trải trên MỌI lượt làm của người dùng. RLS (results_select_own)
    // đã giới hạn nó theo người gọi, nên mọi .eq() ở đây sẽ thu hẹp thêm —
    // đó là chỗ kiểu hỏng giới-hạn-theo-đề/theo-lượt-làm thật sự nằm, và
    // nó không biểu diễn được trong chính computeWrongTwiceQuestionIds() (kiểu đầu vào của nó
    // không mang danh tính đề nào cả).
    expect(historyEqCalls).toEqual([]);
    // attempt_id là thứ làm "2 lượt làm KHÁC NHAU" đếm được; bỏ nó sẽ
    // gộp mọi hàng thành một lượt làm vô danh.
    expect(historySelectArg).toContain("attempt_id");
    expect(historySelectArg).toContain("per_question");
  });

  it("obligation (g): a failing history read degrades to no flag instead of rejecting the whole page", async () => {
    // Cùng lượt làm đang xem như (f) — hàng đầu tiên của nó SẼ là hasBeenWrongTwice:true
    // nếu lượt đọc lịch sử thành công, nên fixture này cô lập sự suy giảm.
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
        // Lượt đọc join vẫn thành công: dữ liệu lõi của trang ổn, đúng là
        // tình huống mà reject sẽ là hành vi sai.
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

    // Resolve chứ không reject — trang chi tiết kết quả đã ship tiếp tục
    // chạy khi chỉ phần làm giàu cộng thêm này lỗi.
    expect(result).not.toBeNull();
    expect(result!.examId).toBe("exam-1");
    expect(result!.examTitle).toBe("Sample Exam");
    expect(result!.result.totalScore).toBe(8.5);
    // Fail-closed theo UI Spec § D1 / AC-024, coi false và vắng mặt
    // như nhau ("hasBeenWrongTwice false hoặc vắng -> không render").
    // Lịch sử suy giảm là lịch sử RỖNG, nên công thức của Reference Contract
    // được áp dụng không đổi và một hàng đã chấm+sai cho ra false — không phải
    // undefined. Ép undefined ở đây nghĩa là dạy phép ánh xạ phân biệt
    // "lịch sử không khả dụng" với "lịch sử rỗng": một chế độ mới cho không
    // khác biệt quan sát được nào. Thuộc tính quan trọng là nó không bao giờ là true.
    expect(result!.result.perQuestion[0].questionId).toBe("q-wrong-twice");
    expect(result!.result.perQuestion[0].hasBeenWrongTwice).toBe(false);
    // Hàng đúng vẫn bị chặn hoàn toàn.
    expect(result!.result.perQuestion[1].hasBeenWrongTwice).toBeUndefined();

    // Sự suy giảm được ghi log, không bị nuốt — và log không mang nội dung hàng nào.
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
// Test 3 — getResult(): created_at trong select, và ba trường tự luận suy ra
//          được gắn lúc đọc (ADR-0018, Task B2.1)
// =============================================================================
// AC: EG-BE-023 (biên hạn chót, LOẠI TRỪ `>`), EG-BE-024/025 (khoá thiếu
//   là im lặng; giá trị không nhận ra cảnh báo đúng một lần và không bao giờ mang
//   bài viết của học sinh), EG-BE-026 (`retryAvailable` là boolean và không có số lần
//   thử nào chuyển sang client), EG-BE-027 (chỉ `graded` đóng góp vào earned
//   VÀ max), EG-BE-031/AC-012 (hàng ghi trước khi tính năng ship đọc ra
//   giống hệt hôm nay).
// @lane: integration
// @dependency: SOURCE/features/exams/queries.ts (getResult) + SOURCE/lib/scoring/essayLifecycle.ts
//   THẬT + client Supabase mock
// @real-dependency: không có — cùng ranh giới createClient() được phê duyệt như Test 2.
//
// FILE NÀY BỔ SUNG GÌ SO VỚI unit test của chính essayLifecycle, thứ duy nhất
// biện minh cho việc các ca nằm ở đây: H1 chứng minh các phép suy ra. File này
// chứng minh TẦNG TRUY VẤN cấp chúng đúng — rằng `created_at` thực sự được
// yêu cầu, rằng giá trị trao cho `deriveEssayView` là timestamp của chính `exam_results`
// chứ không phải của lượt làm, và một `now` đóng băng được cả
// ba lần gắn dùng chung. Không điều nào trong đó nhìn thấy được bởi test hàm thuần.
//
// THỜI GIAN ĐƯỢC ĐÓNG BĂNG, không bao giờ đọc từ đồng hồ thật: hạn chót là 600 000 ms và
// biên là loại trừ, nên đồng hồ thật biến ba ca bên dưới thành
// ba quả bom hẹn giờ — xanh hôm nay, đỏ vào một buổi chiều không ai đụng tới.

const ESSAY_NOW = new Date("2026-08-29T12:00:00.000Z");
const DEADLINE_MS = 600_000;

/** các giá trị created_at biểu diễn như độ lệch so với `now` đóng băng, để
 *  quan hệ mà mỗi ca nói tới nhìn thấy được ngay ở nơi gọi thay vì
 *  ẩn trong hai chuỗi ISO mà người đọc phải tự trừ. */
function createdAtBefore(ms: number): string {
  return new Date(ESSAY_NOW.getTime() - ms).toISOString();
}

const ESSAY_EXAM = { id: "exam-essay", title: "Đề có câu tự luận", subject: "Ngữ văn" };
const ESSAY_STARTED_AT = "2026-08-29T11:00:00.000Z";
const ESSAY_SUBMITTED_AT = "2026-08-29T11:50:00.000Z";

/** Một phần tử `per_question` đã lưu không có khoá `essay*` nào cả — hình dạng
 *  cũ / tính-năng-tắt, giống từng byte với thứ `computeScore()` phát ra hôm nay. */
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

/** Nối client mock cho hai lượt khứ hồi của getResult() với một hàng kết quả dạng tự luận.
 *  Cố ý là helper riêng, khác `mockGetResultChain`: cái này
 *  điều khiển `per_question` và `created_at` mà cái kia không diễn đạt được, và
 *  mở rộng helper dùng chung sẽ làm fixture của Test 2 phụ thuộc vào task này. */
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

    // Định vị theo hình dạng, không theo chỉ số — hai lượt đọc exam_results dùng chung recorder này.
    const joinSelectArg = selectArgs.find((arg) => arg.includes("exam_attempts!inner("));
    expect(joinSelectArg).toBeDefined();
    expect(joinSelectArg).toContain("created_at");
    // KHÔNG được thoả bởi timestamp của lượt làm: hạn chót đo từ lúc hàng
    // KẾT QUẢ được ghi, và hai mốc lệch nhau bằng khoảng thời gian
    // record_exam_result() chạy. Một select chỉ mang submitted_at sẽ qua
    // mọi khẳng định trên đầu ra đã ánh xạ, vì mock trả về
    // bất cứ thứ gì nó được yêu cầu.
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

      // Ca giữa là ca quan trọng. `>=` thay vì `>` đảo nó và
      // không gì khác trong bộ test nhận ra: một lượt làm đọc đúng vào
      // hạn chót sẽ bị báo là chấm hỏng trong khi một writer vẫn có thể
      // còn sống.
      expect(result!.result.perQuestion[0].essay?.state).toBe(expected);
    },
  );

  it("EG-BE-024: an element with no essay key yields essay === undefined and logs NOTHING", async () => {
    mockEssayResultChain([LEGACY_ELEMENT], createdAtBefore(DEADLINE_MS * 10));

    const result = await getResult(ATTEMPT_ID);

    expect(result!.result.perQuestion[0].essay).toBeUndefined();
    // Một cảnh báo cho mỗi câu cũ mỗi lần render sẽ biến mọi trang kết quả cũ
    // thành lũ log, và việc hạn chót đã qua lâu không được đổi điều đó.
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

    // AC-056: câu trả lời của học sinh là UGC và không bao giờ vào log server. Khẳng định
    // trên payload đã serialise chứ không phải hình dạng object — kiểu hỏng
    // mà nó canh là bài viết đến qua một trường mà không ai nghĩ tới.
    const logged = JSON.stringify(warnSpy.mock.calls[0]);
    expect(logged).toContain("q-essay");
    expect(logged).toContain("in_review");
    expect(logged).not.toContain("Bài làm của học sinh");
  });

  it("EG-BE-025 second half: a mixed row warns once for the bad element and the summary counts only the derivable ones", async () => {
    // Bộ lọc giữ số cảnh báo ở mức một không được đồng thời bỏ một
    // phần tử TỐT khỏi các số tổng hợp. Đây là ca phân biệt
    // "cảnh báo một lần" với "cảnh báo một lần vì nó thôi nhìn".
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
    // Tập khoá vét cạn, không phải "essayAttempts vắng mặt": AC-044 cấm SỐ ĐẾM
    // tới client, và một số đếm bị đổi tên trên đường ra sẽ qua
    // mọi khẳng định chỉ kiểm tên cũ.
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

    // Tự soạn độc lập: 1 câu đã chấm ⇒ max là 1, KHÔNG phải 3. Một bài failed
    // cộng 0 vào earned và 1 vào max là số 0 thầm lặng mà AC-015 cấm, và nó
    // trông hoàn toàn hợp lý tại lúc ai đó viết ra.
    expect(result!.essaySummary).toEqual({
      earned: 0.75,
      max: 1,
      gradedCount: 1,
      pendingCount: 1,
      failedCount: 1,
      unresolvedCount: 1,
    });
    // RS-6 = failed VÀ hết lượt thử. q-exhausted là câu duy nhất.
    expect(result!.hasIncompleteEssay).toBe(true);
  });

  it("EG-BE-031 / AC-012: a legacy row reads out IDENTICALLY to today — the whole ExamResult equals a hand-built pre-change literal", async () => {
    mockEssayResultChain([LEGACY_ELEMENT], createdAtBefore(DEADLINE_MS * 10));

    const result = await getResult(ATTEMPT_ID);

    // Dựng tay từ hàng mock ở trên, theo hình dạng getResult() trả về
    // TRƯỚC task này — cộng một trường mới bắt buộc. Đây là mép sắc nhất của AC-012:
    // nếu một hàng cũ mọc ra một trường có giá trị, "không backfill" đã vỡ
    // trên đường ĐỌC, nơi khó thấy hơn nhiều so với đường ghi.
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

    // `toEqual` coi khoá chứa `undefined` là vắng mặt, nên hai trường
    // phải VẮNG-HOẶC-UNDEFINED được khẳng định riêng thay vì
    // được tin vào phép so sánh ở trên.
    expect(result!.essaySummary).toBeUndefined();
    expect(result!.result.perQuestion.every((r) => r.essay === undefined)).toBe(true);
    // Bắt buộc, luôn tính được — một chú thích PDF không thể được quyết định bởi một
    // `undefined`, nên kiểu là `boolean` mới chỉ là nửa bảo đảm.
    expect(typeof result!.hasIncompleteEssay).toBe("boolean");
  });
});
