// ResultActions — Save PDF + Share buttons ở màn Result (Layer 2). GĐ 3 M3.1
// Task 12: nối lại từ chỗ giữ chỗ "sắp có" đang bị vô hiệu sang
// ActionButton dùng chung (AC-007/AC-014) — cùng component mà HistoryRow (Task 13)
// sẽ dùng, nên Lưu/Chia sẻ giờ hoạt động đầy đủ ở đây.
//
// Render hai nút như anh em (không có lưới bọc riêng) — nơi gọi
// (result/page.tsx) đặt chúng trong hàng 3 cột của chính nó cùng với
// nút "Return", để cả ba cùng cao và rộng như nhau. Bản sửa hình dạng DOM
// của chính ActionButton (Task 10/11, xem history-frontend-design.md § ActionButton —
// Deep Dive) giữ cho mỗi bản chỉ có một <button> trong luồng ở mọi
// pha (idle/busy/error/fallback-confirmed), nên số ô grid-cols-3
// mà trang này phụ thuộc không đổi.
import { ActionButton } from "@/components/history/ActionButton";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";

export function ResultActions({
  pdfInput,
  blockedReason,
}: {
  pdfInput: AttemptPdfData;
  /** Truyền xuống CẢ HAI nút. Chặn một nút mà mở nút kia là không chặn gì cả —
   *  "Lưu" và "Chia sẻ" sinh ra CÙNG một tệp. */
  blockedReason: string | null;
}) {
  return (
    <>
      <ActionButton
        action="save"
        idPrefix="result"
        pdfInput={pdfInput}
        blockedReason={blockedReason}
      />
      <ActionButton
        action="share"
        idPrefix="result"
        pdfInput={pdfInput}
        blockedReason={blockedReason}
      />
    </>
  );
}
