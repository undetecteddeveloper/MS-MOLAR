// buildTelemetryPayload — hàm THUẦN (pure): không I/O, không đọc ambient state,
// không import gì (cùng nhà với prompt.ts, computeScore.ts, wrongTwice.ts).
// Dựng đúng object insert cho `public.telemetry_log` (schema.sql, khối "TELEMETRY LOG").
//
// DÙNG CHUNG, KHÔNG SAO CHÉP: cả `explainStep()` (event_type 'tutor_invoke') lẫn
// `getSkillRecommendation()` (event_type 'adaptive_route') phải đi qua hàm này
// thay vì tự ghép object insert tại chỗ — có hai lối ghi vào cùng một bảng thì
// rào chắn dưới đây chỉ còn bảo vệ được một nửa.
//
// RÀO CHẮN (PRD Success Criteria #13, AC-013): answer-key material KHÔNG BAO GIỜ
// được lọt vào telemetry_log. Con đường rò thật sự KHÔNG phải là một cột tên
// "correct_answer" (schema cố ý không có cột nào chứa nổi nó), mà là `err.message`
// của một exception — message ấy có thể vọng lại nội dung câu hỏi UGC do người
// dùng nhập. Cơ chế chặn có HAI LỚP, cả hai đều nằm ở file này, cùng lối với
// prompt.ts:
//   1. Kiểu `TelemetryEvent` KHÔNG CÓ trường nào chứa nổi văn bản tự do —
//      `errorCode` là union ĐÓNG sinh từ `TELEMETRY_ERROR_CODES`.
//   2. Thân hàm chỉ gán ĐÍCH DANH 6 cột — không trải `...event`, không
//      JSON.stringify(event), không lặp Object.entries(event) — và lọc
//      `errorCode` LÚC CHẠY qua chính bộ hằng ấy, nên một giá trị bị `as` ép qua
//      hàng rào kiểu sẽ thành `null`, không bao giờ thành chuỗi được lưu.
// `__tests__/telemetry.test.ts` khoá cả hai lớp lại (0 lần xuất hiện sentinel
// trên dàn fixture success/failure x hai event_type, kể cả ca err.message).
//
// Vì sao null chứ không throw khi mã lạ: dòng log vẫn giữ được `success: false`
// — đúng thứ mà truy vấn AC-012 ("bao nhiêu lượt gọi, của ai, bao nhiêu lượt
// hỏng") đọc; còn chi tiết lỗi thật thì đã được `logTutorExit()` ghi ra console
// server tại call site (đúng lối gemini.ts đang dùng: log giàu metadata phía
// server, không bao giờ lưu payload). Ném ở đây sẽ biến một lệnh ghi quan sát
// "best-effort" thành điểm hỏng thứ hai của luồng học sinh đang chờ, điều backend
// DD cấm tường minh.

/** Đúng bằng CHECK constraint `telemetry_log_error_code_check` — CHÍN mã sau
 *  Essay Auto-Scoring R13, ĐÚNG THỨ TỰ schema.sql; nguồn DUY NHẤT cho cả kiểu
 *  lẫn bộ lọc lúc chạy.
 *
 *  Ba mã cuối đi kèm CHECK mới và chỉ ghi được sau khi DDL của Task H7 được áp
 *  lên database; tới lúc đó chưa nhánh nào sinh ra chúng. */
export const TELEMETRY_ERROR_CODES = ["gemini_unavailable", "rate_limited", "server", "not_eligible", "user_quota_exhausted", "project_budget_exhausted", "groq_unavailable", "invalid_output", "duplicate_write"] as const;

export type TelemetryErrorCode = (typeof TELEMETRY_ERROR_CODES)[number];

/** `public.telemetry_log`: `event_type text not null check (event_type in (...))`. */
export type TelemetryEventType = "adaptive_route" | "tutor_invoke" | "essay_grade";

/**
 * Ngữ cảnh (đã thu hẹp) của MỘT lượt gọi cần ghi nhận — đúng bộ dữ liệu vận hành
 * AC-012 cần, không hơn.
 */
export interface TelemetryEvent {
  eventType: TelemetryEventType;
  /** `null` khi không xác định được người dùng; `telemetry_log.user_id` cho phép
   *  NULL (`on delete set null` — mất danh tính chấp nhận được, mất dòng thì không). */
  userId: string | null;
  /** Chỉ có ở 'tutor_invoke'. */
  questionId?: string | null;
  /** Chỉ có ở 'adaptive_route'; null khi không gợi ý được kỹ năng nào. */
  skillNodeId?: string | null;
  success: boolean;
  /** Vắng mặt/null ở ca thành công. KHÔNG BAO GIỜ nhận `err.message`. */
  errorCode?: TelemetryErrorCode | null;
}

/**
 * Object truyền thẳng cho `.from("telemetry_log").insert(...)`.
 * `id` và `created_at` CỐ Ý vắng mặt: `telemetry_log` đã có default (`gen_random_uuid()`,
 * `now()`) — để DB sinh thì thời điểm log là đồng hồ máy chủ DB, không phải đồng
 * hồ tiến trình gọi.
 */
export interface TelemetryLogInsert {
  user_id: string | null;
  event_type: TelemetryEventType;
  question_id: string | null;
  skill_node_id: string | null;
  success: boolean;
  error_code: TelemetryErrorCode | null;
}

/** Lớp chắn thứ 2: chỉ cho qua ĐÚNG các literal của CHECK
 *  `telemetry_log_error_code_check`; mọi thứ khác (kể cả một `err.message` bị `as` ép vào) thành null. */
function toErrorCode(value: unknown): TelemetryErrorCode | null {
  return TELEMETRY_ERROR_CODES.includes(value as TelemetryErrorCode) ? (value as TelemetryErrorCode) : null;
}

/**
 * Dựng payload insert cho một sự kiện telemetry.
 *
 * - Thuần & tất định: cùng input luôn cho ra cùng object; không bao giờ throw.
 * - Bảo đảm (AC-013): object trả về chỉ chứa 6 cột được gán đích danh dưới đây,
 *   nên không thể mang theo giá trị đáp án nào, dù caller có truyền vào cả cụm
 *   ngữ cảnh lỗi.
 * - `error_code` luôn là `null` hoặc 1 trong các literal của CHECK
 *   `telemetry_log_error_code_check` — không bao giờ là văn bản tự do, nên lệnh
 *   insert cũng không thể bị CHECK từ chối vì cột này.
 */
export function buildTelemetryPayload(event: TelemetryEvent): TelemetryLogInsert {
  return {
    user_id: event.userId,
    event_type: event.eventType,
    question_id: event.questionId ?? null,
    skill_node_id: event.skillNodeId ?? null,
    success: event.success,
    error_code: toErrorCode(event.errorCode),
  };
}
