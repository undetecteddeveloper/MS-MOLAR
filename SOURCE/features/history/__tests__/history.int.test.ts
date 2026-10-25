// History [integration] Bộ khung test
// Design Docs: docs/design/history-backend-design.md (v1.2), docs/design/history-frontend-design.md (v1.3)
// PRD: docs/prd/history-prd.md (v1.3, AC-001..AC-019)
// UI Spec: docs/ui-spec/history-ui-spec.md (v1.1)
// Sinh ngày: 2026-07-30 | Ngân sách đã dùng: integration 3/3, fixture-e2e 3/3, service-integration-e2e 0/2
//
// Đã chuyển thành vitest thật (backend Task 03) — listMyHistory() được cài đặt trong
// ../queries.ts; import + các khối describe/it được thêm bên dưới, cùng với code
// thật, trong cùng commit (Red -> Green).
//
// Ranh giới mock (Test Boundaries của backend DD): client Supabase
// (createClient()) là mock được phê duyệt — chứng minh cách dựng lời gọi JS (hình dạng
// truy vấn, tham số .in()/.eq()/.order() và thứ tự gọi, theo phong cách
// fromMock/createQueryBuilder đã thiết lập của rating.int.test.ts), không phải
// ngữ nghĩa Postgres thật. Hành vi RLS Postgres thật cho ca biên
// bỏ-hàng-theo-hiển-thị-đề (R-1) KHÔNG chứng minh được bởi file này — xem ca bắt buộc,
// chặn H-a trong SOURCE/supabase/test-rls.ts (thêm trong cùng lượt sinh này).
//
//-----------------------------------------------------------------------------
// Gộp lượt khứ hồi (đợt hiệu năng 2026-08-03) — ĐỌC TRƯỚC KHI SỬA
// -----------------------------------------------------------------------------
// listMyHistory() từng phát 3 lượt khứ hồi tuần tự (exam_results ->
// exam_attempts -> exams, đo ~580ms). Giờ nó là MỘT request PostgREST
// nhúng exam_attempts và, qua nó, exams (~193ms; đã kiểm đầu ra giống từng byte
// với chuỗi cũ trên DB thật với tài khoản 37 hàng).
//
//Điều này dịch chuyển NƠI mà một số nghĩa vụ chứng minh được, đổi thứ file này
// có thể tuyên bố trung thực:
//   - MẠNH HƠN nay: thứ tự (AC-003) chuyển từ .order() của DB sang phép sắp xếp
//     JS của chính ta, nên là hành vi thật mà file này thực thi được — nghĩa vụ (c) giờ
//     đưa vào các hàng cố ý xáo trộn và khẳng định thứ tự đầu ra, thay vì
//     chỉ khẳng định .order() đã được gọi. No-N+1 (f) cũng siết lại
//     từ "exams được truy vấn một lần" thành "đúng một lượt khứ hồi, tổng cộng".
//   - YẾU HƠN nay ở ranh giới này: bộ lọc chỉ-đã-nộp (a) và việc bỏ hàng theo
//     hiển thị đề (e) từng là JS mà mock thực thi được; giờ chúng là
//     vị từ phía DB (.eq + !inner). Với client mock, tất cả những gì
//     file này chứng minh là các vị từ đó vẫn ĐƯỢC GẮN vào truy vấn
//     — không phải Postgres tôn trọng chúng. Nửa hành vi đó giờ hoàn toàn dựa vào
//     SOURCE/supabase/test-rls.ts ca H-a (Postgres thật), vốn đã là thẩm quyền được chỉ định
//     của tính năng này đúng vì lý do đó.
//     Xoá một khẳng định vị từ bên dưới do đó là gỡ chốt phản hồi nhanh duy nhất
//     chống việc lặng lẽ rơi mất một bộ lọc hiển thị.

// =============================================================================
// Test 1 — listMyHistory(): lọc đã-nộp+đã-chấm, thứ tự, độ đầy đủ trường,
// bỏ hàng theo hiển thị đề, một-lượt-khứ-hồi, ném-lỗi-khi-lỗi
// =============================================================================
// AC-001: "Cho một người dùng có lẫn lượt làm dở dang và lượt làm đã hoàn thành+đã chấm,
//   khi họ mở /history, thì chỉ các hàng có status='submitted'
//   và có bản ghi exam_results mới xuất hiện — không lượt làm dở nào
//   được hiện." [rủi ro được gắn cờ cao nhất của chính PRD, R-1 trong backend
//   DD — ca biên bỏ-hàng-theo-hiển-thị-đề thuộc cùng phạm vi AC này.]
// AC-002: "Cho một người dùng không có lượt làm đã hoàn thành+đã chấm nào, khi họ mở
//   /history, thì trạng thái rỗng render... [listMyHistory() resolve thành []
//   mà không ném lỗi]."
// AC-003: "...khi danh sách render, thì các hàng xếp theo submitted_at
//   giảm dần."
// AC-004/AC-005: "...nó hiện tên đề, điểm dạng X/10, ngày nộp,
//   và thời gian hoàn thành..." / "...họ đến
//   /exams/[id]/attempt/[attemptId]/result đúng lượt làm đó" —
//   MyHistoryEntry phải mang mọi trường mà cả hai AC cần (examTitle, totalScore,
//   startedAt, submittedAt, attemptId, examId), không trường nào bị rơi lặng lẽ.
// AC-019: "Cho một lượt đọc danh sách /history thất bại (ví dụ lỗi DB/mạng)...
//   người dùng thấy thông báo lỗi hành động được... và có thể thử tải lại."
//   (nửa backend: listMyHistory() phải ném lỗi, không bao giờ resolve ra kết quả
//   một phần/thầm lặng, để error boundary error.tsx của frontend bắt được.)
// Ca biên hiển thị đề (backend DD, rủi ro R-1): một đề tự soạn sau đó bị
//   đảo khỏi 'published' phải bị BỎ khỏi danh sách. Luật không đổi;
//   việc cưỡng chế chuyển từ một lần tra tiêu đề JS trượt sang các vị từ
//   `exams!inner` + .eq(...exams.status,"published") của chính truy vấn. File này
//   chỉ chứng minh các vị từ đó vẫn được gắn; hành vi Postgres thật
//   vẫn hoàn toàn là việc của ca H-a trong test-rls.ts.
// ROI: 99 (BV:10 x Freq:9 + Legal:0 + Defect:9) — đây là file đo Success
//   Criteria được đặt tên của chính PRD (#1, "Độ đúng phạm vi danh sách"); mọi
//   lần tải trang /history của mọi người dùng đều phụ thuộc vào hàm duy nhất này.
// Hành vi: listMyHistory() được gọi trên ranh giới client Supabase mock
//   (MỘT lời gọi .from("exam_results") mà select nhúng exam_attempts
//   và exams) -> khẳng định MyHistoryEntry[] trả về khớp các bảo đảm nội dung/thứ tự/
//   lọc của AC-001/002/003/004/005, các vị từ thu hẹp phạm vi vẫn được gắn vào truy vấn,
//   đúng một lượt khứ hồi được phát, và một lỗi Supabase reject
//   promise thay vì resolve ra [] hay dữ liệu một phần.
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/features/history/queries.ts (listMyHistory) + client Supabase
//   mock (ranh giới createClient())
// @complexity: medium
// @real-dependency: không có — client Supabase là ranh giới mock được phê duyệt
//   theo Test Boundaries của backend DD ("Supabase client bên trong listMyHistory()/
//   getResult() — Có (mock)"). Bản thân hành vi bỏ-hàng RLS exams_select_visible
//   rõ ràng KHÔNG chứng minh được bởi mock này (backend DD: "Mock không thể
//   chứng minh lọc RLS... cần DB thật") — xem ca bắt buộc,
//   chặn H-a trong SOURCE/supabase/test-rls.ts cho nửa đó.
// Kiểu hỏng chính: vị từ chỉ-đã-nộp hoặc chỉ-đã-đăng bị rơi khỏi truy vấn
//   (để một lượt làm dở dang, hoặc lượt làm của đề đã rút, rò vào danh sách); HOẶC danh sách không được sắp
//   submitted_at giảm dần; HOẶC một lỗi Supabase resolve ra [] / dữ liệu một phần
//   thay vì reject; HOẶC join đơn bị tách lại thành các lượt khứ hồi theo từng bảng
//   (huỷ tối ưu hiệu năng trong khi mọi khẳng định đầu ra vẫn xanh).
// Nghĩa vụ chứng minh:
//   (a) AC-001 — truy vấn bắt đầu TỪ exam_results (nên lượt làm không có
//       điểm không thể xuất hiện) và gắn cả hai vị từ phạm vi:
//       `exam_attempts!inner` với .eq("exam_attempts.status","submitted").
//       Bỏ cái nào cũng là cách một lượt làm dở dang rò ra.
//   (b) AC-002 — phản hồi không hàng resolve thành [] (nghiêm ngặt), không bao giờ null/undefined.
//   (c) AC-003 — với các hàng giao theo thứ tự cố ý xáo trộn, mảng
//       resolve được sắp theo submittedAt GIẢM DẦN. (Hành vi thật nay:
//       phép sắp xếp là của ta, không phải của DB.)
//   (d) AC-004/AC-005 (độ đầy đủ trường) — mỗi mục resolve có
//       attemptId, examId, examTitle, subject, totalScore, startedAt,
//       submittedAt đều được điền từ hàng mock (không trường nào bị rơi
//       hay ép kiểu lặng lẽ), đối chiếu với literal tự soạn độc lập.
//   (e) Ca biên hiển thị đề (R-1, CHỈ nửa hình dạng truy vấn — xem test-rls.ts
//       ca H-a cho nửa hành vi) — truy vấn gắn `exams!inner`
//       và .eq("exam_attempts.exams.status","published"), nên một
//       đề không published làm rơi cả hàng của nó thay vì render với tiêu đề giữ chỗ.
//   (f) Chốt một-lượt-khứ-hồi (thay thế nghĩa vụ no-N+1 cũ) —
//       đúng một lời gọi .from() được phát, và nó là "exam_results". Đây vừa là
//       bảo đảm no-N+1 (NFR Performance) vừa là chốt hồi quy cho việc gộp
//       3-truy-vấn -> 1-truy-vấn.
//   (g) AC-019 — một lỗi Supabase giả lập làm promise trả về
//       reject, không bao giờ resolve ra [] hay mảng một phần.
// Điểm kiểm chứng / kết quả mong đợi / tiêu chí qua:
//   - Nghĩa vụ (a): tham số gọi duy nhất của fromMock === "exam_results"; tham số
//     .select() được ghi chứa "exam_attempts!inner("; các lời gọi
//     .eq() được ghi chứa ["exam_attempts.status", "submitted"].
//   - Nghĩa vụ (b): mảng resolve === [] (nghiêm ngặt, không phải undefined/null).
//   - Nghĩa vụ (c): với các hàng cung cấp cũ-nhất-trước, chuỗi submittedAt
//     resolve giảm dần nghiêm ngặt.
//   - Nghĩa vụ (d): toEqual so với một mục kỳ vọng literal soạn
//     độc lập với giá trị trả về của mock.
//   - Nghĩa vụ (e): tham số .select() được ghi chứa "exams!inner(";
//     các lời gọi .eq() được ghi chứa
//     ["exam_attempts.exams.status", "published"].
//   - Nghĩa vụ (f): fromMock.mock.calls.length === 1.
//   - Nghĩa vụ (g): `await expect(listMyHistory()).rejects.toBeTruthy()` khi
//     phản hồi mock mang `error` khác null.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LIST_ROW_CEILING } from "@/lib/supabase/boundedRead";
import { summariseEssays } from "@/lib/scoring/essayLifecycle";

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

// queries.ts import "server-only" (ném lỗi ngoài bundle server Next/react-server)
// → stub, cùng mẫu với rating.int.test.ts.
vi.mock("server-only", () => ({}));

// Ranh giới mock: chỉ client Supabase (Test Boundaries của backend DD) — chứng minh cách dựng
// lời gọi JS (hình dạng truy vấn, tham số .eq()/.select()) và ánh xạ/sắp xếp JS của chính ta,
// không phải ngữ nghĩa RLS Postgres thật. Hành vi bỏ-hàng RLS exams_select_visible
// bản thân nó KHÔNG chứng minh được ở đây — xem ca bắt buộc, chặn
// H-a trong SOURCE/supabase/test-rls.ts.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: fromMock })),
}));

const { listMyHistory } = await import("@/features/history/queries");

type BuilderResult = { data: unknown[] | null; error: unknown };
type BuilderCall = { method: string; args: unknown[] };

/** Giả có thể xích chuỗi và await được, phản chiếu bề mặt query-builder Supabase mà listMyHistory dùng. */
function createQueryBuilder(result: BuilderResult) {
  const calls: BuilderCall[] = [];
  const builder: Record<string, unknown> = {};
  const chain =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  // "limit": listMyHistory đọc qua `readBounded` (P3), nó áp biên bằng .limit()
  // trước khi await builder.
  for (const method of ["select", "eq", "in", "order", "limit"]) {
    builder[method] = chain(method);
  }
  builder.then = (onFulfilled: (value: BuilderResult) => unknown) =>
    Promise.resolve(result).then(onFulfilled);
  return { builder, calls };
}

/** Một hàng exam_results đã join, dạng nhúng của PostgREST (cả hai phần nhúng đều là object to-one). */
function joinedRow(o: {
  attemptId: string;
  examId: string;
  title: string;
  subject: string;
  score: number;
  startedAt: string;
  submittedAt: string;
}) {
  return {
    attempt_id: o.attemptId,
    total_score: o.score,
    exam_attempts: {
      exam_id: o.examId,
      started_at: o.startedAt,
      submitted_at: o.submittedAt,
      exams: { title: o.title, subject: o.subject },
    },
  };
}

const ROW_A = joinedRow({
  attemptId: "attempt-A",
  examId: "exam-1",
  title: "Đề Toán học kỳ 1",
  subject: "Toán",
  score: 8.5,
  startedAt: "2026-07-01T10:00:00.000Z",
  submittedAt: "2026-07-01T10:20:00.000Z",
});
const ROW_B = joinedRow({
  attemptId: "attempt-B",
  examId: "exam-2",
  title: "Đề Lý học kỳ 1",
  subject: "Vật lý",
  score: 6,
  startedAt: "2026-07-02T09:00:00.000Z",
  submittedAt: "2026-07-02T09:30:00.000Z",
});
const ROW_C = joinedRow({
  attemptId: "attempt-C",
  examId: "exam-3",
  title: "Đề Hóa học kỳ 1",
  subject: "Hóa học",
  score: 7.25,
  startedAt: "2026-07-03T08:00:00.000Z",
  submittedAt: "2026-07-03T08:45:00.000Z",
});

describe("listMyHistory — scope predicates, ordering, field completeness, exams-visibility omission, single round trip, throw-on-error (Test 1)", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  /** Nối fromMock để join exam_results duy nhất resolve theo các hàng cho trước (hoặc lỗi). */
  function mockJoin(result: BuilderResult) {
    const joinBuilder = createQueryBuilder(result);
    fromMock.mockImplementation((table: string) => {
      if (table === "exam_results") return joinBuilder.builder;
      throw new Error(`unexpected table: ${table}`);
    });
    return joinBuilder;
  }

  /** Chuỗi select / vị từ .eq() được ghi lại trên truy vấn join duy nhất. */
  function recorded(calls: BuilderCall[]) {
    const selectArg = calls.find((c) => c.method === "select")?.args[0] as string;
    const eqArgs = calls.filter((c) => c.method === "eq").map((c) => c.args);
    return { selectArg, eqArgs };
  }

  it("obligation (a): the query reads FROM exam_results and keeps the submitted-only scope predicate (AC-001)", async () => {
    const { calls } = mockJoin({ data: [ROW_A], error: null });

    await listMyHistory();

    // Bắt đầu từ exam_results là thứ biến "đã chấm" thành điều kiện tiên quyết: một
    // lượt làm không có hàng exam_results thì không có gì để join từ đó, nên nó không thể
    // xuất hiện bất kể status (Assumed Behavior #1).
    expect(fromMock).toHaveBeenCalledWith("exam_results");

    const { selectArg, eqArgs } = recorded(calls);
    expect(selectArg).toContain("exam_attempts!inner(");
    expect(eqArgs).toContainEqual(["exam_attempts.status", "submitted"]);
  });

  it("obligation (b): zero scored attempts resolves to [] (AC-002)", async () => {
    mockJoin({ data: [], error: null });

    const entries = await listMyHistory();

    expect(entries).toEqual([]);
  });

  it("obligation (c): rows delivered out of order come back sorted submitted_at descending (AC-003)", async () => {
    // Cố ý cũ-nhất-trước — DB không còn sắp xếp cho ta (.order(col,{referencedTable})
    // của supabase-js là no-op với phần nhúng to-one; đã đo thấy
    // trả theo thứ tự PK), nên cái này khẳng định phép sắp xếp của chính ta thật sự chạy.
    mockJoin({ data: [ROW_A, ROW_C, ROW_B], error: null });

    const entries = await listMyHistory();

    expect(entries.map((e) => e.attemptId)).toEqual(["attempt-C", "attempt-B", "attempt-A"]);
    expect(entries.map((e) => e.submittedAt)).toEqual([
      "2026-07-03T08:45:00.000Z",
      "2026-07-02T09:30:00.000Z",
      "2026-07-01T10:20:00.000Z",
    ]);
  });

  it("obligation (d): every returned row carries attemptId/examId/examTitle/subject/totalScore/startedAt/submittedAt, all populated (AC-004/AC-005)", async () => {
    mockJoin({ data: [ROW_A], error: null });

    const entries = await listMyHistory();

    // Kỳ vọng literal độc lập (không chỉ "bất cứ thứ gì mock trả về").
    expect(entries).toEqual([
      {
        attemptId: "attempt-A",
        examId: "exam-1",
        examTitle: "Đề Toán học kỳ 1",
        subject: "Toán",
        totalScore: 8.5,
        startedAt: "2026-07-01T10:00:00.000Z",
        submittedAt: "2026-07-01T10:20:00.000Z",
        // ADR-0018 (Task B2.2) — hai boolean BAT BUOC, additive. `false` la gia
        // tri dung cho ROW_A: fixture cua Test 1 khong mang `per_question`, nen
        // khong dong nao co khoa vong doi. Chinh khang dinh VET CAN nay la thu
        // bat duoc thay doi — dung viec no phai lam voi mot boundary-change.
        hasUnresolvedEssay: false,
        hasIncompleteEssay: false,
      },
    ]);
  });

  it("obligation (e): the published-only visibility predicate is still attached to the exams embed (Exams-Visibility Edge Case, R-1)", async () => {
    const { calls } = mockJoin({ data: [ROW_A], error: null });

    await listMyHistory();

    // `!inner` là thứ biến một đề không published thành MỘT HÀNG BỊ RƠI thay vì
    // một hàng thiếu tiêu đề; bộ lọc status tường minh là thứ loại một
    // đề tự soạn mà RLS vẫn cho người đọc thấy. Cả hai đều bắt buộc —
    // điều này theo quy ước của getExam() (RLS + bộ lọc tường minh, không chỉ RLS).
    // Bằng chứng Postgres thật: test-rls.ts ca H-a.
    const { selectArg, eqArgs } = recorded(calls);
    expect(selectArg).toContain("exams!inner(");
    expect(eqArgs).toContainEqual(["exam_attempts.exams.status", "published"]);
  });

  it("obligation (f): exactly one round trip is issued (no-N+1 + regression guard on the 3-query collapse, NFR Performance)", async () => {
    mockJoin({ data: [ROW_A, ROW_B, ROW_C], error: null });

    await listMyHistory();

    // Từng là 3 lượt khứ hồi tuần tự (~580ms); phần nhúng làm thành 1 (~193ms).
    // Tách lại sẽ qua mọi khẳng định đầu ra ở trên trong khi lặng lẽ
    // huỷ tối ưu hoá, nên nó được khẳng định tường minh.
    expect(fromMock.mock.calls.map(([table]) => table)).toEqual(["exam_results"]);
  });

  it("obligation (g): a simulated Supabase error rejects the promise rather than resolving to [] (AC-019)", async () => {
    mockJoin({ data: null, error: { code: "500", message: "infra failure" } });

    await expect(listMyHistory()).rejects.toBeTruthy();
  });
});

// =============================================================================
// Test 2 — listMyHistory(): per_question + created_at trong select, và HAI
//          boolean tự luận bắt buộc (ADR-0018, Task B2.2)
// =============================================================================
// AC: EG-BE-034 (`hasUnresolvedEssay(...) === (summariseEssays(...)?.unresolvedCount ?? 0) > 0`),
//   EG-BE-035 (cả hai boolean là boolean THẬT, không bao giờ `undefined` — kể cả
//   lượt làm không có bài tự luận và hàng cũ), D-13/O-8/F-06 (HAI trường, không phải một),
//   AC-012 (So sánh đầu ra đường ống 3).
// @lane: integration
// @dependency: SOURCE/features/history/queries.ts (listMyHistory) + SOURCE/lib/scoring/essayLifecycle.ts
//   THẬT + client Supabase mock
// @real-dependency: không có — cùng ranh giới createClient() được phê duyệt như Test 1.
//
// Gate D là thứ làm hình dạng select này chính đáng thay vì một phán đoán:
// đo được 375 B/hàng khi không có `per_question, created_at` và 3 401 B/hàng khi có
// (≈9,1×, hàng lớn nhất 5 385 B), quyết định của kỹ sư D3 = CHẤP NHẬN, với
// trần 500 hàng được ghi là điều kiện kích hoạt PHÂN TRANG chứ không phải con số
// lớn hơn. Phương án RPC đã được cân nhắc và BỊ LOẠI — chọn nó ở đây
// sẽ là DDL, mở lại một escalation đã đóng.
//
// THỜI GIAN ĐƯỢC ĐÓNG BĂNG vì cùng lý do như trong getResult.int.test.ts: hạn chót là
// 600 000 ms với biên loại trừ, và đồng hồ thật làm các ca này xanh
// hôm nay và đỏ vào một buổi chiều không ai đụng tới.

const HISTORY_NOW = new Date("2026-08-29T12:00:00.000Z");
const HISTORY_CREATED_AT = "2026-08-29T11:59:00.000Z"; // một phút tuổi — trong hạn chót

/** Một phần tử `per_question` đã lưu không có khoá `essay*` — hình dạng cũ. */
const HISTORY_LEGACY_ELEMENT = {
  questionId: "q-mcq",
  selected: "A",
  correct: "A",
  isCorrect: true,
  scored: true,
};

function historyEssayElement(overrides: Record<string, unknown> = {}) {
  return {
    questionId: "q-essay",
    selected: "Bài làm của học sinh.",
    isCorrect: false,
    scored: false,
    essayState: "pending",
    essayEarned: null,
    essayMax: null,
    essayLowConfidence: false,
    essayAttempts: 0,
    ...overrides,
  };
}

/** Một hàng đã join ở dạng nhúng của PostgREST, nay mang hai cột mà
 *  Gate D cho phép. Cố ý tách khỏi `joinedRow` của Test 1: helper đó có trước task này
 *  và fixture của Test 1 không được bắt đầu phụ thuộc vào dữ liệu tự luận để còn qua. */
function joinedEssayRow(o: {
  attemptId: string;
  submittedAt: string;
  perQuestion: unknown[] | null;
  createdAt?: string;
}) {
  return {
    attempt_id: o.attemptId,
    total_score: 7,
    correct: 3,
    total: 4,
    per_question: o.perQuestion,
    created_at: o.createdAt ?? HISTORY_CREATED_AT,
    exam_attempts: {
      exam_id: "exam-9",
      started_at: "2026-08-29T11:00:00.000Z",
      submitted_at: o.submittedAt,
      exams: { title: "Đề Văn giữa kỳ", subject: "Ngữ văn" },
    },
  };
}

describe("listMyHistory — per_question + created_at in the select and the two required essay booleans (Test 2)", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fromMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(HISTORY_NOW);
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.useRealTimers();
  });

  function mockRows(rows: unknown[]) {
    const joinBuilder = createQueryBuilder({ data: rows, error: null });
    fromMock.mockImplementation((table: string) => {
      if (table === "exam_results") return joinBuilder.builder;
      throw new Error(`unexpected table: ${table}`);
    });
    return joinBuilder;
  }

  it("the select carries BOTH per_question and created_at — the shape Gate D priced and accepted", async () => {
    const { calls } = mockRows([
      joinedEssayRow({ attemptId: "a", submittedAt: "2026-08-29T11:50:00.000Z", perQuestion: [] }),
    ]);

    await listMyHistory();

    const selectArg = calls.find((c) => c.method === "select")?.args[0] as string;
    expect(selectArg).toContain("per_question");
    // `created_at` là nửa dễ bị quên nhất, vì các boolean
    // vẫn tính ra mà không có nó — chỉ là tính trên `undefined`, và một câu pending quá hạn
    // khi đó bị phân loại là còn pending ở đây trong khi
    // /result calls it RS-6. That is INT-2's primary failure mode, and it is
    // KHÔNG NHÌN THẤY với bất kỳ khẳng định nào chỉ dựa trên đầu ra đã ánh xạ.
    expect(selectArg).toContain("created_at");
    // Phép chiếu sẵn có không bị đụng — đây là phần cộng thêm.
    expect(selectArg).toContain("attempt_id, total_score, correct, total");
    expect(selectArg).toContain("exam_attempts!inner(");
  });

  it("EG-BE-035: both booleans are REAL booleans in all four shapes — RS-6, essay-free, legacy, and a null per_question", async () => {
    mockRows([
      // RS-6: failed VÀ hết lượt thử ⇒ chưa hoàn tất, và KHÔNG phải chưa giải quyết.
      joinedEssayRow({
        attemptId: "a-rs6",
        submittedAt: "2026-08-29T11:54:00.000Z",
        perQuestion: [historyEssayElement({ essayState: "failed", essayAttempts: 3 })],
      }),
      // Hoàn toàn không có câu tự luận.
      joinedEssayRow({
        attemptId: "a-no-essay",
        submittedAt: "2026-08-29T11:53:00.000Z",
        perQuestion: [HISTORY_LEGACY_ELEMENT],
      }),
      // Cũ: một hàng trông-như-tự-luận từ trước khi tính năng ship — phần
      // tử có mặt, các khoá vòng đời thì không.
      joinedEssayRow({
        attemptId: "a-legacy",
        submittedAt: "2026-08-29T11:52:00.000Z",
        perQuestion: [{ questionId: "q-essay", selected: "bài làm", isCorrect: false, scored: false }],
      }),
      // Một hàng mà cột per_question là null hẳn.
      joinedEssayRow({
        attemptId: "a-null",
        submittedAt: "2026-08-29T11:51:00.000Z",
        perQuestion: null,
      }),
    ]);

    const entries = await listMyHistory();

    // `typeof === "boolean"` trên MỌI mục, không chỉ "các giá trị trông đúng":
    // `undefined` là falsy, nên một lỗi theo hướng này hôm nay vẫn render đúng
    // và lộ ra lần đầu tiên có thứ gì đó so sánh nghiêm ngặt — hoặc, tệ hơn,
    // lần đầu đường ống PDF phải quyết định một chú thích từ nó.
    for (const entry of entries) {
      expect(typeof entry.hasUnresolvedEssay).toBe("boolean");
      expect(typeof entry.hasIncompleteEssay).toBe("boolean");
    }

    const byId = Object.fromEntries(entries.map((e) => [e.attemptId, e]));
    // D-13 / O-8 / F-06: hai trường LOẠI TRỪ NHAU về cấu trúc — `unresolved`
    // đòi còn lượt thử, `incomplete` đòi hết lượt thử. Hàng này là
    // bằng chứng rằng một boolean không thể mang cả hai đáp án.
    expect(byId["a-rs6"].hasIncompleteEssay).toBe(true);
    expect(byId["a-rs6"].hasUnresolvedEssay).toBe(false);
    for (const id of ["a-no-essay", "a-legacy", "a-null"]) {
      expect(byId[id].hasIncompleteEssay).toBe(false);
      expect(byId[id].hasUnresolvedEssay).toBe(false);
    }
  });

  it("EG-BE-034: hasUnresolvedEssay equals (summariseEssays(...)?.unresolvedCount ?? 0) > 0 on the same fixtures", async () => {
    // Hai phép suy ra của một sự thật, đối chiếu nhau. Đây là chốt chặn
    // ngăn chúng trôi lệch — dạng lỗi F-06, mà lịch sử review của chính
    // tính năng này đã bắt một lần.
    const fixtures: Array<{ id: string; perQuestion: unknown[] }> = [
      { id: "f-pending", perQuestion: [historyEssayElement()] },
      {
        id: "f-retryable",
        perQuestion: [historyEssayElement({ essayState: "failed", essayAttempts: 1 })],
      },
      {
        id: "f-exhausted",
        perQuestion: [historyEssayElement({ essayState: "failed", essayAttempts: 3 })],
      },
      {
        id: "f-graded",
        perQuestion: [
          historyEssayElement({ essayState: "graded", essayEarned: 1, essayMax: 1 }),
        ],
      },
      { id: "f-none", perQuestion: [HISTORY_LEGACY_ELEMENT] },
    ];

    mockRows(
      fixtures.map((f, i) =>
        joinedEssayRow({
          attemptId: f.id,
          submittedAt: `2026-08-29T11:${50 - i}:00.000Z`,
          perQuestion: f.perQuestion,
        }),
      ),
    );

    const entries = await listMyHistory();
    const byId = Object.fromEntries(entries.map((e) => [e.attemptId, e]));

    for (const f of fixtures) {
      const expected =
        (summariseEssays(
          f.perQuestion as Parameters<typeof summariseEssays>[0],
          HISTORY_CREATED_AT,
          HISTORY_NOW,
        )?.unresolvedCount ?? 0) > 0;
      expect(byId[f.id].hasUnresolvedEssay).toBe(expected);
    }
    // Một đối chứng dương: ít nhất một fixture phải là `true`, nếu không vòng lặp ở trên
    // sẽ qua với một cài đặt luôn trả `false` vô điều kiện.
    expect(entries.some((e) => e.hasUnresolvedEssay)).toBe(true);
  });

  it("AC-012 pipeline 3: legacy rows produce a hand-built MyHistoryEntry[] literal, in unchanged submittedAt-descending order", async () => {
    // Cố ý đưa vào KHÔNG theo thứ tự để khẳng định thứ tự không được thoả bởi
    // cách sắp xếp sẵn của chính mock.
    mockRows([
      joinedEssayRow({
        attemptId: "older",
        submittedAt: "2026-08-29T10:00:00.000Z",
        perQuestion: [HISTORY_LEGACY_ELEMENT],
      }),
      joinedEssayRow({
        attemptId: "newer",
        submittedAt: "2026-08-29T11:30:00.000Z",
        perQuestion: [HISTORY_LEGACY_ELEMENT],
      }),
    ]);

    const entries = await listMyHistory();

    // Toàn bộ mảng so với một literal soạn tay: cả chín trường sẵn có,
    // cộng hai boolean mới là `false`, mới nhất trước.
    expect(entries).toEqual([
      {
        attemptId: "newer",
        examId: "exam-9",
        examTitle: "Đề Văn giữa kỳ",
        subject: "Ngữ văn",
        totalScore: 7,
        startedAt: "2026-08-29T11:00:00.000Z",
        submittedAt: "2026-08-29T11:30:00.000Z",
        correct: 3,
        total: 4,
        hasUnresolvedEssay: false,
        hasIncompleteEssay: false,
      },
      {
        attemptId: "older",
        examId: "exam-9",
        examTitle: "Đề Văn giữa kỳ",
        subject: "Ngữ văn",
        totalScore: 7,
        startedAt: "2026-08-29T11:00:00.000Z",
        submittedAt: "2026-08-29T10:00:00.000Z",
        correct: 3,
        total: 4,
        hasUnresolvedEssay: false,
        hasIncompleteEssay: false,
      },
    ]);

    // UI-D11: jsonb thô dừng ở hàm này. Một tập khoá vét cạn là khẳng định
    // duy nhất bắt được việc `per_question` bị chuyển qua bởi một
    // spread mà ai đó thêm về sau cho tiện.
    expect(Object.keys(entries[0]).sort()).toEqual([
      "attemptId",
      "correct",
      "examId",
      "examTitle",
      "hasIncompleteEssay",
      "hasUnresolvedEssay",
      "startedAt",
      "subject",
      "submittedAt",
      "total",
      "totalScore",
    ]);
  });

  it("the row ceiling is unchanged at 500, and an unrecognised essayState warns ONCE per element, not once per predicate", async () => {
    const { calls } = mockRows([
      joinedEssayRow({
        attemptId: "a-broken",
        submittedAt: "2026-08-29T11:40:00.000Z",
        perQuestion: [historyEssayElement({ essayState: "in_review" })],
      }),
    ]);

    const entries = await listMyHistory();

    // Ranh giới phạm vi: task này không được dịch chuyển trần. `readBounded` hỏi
    // trần + 1 để PHÁT HIỆN tràn thay vì lặng lẽ cắt bớt.
    expect(LIST_ROW_CEILING).toBe(500);
    const limitArg = calls.find((c) => c.method === "limit")?.args[0];
    expect(limitArg).toBe(LIST_ROW_CEILING + 1);

    // Cả hai vị từ tự gập mảng, nên nơi gọi ngây thơ sẽ
    // suy ra phần tử này hai lần và cảnh báo hai lần — mỗi hàng, ở mỗi lần render
    // /history. Cùng lỗi mà đường đọc anh em từng có, cùng cách sửa.
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warnSpy.mock.calls[0])).not.toContain("Bài làm của học sinh");
    expect(entries[0].hasUnresolvedEssay).toBe(false);
    expect(entries[0].hasIncompleteEssay).toBe(false);
  });
});
