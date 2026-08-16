// Hợp đồng quyền lợi (entitlement) — UI Spec `docs/ui-spec/subscription-ui-spec.md`
// mục "Component: EntitlementProvider / useEntitlement — C-01".
//
// ĐÂY LÀ HỢP ĐỒNG ĐÓNG BĂNG, và nó chạy NGƯỢC chiều thường lệ: pha UI được làm
// TRƯỚC backend (payOS chưa kích hoạt eKYC, Gemini chưa bật paid tier), nên
// hình dạng ở file này là thứ backend phải TUÂN THEO, không phải bản phác chờ
// backend sửa. Muốn đổi thì đổi UI Spec trước, kèm lý do — đừng đổi lặng lẽ ở
// đây rồi để các màn tự thích nghi.

/** Đúng hai gói (PRD D2). Không có gói thứ ba ở v1. */
export type Plan = "free" | "premium";

/** Hạn mức có BA giá trị, không phải hai — và đó là điểm quan trọng nhất của
 *  file này (UI Spec UI-D2).
 *
 *  Chưa tồn tại bảng đếm nào trong `schema.sql`, nên trong pha UI mọi hạn mức
 *  đều là `unknown`. Nếu `unknown` bị quy về 0 "cho an toàn" thì stub sẽ TẮT
 *  tính năng gia sư Engine 1 đang chạy cho TOÀN BỘ người dùng — một sự cố do
 *  tính năng xây dở gây ra, đúng thứ rào chắn D1/R-i/chỉ số #10 của PRD tồn tại
 *  để chặn.
 *
 *  Vì thế hai nửa của Entitlement hỏng về hai HƯỚNG NGƯỢC NHAU, cố ý:
 *    · `plan`  fail-CLOSED — không biết thì là Free (hại của việc cấp nhầm
 *      Premium là cho không một thứ có người phải trả tiền).
 *    · `quota` fail-OPEN  — không biết thì KHÔNG chặn (hại của việc báo nhầm
 *      hết lượt là làm hỏng một tính năng người dùng đang có quyền dùng).
 *
 *  Union có discriminant để chỗ đọc không thể lỡ tay dùng `used`/`limit` khi
 *  chưa biết: bỏ qua nhánh `unknown` là lỗi biên dịch, không phải lỗi lúc chạy. */
export type Quota =
  | { state: "unknown" }
  | {
      state: "known";
      used: number;
      limit: number;
      /** ISO 8601. Mốc kết thúc kỳ 30 ngày hiện tại (PRD A4 cho Premium,
       *  A6 cho Free = `user_profiles.created_at + 30 ngày × k`). */
      resetsAt: string;
    };

export type Entitlement = {
  plan: Plan;
  /** ISO 8601, hoặc null khi `plan === "free"`.
   *
   *  KHÔNG BAO GIỜ có trường boolean nào ở đây (`isPremium`, `isActive`…):
   *  PRD R2/AC-004 và chỉ số #4 cấm hẳn. Một boolean đúng vào lúc được ghi và
   *  sai một tháng sau mà không có gì báo; một mốc thời gian thì so với `now()`
   *  luôn cho câu trả lời đúng ở mọi thời điểm đọc. Nhà cung cấp A2A/VietQR
   *  không có auto-renew nên KHÔNG BAO GIỜ có sự kiện "hết hạn" được đẩy tới —
   *  suy ra lúc đọc là cách duy nhất đúng (ADR-0013 Decision 2). */
  expiresAt: string | null;
  /** Chỉ true trong 3 ngày sau `expiresAt` (PRD D8/R4). Trong ân hạn người dùng
   *  giữ quyền Premium nhưng KHÔNG được cấp hạn mức mới — nên đây là một trường
   *  riêng chứ không suy ra được từ `plan`. */
  inGracePeriod: boolean;
  tutor: Quota;
  upload: Quota;
};

/** Giá trị fail-closed dùng ở hai chỗ, và việc chúng là MỘT là cố ý:
 *  (1) stub của pha UI — chưa có backend thì mọi người là Free;
 *  (2) fallback khi `useEntitlement()` được gọi ngoài provider — chuyện xảy ra
 *      thật trong unit test, theo đúng tiền lệ `useT()` (lib/i18n/client.tsx).
 *  Nhờ trùng nhau mà "tiện cho test" và "không bao giờ cấp nhầm Premium" là
 *  cùng một dòng code, thay vì hai đường có thể lệch nhau. */
export const FREE_FALLBACK: Entitlement = {
  plan: "free",
  expiresAt: null,
  inGracePeriod: false,
  tutor: { state: "unknown" },
  upload: { state: "unknown" },
};

/** Đã dùng hết hạn mức chưa? `unknown` trả về false — xem lý do fail-OPEN ở
 *  `Quota`. Đây là chỗ DUY NHẤT trả lời câu hỏi đó; hai chỗ tự tính là con
 *  đường ngắn nhất tới hai kết luận lệch nhau. */
export function isQuotaExhausted(quota: Quota): boolean {
  return quota.state === "known" && quota.used >= quota.limit;
}
