"use client";

// Error boundary của /pricing/checkout (S-06) — khuôn GỐC
// `(HM)/history/error.tsx` (UI-D18, FE-AC-12), giống hệt bản đã sửa ba điểm ở
// `me/orders/error.tsx`: node `role="alert"` NHẬN FOCUS lúc mount qua một ref
// trên lớp bọc `tabIndex={-1}`, và "Làm lại" nối THẲNG vào `reset()` để chạy
// lại chính lượt render server vừa hỏng.
//
// BA ĐIỂM LẤY TỪ `(analytics)/profile/error.tsx` CHỨ KHÔNG TỪ FILE GỐC (frontend
// DD § "Route boundary files"):
//
//   1. CHỈ GHI LOG `error.digest`. File gốc ghi cả object `error`, và ở đây thì
//      TUYỆT ĐỐI không được: thông điệp lỗi của màn THANH TOÁN có thể mang mã
//      đơn, nội dung chuyển khoản hoặc câu chữ của nhà cung cấp, mà
//      § Security Considerations đã cấm ghi nội dung đơn ra log. `digest` là
//      toàn bộ thứ cần để tra lại lượt render hỏng ở phía server.
//   2. `min-h-11` trên nút thử lại. File gốc có trước quy tắc 44px; quy tắc đó
//      ràng buộc mọi control MỚI.
//   3. `common.tryAgain` chứ không `common.retry` — cả hai đều đã ship, hai
//      route mới dùng cái mới hơn.
//
// `tabIndex={-1}` và `focus()` là MỘT yêu cầu, không phải hai: `focus()` trên
// một node không thể nhận focus là một no-op im lặng.
//
// Câu thông báo dùng `error.couldntLoad` — khoá CHUNG cấp trang đã ship, không
// phải `billing.orders.loadError` (câu đó nói "your orders", sai màn). Khối
// khoá `billing.checkout.*` của S-06 thuộc Task 4.3.
import { useEffect, useRef } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { useT } from "@/lib/i18n/client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.error("(billing)/pricing/checkout render failed", { digest: error.digest });
    alertRef.current?.focus();
  }, [error]);

  return (
    // Khớp size + padding của `pricing/checkout/page.tsx` — xem ghi chú ở
    // loading.tsx.
    <PageContainer as="main" size="small">
      <div
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        className="border-brand bg-brand/8 text-brand rounded-[var(--radius-card)] border px-4 py-3 text-sm"
      >
        <p>{t("error.couldntLoad")}</p>
        <button
          type="button"
          onClick={reset}
          className="bg-brand text-brand-foreground mt-3 min-h-11 rounded-full px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-opacity hover:opacity-90"
        >
          {t("common.tryAgain")}
        </button>
      </div>
    </PageContainer>
  );
}
