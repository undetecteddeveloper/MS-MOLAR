// Định dạng số tiền VNĐ (UI Spec UI-D13). Cùng họ module với
// `lib/format/datetime.ts` và cùng một lý do ghim ngôn ngữ: `Intl` để tự suy
// sẽ phân giải theo ngôn ngữ của MÁY CHỦ, không theo cookie của người dùng.
//
// Vì sao phải có hàm này thay vì nội suy thẳng: đường thay tham số của i18n là
// `String(value)` thô (`lib/i18n/translate.ts:27`), nên
// `t("billing.amount", { amount: 39000 })` in ra "39000 VNĐ" ngay cạnh một mã
// QR mang "39.000 VNĐ". Người dùng đọc thấy hai con số khác nhau trên màn hình
// thanh toán thì dừng trả tiền.
//
// QUY TẮC BẮT BUỘC: định dạng TRƯỚC, dịch SAU. Không template literal, không
// `${amount}`, không bao giờ đưa một giá trị SỐ vào `t()` cho tiền. Đơn vị
// ("VNĐ" / "VND") nằm ở từ điển, giá trị thay vào ĐÃ LÀ chuỗi.
//
// UI-D4 không đổi: GIÁ niêm yết ở S-01 vẫn là một chuỗi hằng trong từ điển.
// Hàm này dành cho SỐ TIỀN LƯU TRÊN ĐƠN — một dữ liệu đến từ database.

import type { Locale } from "@/lib/i18n/locales";

const EM_DASH = "—";

/** Giống `LOCALE_TAG` của datetime.ts, và giữ riêng ở đây có chủ đích: nhóm
 *  hàng nghìn và thứ tự ngày/tháng là hai quyết định độc lập. */
const LOCALE_TAG: Record<Locale, string> = {
  en: "en-GB",
  vi: "vi-VN",
};

/**
 * "39.000" (vi) / "39,000" (en). Chỉ CON SỐ, không kèm đơn vị.
 *
 * `0` là một số tiền hợp lệ và in ra "0"; chỉ giá trị không hữu hạn (NaN,
 * ±Infinity — dấu hiệu dữ liệu hỏng) mới ra "—". Không bao giờ ném.
 */
export function formatVnd(amount: number, locale: Locale): string {
  if (!Number.isFinite(amount)) return EM_DASH;
  return new Intl.NumberFormat(LOCALE_TAG[locale]).format(amount);
}
