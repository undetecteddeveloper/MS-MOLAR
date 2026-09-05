// Định dạng số tiền VNĐ (UI Spec UI-D13). Cùng họ module với
// `lib/format/datetime.ts` và cùng lý do ghim locale `vi-VN`: `Intl` để tự suy
// sẽ phân giải theo ngôn ngữ của MÁY CHỦ.
//
// Vì sao phải có hàm này thay vì nội suy thẳng: đường thay tham số của `t()`
// là `String(value)` thô (lib/copy.ts), nên `t("billing.amount", { amount:
// 39000 })` in ra "39000 VNĐ" ngay cạnh một mã QR mang "39.000 VNĐ".
//
// QUY TẮC BẮT BUỘC: định dạng TRƯỚC, dịch SAU. Không template literal, không
// `${amount}`, không bao giờ đưa một giá trị SỐ vào `t()` cho tiền.

const EM_DASH = "—";
const LOCALE_TAG = "vi-VN";

/**
 * "39.000". Chỉ CON SỐ, không kèm đơn vị.
 *
 * `0` là một số tiền hợp lệ và in ra "0"; chỉ giá trị không hữu hạn (NaN,
 * ±Infinity — dấu hiệu dữ liệu hỏng) mới ra "—". Không bao giờ ném.
 */
export function formatVnd(amount: number): string {
  if (!Number.isFinite(amount)) return EM_DASH;
  return new Intl.NumberFormat(LOCALE_TAG).format(amount);
}
