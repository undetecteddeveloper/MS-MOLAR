// Bộ dựng payload ghi telemetry [unit] (AC-013)
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0, AC-013, Success Criteria #13
//   "Telemetry không bao giờ mang vật liệu khoá đáp án")
// Sinh ngày: 2026-08-08 | Chuyển từ skeleton: 2026-08-14 (backend task 12,
//   Red -> Green trong một commit, quy ước của repo này)
//
// KHÔNG thuộc ngân sách làn integration/fixture-e2e/service-integration-e2e —
// là độ phủ unit do Design Doc bắt buộc (Implementation Path Mapping của backend DD:
// "SOURCE/lib/tutor/__tests__/telemetry.test.ts", AC-013). Được chọn là một trong
// các khoảng trống rủi ro cao nhất được nêu rõ của task này ("khoanh vùng telemetry").
//
// Ghi chú cho người cài đặt: Implementation Path Mapping của backend DD không nêu tên
// một hàm "payload builder" được export riêng biệt khác với phần dựng lời gọi insert
// nội tuyến của explainStep() / getSkillRecommendation() — theo tiền lệ của
// chính tài liệu này ("khớp tiền lệ của AC-018 là 'unit test trên bộ dựng,
// không chỉ kiểm integration'"), tách phần dựng payload insert telemetry
// thành một hàm nhỏ, thuần, unit test được riêng (ví dụ
// `buildTelemetryPayload(...)` trong SOURCE/lib/tutor/telemetry.ts hoặc đặt cùng chỗ
// với callTutor.ts) để file này unit test nó tách biệt khỏi
// chính lời gọi Supabase — theo hình dạng hàm thuần của buildTutorPrompt().
//
// Ranh giới mock (Test Boundaries / Mock Boundary Decisions của backend DD, áp dụng
//   ở đây riêng cho bước dựng payload): Không I/O — hàm dựng payload
//   thuần; lời gọi insert DB thật là một MỐI QUAN TÂM RIÊNG được
//   tutorActions.int.test.ts / getSkillRecommendation.int.test.ts
//   (ranh giới Supabase mock) phủ ở mức integration.

import { describe, expect, it } from "vitest";

import { buildTelemetryPayload, TELEMETRY_ERROR_CODES } from "../telemetry";
import type { TelemetryErrorCode, TelemetryEvent, TelemetryLogInsert } from "../telemetry";

/** Đúng 6 cột app tự điền của `public.telemetry_log`; `id`/`created_at` do DB sinh (default), nên
 *  payload KHÔNG được có chúng — và cũng không được có bất kỳ khoá nào khác:
 *  một khoá lạ chính là dấu vết của việc trải cả object lỗi vào payload. */
const EXPECTED_COLUMNS = [
  "user_id",
  "event_type",
  "question_id",
  "skill_node_id",
  "success",
  "error_code",
] as const;

/** Chép tay, CỐ Ý không import từ schema hay implementation: đây là bản sao độc
 *  lập của CHECK constraint `telemetry_log_error_code_check`, để test còn chứng
 *  minh được điều gì khi ai đó nới enum ở phía implementation. */
const SCHEMA_ERROR_CODES = ["gemini_unavailable", "rate_limited", "server", "not_eligible", "user_quota_exhausted", "project_budget_exhausted", "groq_unavailable", "invalid_output", "duplicate_write"];

const USER_ID = "11111111-1111-4111-8111-111111111111";
const QUESTION_ID = "q-derivative-001";
const SKILL_NODE_ID = "skill-derivative-basic";

/**
 * Một ca trong "dàn" (battery): `event` là đầu vào (có ca CỐ TÌNH phá kiểu để mô
 * phỏng sai lầm của người bảo trì tương lai), `answerKeySentinels` là các giá
 * trị đại diện cho correct_answer/sub_answers/essay_answer của câu hỏi liên
 * quan — thứ TUYỆT ĐỐI không được xuất hiện ở bất kỳ trường nào của payload.
 */
interface TelemetryFixture {
  label: string;
  event: TelemetryEvent;
  answerKeySentinels: string[];
}

/** Lỗi mô phỏng đúng theo "primary failure mode": message của exception mang
 *  theo nội dung câu hỏi/đáp án (UGC do người dùng nhập, có thể bị tác động bởi
 *  kẻ tấn công) — đây chính là con đường rò mà CHECK constraint `telemetry_log_error_code_check` và test
 *  này cùng tồn tại để chặn. */
const LEAK_SENTINEL = "SENTINEL-CORRECT-ANSWER-leak";
const LEAK_SUB_ANSWERS_SENTINEL = "SENTINEL-SUB-ANSWERS-leak";
const LEAK_ESSAY_SENTINEL = "SENTINEL-ESSAY-ANSWER-leak";
const LEAK_SENTINELS = [LEAK_SENTINEL, LEAK_SUB_ANSWERS_SENTINEL, LEAK_ESSAY_SENTINEL];

const caughtError = new Error(
  `Gemini 503 khi chấm câu "q-derivative-001" (correct_answer=${LEAK_SENTINEL}, essay_answer=${LEAK_ESSAY_SENTINEL})`,
);

const FIXTURES: TelemetryFixture[] = [
  {
    label: "tutor_invoke/success",
    event: { eventType: "tutor_invoke", userId: USER_ID, questionId: QUESTION_ID, success: true },
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    label: "tutor_invoke/failure",
    event: {
      eventType: "tutor_invoke",
      userId: USER_ID,
      questionId: QUESTION_ID,
      success: false,
      errorCode: "gemini_unavailable",
    },
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    label: "adaptive_route/success",
    event: { eventType: "adaptive_route", userId: USER_ID, skillNodeId: SKILL_NODE_ID, success: true },
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    label: "adaptive_route/failure",
    event: { eventType: "adaptive_route", userId: USER_ID, skillNodeId: null, success: false, errorCode: "server" },
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    // Ca 1 của "primary failure mode": người bảo trì ép err.message vào errorCode
    // (ở TS thật phải cố ý `as` mới lọt — chính là diff mà reviewer nhìn thấy).
    label: "error-message-cast-as-code",
    event: {
      eventType: "tutor_invoke",
      userId: USER_ID,
      questionId: QUESTION_ID,
      success: false,
      errorCode: caughtError.message as TelemetryErrorCode,
    },
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    // Ca 2 (đối nghịch, cùng lối của prompt.test.ts's fullQuestionRow): truyền
    // NGUYÊN cụm ngữ cảnh lỗi thay vì event đã thu hẹp — nếu builder trải
    // `...event` hoặc JSON.stringify cả input, sentinel sẽ rò ra payload.
    label: "broad-error-context",
    event: {
      eventType: "tutor_invoke",
      userId: USER_ID,
      questionId: QUESTION_ID,
      success: false,
      errorCode: caughtError.message,
      error: caughtError,
      message: caughtError.message,
      detail: {
        name: caughtError.name,
        message: caughtError.message,
        correctAnswer: LEAK_SENTINEL,
        subAnswers: { a: LEAK_SUB_ANSWERS_SENTINEL, b: LEAK_SUB_ANSWERS_SENTINEL },
        essayAnswer: LEAK_ESSAY_SENTINEL,
      },
    } as unknown as TelemetryEvent,
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    // R13 (AC-045): mã mới thứ nhất. Đây là ca chứng minh bộ lọc runtime cho
    // mã này ĐI QUA — không có nó, một bộ lọc còn dừng ở bốn mã cũ vẫn xanh
    // hết dàn trên, chỉ khác là error_code thành null lúc ghi thật.
    label: "tutor_invoke/failure/user-quota",
    event: {
      eventType: "tutor_invoke",
      userId: USER_ID,
      questionId: QUESTION_ID,
      success: false,
      errorCode: "user_quota_exhausted",
    },
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    // Mã mới thứ hai, GIÁ TRỊ KHÁC ca trên và event_type khác: hai ca cùng kiểu
    // mà cùng một giá trị thì không phân biệt được ánh xạ với hằng số.
    label: "adaptive_route/failure/project-budget",
    event: {
      eventType: "adaptive_route",
      userId: USER_ID,
      skillNodeId: null,
      success: false,
      errorCode: "project_budget_exhausted",
    },
    answerKeySentinels: LEAK_SENTINELS,
  },
  {
    // Ca SÁT NGHĨA: chuỗi chỉ khác mã thật ở phần đuôi. Bộ lọc phải là bộ lọc
    // đối sánh ĐẦY ĐỦ, không phải so tiền tố — CHECK của Postgres so đầy đủ.
    label: "near-miss-code",
    event: {
      eventType: "tutor_invoke",
      userId: USER_ID,
      questionId: QUESTION_ID,
      success: false,
      errorCode: "user_quota_exhausted_v2" as TelemetryErrorCode,
    },
    answerKeySentinels: LEAK_SENTINELS,
  },
];

/** Trả về mô tả từng sentinel BỊ RÒ, kèm ĐÚNG tên cột rò — dùng mảng thay vì
 *  assert trong vòng lặp để thông báo lỗi chỉ ra ngay ca nào/cột nào/rò cái gì. */
function findLeaks(payload: TelemetryLogInsert, sentinels: string[], where: string): string[] {
  return Object.entries(payload).flatMap(([column, value]) => {
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    return sentinels
      .filter((sentinel) => serialized?.includes(sentinel) === true)
      .map((sentinel) => `${where}/${column}: ${sentinel}`);
  });
}

// =============================================================================
// Test 1 — AC-013: 0 lần xuất hiện vật liệu khoá đáp án trong payload insert
// telemetry_log đã dựng, qua một bộ fixture gồm cả các đường lỗi giả lập
// =============================================================================
// AC-013: "Cho bất kỳ hàng telemetry_log nào, nó không được chứa vật liệu khoá đáp án
//   — khẳng định bởi một unit test trên bộ dựng payload ghi telemetry, không chỉ bởi
//   việc loại trừ hình dạng cột của schema."
// ROI: 69 (BV:10 x Freq:6 + Legal:0 + Defect:9)
// Hành vi: bộ dựng payload telemetry được gọi qua một bộ fixture đầu vào —
//   kết quả thành công/thất bại, cả hai giá trị event_type
//   ('tutor_invoke'/'adaptive_route'), và một Error bị bắt giả lập mà
//   trường .message chứa một chuỗi canh có hình dạng khoá đáp án (theo
//   kỹ thuật canh của prompt.test.ts) — khẳng định object payload insert đã dựng
//   có 0 lần xuất hiện chuỗi canh ở BẤT KỲ trường nào, với mọi fixture trong
//   bộ.
// @category: core-functionality
// @lane: unit
// @dependency: không có (hàm dựng payload thuần; không I/O)
// @complexity: medium
// @real-dependency: N/A
// Kiểu hỏng chính: người bảo trì về sau chuyển `err.message` của một exception bị bắt
//   (có thể vọng lại nội dung câu hỏi UGC do kẻ tấn công ảnh hưởng, theo
//   Security Considerations) vào `error_code` hoặc bất kỳ cột telemetry nào khác
//   thay vì enum đóng có ràng buộc — mở lại đúng đường rò mà
//   ràng buộc CHECK của chính schema (`error_code in (...)`) và unit test này
//   đều sinh ra để ngăn, theo ý định thiết kế đã nêu của schema ("Mã có cấu
//   trúc, KHÔNG BAO GIỜ free-text/exception message").
// Nghĩa vụ chứng minh: với mỗi fixture (thành công/thất bại x tutor_invoke/adaptive_route),
//   khẳng định mọi trường của payload đã dựng hoặc là giá trị an toàn về cấu trúc
//   (uuid, boolean, timestamp, hay thành viên enum đóng) hoặc, với trường
//   dạng chuỗi duy nhất có thể chứa chữ tự do (error_code), khẳng định nó
//   CHẶT CHẼ là một trong các literal được nêu tên của ràng buộc CHECK (R13 mở rộng nó
//   thành sáu) và không bao giờ là .message thô của Error giả lập —
//   qua một bộ fixture gồm một Error giả lập mà .message
//   chứa chuỗi canh, chứng minh chuỗi đó không bao giờ tới payload
//   ở bất kỳ đường mã nào được kích hoạt.
describe("buildTelemetryPayload — telemetry không bao giờ mang theo đáp án (AC-013)", () => {
  it("trên cả dàn success/failure x tutor_invoke/adaptive_route: 0 lần xuất hiện sentinel, error_code luôn nằm trong enum §19", () => {
    const built = FIXTURES.map((fixture) => ({ fixture, payload: buildTelemetryPayload(fixture.event) }));

    // (1) Không một cột nào mang theo sentinel đáp án — kể cả ca err.message.
    const leaks = built.flatMap(({ fixture, payload }) =>
      findLeaks(payload, fixture.answerKeySentinels, fixture.label),
    );
    expect(leaks).toEqual([]);

    // (2) Payload chỉ có đúng 6 cột app tự điền: một khoá lạ = dấu vết trải
    // object lỗi vào payload, tức là một đường rò mới chưa ai kiểm.
    const unexpectedColumns = built.flatMap(({ fixture, payload }) =>
      Object.keys(payload)
        .filter((column) => !EXPECTED_COLUMNS.includes(column as (typeof EXPECTED_COLUMNS)[number]))
        .map((column) => `${fixture.label}: ${column}`),
    );
    expect(unexpectedColumns).toEqual([]);

    // (3) error_code: NGHIÊM NGẶT null hoặc 1 trong các literal của CHECK
    // `telemetry_log_error_code_check` — đối chiếu với bản chép tay SCHEMA_ERROR_CODES,
    // không phải với hằng của implementation, nên nới enum ở implementation vẫn bị bắt tại đây.
    const badErrorCodes = built
      .filter(({ payload }) => payload.error_code !== null && !SCHEMA_ERROR_CODES.includes(payload.error_code))
      .map(({ fixture, payload }) => `${fixture.label}: ${String(payload.error_code)}`);
    expect(badErrorCodes).toEqual([]);

    // (4) Các cột còn lại đúng kiểu cấu trúc an toàn (không có chỗ chứa văn bản
    // tự do): event_type là enum đóng, success là boolean, các id là string|null.
    const badShapes = built
      .filter(
        ({ payload }) =>
          !["tutor_invoke", "adaptive_route", "essay_grade"].includes(payload.event_type) ||
          typeof payload.success !== "boolean" ||
          !(payload.user_id === null || typeof payload.user_id === "string") ||
          !(payload.question_id === null || typeof payload.question_id === "string") ||
          !(payload.skill_node_id === null || typeof payload.skill_node_id === "string"),
      )
      .map(({ fixture }) => fixture.label);
    expect(badShapes).toEqual([]);

    // (5) Chống "đạt rỗng": builder phải thật sự dựng đủ dòng log dùng được cho
    // AC-012 ("bao nhiêu lượt gọi, của ai, bao nhiêu lượt hỏng"), chứ không phải
    // trả về {} hay null hết mọi cột.
    expect(built[0].payload).toEqual({
      user_id: USER_ID,
      event_type: "tutor_invoke",
      question_id: QUESTION_ID,
      skill_node_id: null,
      success: true,
      error_code: null,
    });
    expect(built[3].payload).toEqual({
      user_id: USER_ID,
      event_type: "adaptive_route",
      question_id: null,
      skill_node_id: null,
      success: false,
      error_code: "server",
    });
    // Mã hợp lệ ĐI QUA được (nếu builder null hoá tất cả thì (1)-(3) vẫn xanh mà
    // telemetry thành vô dụng — assert này chặn đúng cách "đạt" rẻ tiền đó).
    expect(built[1].payload.error_code).toBe("gemini_unavailable");
    // Còn mã bịa từ err.message thì thành null, không phải chuỗi rác.
    expect(built[4].payload.error_code).toBeNull();

    // Hai mã R13 cũng phải ĐI QUA, và đi qua thành ĐÚNG mã của nhánh sinh ra
    // nó. Hai ca dùng HAI giá trị khác nhau: một builder trả hằng số, hay một
    // bộ lọc ánh xạ nhầm hai nhánh vào nhau, chỉ bị bắt khi có cả hai.
    expect(built[6].payload.error_code).toBe("user_quota_exhausted");
    expect(built[7].payload.error_code).toBe("project_budget_exhausted");
    // Mà bộ lọc vẫn phải là BỘ LỌC chứ không thành ống dẫn: một mã sát nghĩa
    // nhưng không nằm trong CHECK vẫn thành null. Đổi `includes` thành so tiền
    // tố thì đúng ca này đỏ, còn cả dàn trên vẫn xanh.
    expect(built[8].payload.error_code).toBeNull();

    // (6) Hằng của implementation phải khớp CHECK constraint
    // `telemetry_log_error_code_check` từng phần tử — khoá luôn nguồn duy nhất mà cả kiểu lẫn bộ lọc lúc chạy cùng dùng.
    expect([...TELEMETRY_ERROR_CODES]).toEqual(SCHEMA_ERROR_CODES);
  });
});
