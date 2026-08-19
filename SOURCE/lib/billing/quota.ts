// Hạn mức theo gói, và MỘT chỗ duy nhất suy ra mốc bắt đầu kỳ (backend DD I004).
//
// `PLAN_LIMITS` ở đây chứ KHÔNG ở `types.ts`: file đó là hợp đồng đóng băng của
// pha UI (`types.ts:4-8`), đổi nó phải đổi UI Spec trước. Bảng hạn mức là một
// tham số sản phẩm, không phải một hình dạng dữ liệu, nên nó không thuộc về đó.
//
// `periodStartEpoch()` là phần đắt hơn của file này. Bộ đếm kỳ sống trên Redis
// dưới khoá `quota:{kind}:{userId}:{periodStartEpoch}` — mốc kỳ nằm TRONG khoá,
// nên "reset" là một khoá mới chứ không phải một phép ghi đè, và không có job
// nào chạy ở biên kỳ (đúng cam kết "no scheduled infrastructure" của ADR-0013).
// Cái giá của thiết kế đó là: đường ĐỌC (`readEntitlement()` dựng `used` và
// `resetsAt`) và đường GHI (`consumeQuota()` INCR ở cổng) phải ghép RA CÙNG MỘT
// chuỗi. Hai lần suy ra độc lập — lệch một phép làm tròn, hay một bên tính bằng
// giây một bên bằng mili giây — làm màn hình báo "còn n lượt" trong khi cổng từ
// chối, và không có gì đỏ ở đâu cả. Vì thế đây là lời khai DUY NHẤT; cả hai
// phía `import` nó, không phía nào tự tính lại.

import type { Plan } from "./types";

/** Hai loại thao tác có hạn mức. Khai ở đây vì `PLAN_LIMITS` và `quotaKey()`
 *  đều nói về cùng một tập — hai lời khai rời sẽ cho phép thêm một loại vào
 *  bảng hạn mức mà quên nó ở khoá đếm. */
export type QuotaKind = "tutor" | "upload";

/** Hạn mức mỗi kỳ 30 ngày, theo gói và theo loại thao tác (PRD R5/D5, R6/D7).
 *
 *  Đơn vị là **thao tác người dùng khởi xướng**, không phải request Gemini:
 *  một lượt upload ở chế độ `automatic` phát 3 request nhưng tiêu ĐÚNG MỘT suất
 *  upload — gói được bán bằng "lượt", còn ngân sách dự án mới đếm bằng request.
 *
 *  `satisfies Record<Plan, …>` để thêm một gói thứ ba mà quên điền hạn mức là
 *  lỗi biên dịch, không phải một `undefined` phát hiện được lúc chạy. */
export const PLAN_LIMITS = {
  free: { tutor: 5, upload: 3 },
  premium: { tutor: 500, upload: 15 },
} as const satisfies Record<Plan, Record<QuotaKind, number>>;

/** Độ dài một kỳ (PRD A4/A6, `record_payment_settlement(p_period_days => 30)`).
 *
 *  Export vì `readEntitlement()` dựng `resetsAt = periodStart + 30 ngày`. Nó
 *  `import` hằng này chứ KHÔNG khai lại 30 ngày — hai lời khai của cùng một
 *  khoảng thời gian là đúng hình dạng hỏng mà `periodStartEpoch()` bên dưới
 *  tồn tại để chặn. */
export const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Khoá bộ đếm kỳ trên Redis. **Đây là chỗ DUY NHẤT trong repo ghép chuỗi này.**
 *
 * Đường ĐỌC (`readEntitlement()` dựng `used`) và đường GHI (`consumeQuota()`
 * INCR ở cổng) phải cho ra chuỗi GIỐNG HỆT TỪNG BYTE cho cùng một người tại
 * cùng một thời điểm. Nếu mỗi bên tự ghép — thừa một dấu hai chấm, đổi thứ tự
 * hai đoạn giữa, hay một bên dùng giây còn bên kia mili giây — thì màn hình báo
 * "còn n lượt" trong khi cổng từ chối, và KHÔNG CÓ GÌ ĐỎ. Vì thế cả hai phía
 * gọi hàm này; không phía nào viết lại mẫu khoá.
 *
 * @param periodStartEpochMs giá trị `periodStartEpoch()` trả về, nguyên vẹn —
 *   không làm tròn lại, không quy đổi đơn vị.
 */
export function quotaKey(
  kind: QuotaKind,
  userId: string,
  periodStartEpochMs: number
): string {
  return `quota:${kind}:${userId}:${periodStartEpochMs}`;
}

/**
 * Mốc bắt đầu kỳ hiện tại của một người dùng, tính bằng **mili giây** kể từ
 * epoch — đúng đoạn `{periodStartEpoch}` của khoá `quota:{kind}:{userId}:{…}`.
 *
 * - `premium` ⇒ `subscriptions.period_anchor_at`. Kỳ đã trả tiền được neo tại
 *   thời điểm thanh toán, không trôi theo lịch tạo tài khoản.
 * - `free` ⇒ `created_at + 30d × floor((now − created_at) / 30d)`.
 *
 * **Ân hạn cấp QUYỀN, không bao giờ cấp HẠN MỨC (PRD D8/R4, AC-011).** Trong ân
 * hạn `plan` vẫn đọc là `premium` và `anchor` không đổi, nên hàm này trả đúng
 * giá trị cũ: bộ đếm tiếp tục tính vào kỳ TRƯỚC. Một người bước vào ân hạn với
 * 0 lượt còn lại bị từ chối vì **hết hạn mức**, không phải vì **hết hạn gói** —
 * hai thông báo khác nhau, và AC-011 kiểm đúng chỗ đó.
 *
 * Đơn vị là mili giây vì cả hai chỗ gọi đều đã cầm `Date`/`Date.now()` ở đơn vị
 * đó; chọn giây sẽ thêm một phép quy đổi ở mỗi đầu, và một phép quy đổi có mặt
 * ở đầu này mà thiếu ở đầu kia chính là lỗi im lặng nói ở đầu file.
 *
 * @param anchor `subscriptions.period_anchor_at`, hoặc `null` khi không có
 *   thuê bao. Cột đó là `not null` (schema.sql), nên `premium` + `null` chỉ tới
 *   được bằng dữ liệu hỏng và được ném ra thay vì âm thầm rơi về công thức
 *   Free — rơi lặng lẽ sẽ đẻ ra khoá thứ hai cho cùng một người.
 */
export function periodStartEpoch(
  plan: Plan,
  anchor: Date | null,
  createdAt: Date,
  now: Date
): number {
  if (plan === "premium") {
    if (anchor === null) {
      throw new Error(
        "periodStartEpoch: gói premium nhưng thiếu period_anchor_at — dữ liệu subscriptions hỏng"
      );
    }
    return anchor.getTime();
  }

  const createdAtMs = createdAt.getTime();
  const elapsedPeriods = Math.floor((now.getTime() - createdAtMs) / PERIOD_MS);
  return createdAtMs + elapsedPeriods * PERIOD_MS;
}
