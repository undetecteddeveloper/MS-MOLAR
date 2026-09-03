"use client";

// C-15 PaymentConfirm — nút xác nhận của AC-039 (UI Spec § Component:
// `PaymentConfirm` — C-15; frontend DD § C-15, quyết định E2, FE-AC-18, rủi ro
// R-9).
//
// NÓ BỌC C-10 CHỨ KHÔNG TỰ PHÁT MỘT HÀNH ĐỘNG RIÊNG, vì xác nhận đã thanh toán
// CHÍNH LÀ đối soát chủ động: lời khẳng định của người dùng không phải bằng
// chứng, lượt hỏi nhà cung cấp trong `settleOrder()` mới là (ADR-0014).
//
// AC-039 LÀ MỘT CỔNG, KHÔNG CHỈ LÀ THỨ TỰ DOM. Hai liên kết phải đứng TRƯỚC nút
// (việc ấy do `page.tsx` xếp, đúng cây component của cả UI Spec lẫn frontend
// DD) VÀ phải trỏ tới NỘI DUNG THẬT. TBD-02 còn mở — `/terms` và
// `/refund-policy` hôm nay render `LegalContentPending` — nên chừng nào
// `legalContentReady === false` thì nút mang `aria-disabled="true"` (chuỗi),
// vẫn FOCUS ĐƯỢC, có lý do đọc được buộc bằng `aria-describedby`, và bấm vào
// KHÔNG xảy ra chuyện gì.
//
// HAI Ổ KHOÁ ĐỘC LẬP CÙNG ĐANG ĐÓNG, VÀ SỰ TRÙNG HỢP ẤY KHÔNG ĐƯỢC HIỂU THÀNH
// MỘT TRONG HAI ĐÃ MỞ. `GEMINI_PAID_TIER_ENABLED` đang tắt (AC-054) nên hôm nay
// không ai tới được S-06; TBD-02 là ổ khoá KHÁC trên chính cái nút này. Khi cờ
// phát hành bật lên, cổng pháp lý vẫn phải tự đứng được — vì thế
// `legalContentReady` được tính TỪ NỘI DUNG PHÁP LÝ CÓ THẬT HAY KHÔNG, tính ở
// `page.tsx` phía máy chủ và truyền xuống dưới dạng prop, TUYỆT ĐỐI không suy
// ra từ `isPaidTierEnabled()` (R-9, phỏng đoán đắt giá nhất của bản thiết kế
// frontend).
//
// VÌ SAO NHÁNH BỊ KHOÁ KHÔNG MOUNT C-10. C-10 suy `aria-disabled` từ đúng hai
// thứ nó biết — đang bận, và trạng thái KẾT THÚC — và nó là file ĐÃ SHIP, không
// nằm trong phạm vi sửa của task này. Cổng pháp lý không diễn đạt được qua nó
// mà không đổi hợp đồng của nó. Nên: cổng MỞ ⇒ đúng C-10, không thêm gì; cổng
// ĐÓNG ⇒ một nút cùng NHÃN ấy, không mang hành động nào cả. Nguyên tắc "bọc chứ
// không tự phát hành động" được giữ nguyên: nhánh bị khoá không phát hành động
// NÀO, kể cả của chính nó.
//
// LÝ DO CỦA NHÁNH KHOÁ LÀ LÝ DO PHÁP LÝ, KHÔNG PHẢI CÂU "đơn đã đóng" của C-10.
// Hai câu nói về hai sự thật khác nhau, và mượn nhầm câu sẽ báo với người đang
// cầm một đơn còn sống rằng đơn của họ đã chết.
//
// KHÔNG BAO GIỜ `disabled` gốc, ở MỌI trạng thái: nút disabled rơi khỏi thứ tự
// tab, mà đúng người cần với tới nút này nhất là người cần ĐỌC vì sao nó không
// bấm được (AC-043).

import { Button } from "@/components/ui/button";
import { RecheckOrderControl } from "@/components/billing/RecheckOrderControl";
import { useT } from "@/lib/i18n/client";

export function PaymentConfirm({
  orderCode,
  status,
  legalContentReady,
}: {
  orderCode: number;
  /** Trạng thái CỦA DÒNG, nguyên si như tầng truy vấn giao — C-10 cần nó để
   *  phân biệt một đơn đã kết thúc với một giá trị không nhận ra, và C-15
   *  không có cách nào tự bịa ra giá trị ấy. */
  status: string;
  /** Tính ở `page.tsx` từ ĐÚNG hai khoá `billing.terms.body` và
   *  `billing.refund.body` trong `en.ts`. Không bao giờ tính trong file này,
   *  không bao giờ đọc từ biến môi trường, không bao giờ suy từ cờ phát hành. */
  legalContentReady: boolean;
}) {
  const t = useT();

  if (legalContentReady) {
    return <RecheckOrderControl orderCode={orderCode} variant="primary" status={status} />;
  }

  const reasonId = `confirm-${orderCode}-legal`;

  return (
    <div>
      <Button
        type="button"
        className="min-h-11"
        // Chuỗi "true" cho aria-disabled — cùng quy ước với C-10, ActionButton
        // và ExplainStepAffordance. KHÔNG có `disabled`, và KHÔNG có onClick:
        // không có handler thì không có hành động nào để về sớm khỏi.
        aria-disabled="true"
        aria-describedby={reasonId}
      >
        {t("billing.confirm.action")}
      </Button>
      {/* HIỆN RA CHỨ KHÔNG sr-only: người nhìn thấy nút cũng cần đọc được vì
          sao nó không dùng được, chứ không chỉ người dùng trình đọc màn hình.
          Không `aria-live` — câu này có mặt ngay từ lượt render đầu, nó không
          phải một thông báo sau hành động (Decision 2). */}
      <p id={reasonId} className="text-muted-foreground mt-2 text-sm leading-relaxed">
        {t("billing.confirm.legalPending.reason")}
      </p>
    </div>
  );
}
