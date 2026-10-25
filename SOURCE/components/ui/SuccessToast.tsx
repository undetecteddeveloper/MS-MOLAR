"use client";

// SuccessToast — toast xác nhận (đợt chỉnh UX trang Đánh giá, 2026-07-27).
// Top-center dưới 768px, bottom-center từ 768px trở lên — lý do ở khối chú
// thích ngay trên phần tử, đọc trước khi đổi vị trí. Replaces the old "Saved"
// trạng thái nhãn nút: nút gửi
// giờ chỉ còn hai trạng thái (Gửi / Đang gửi), và toast
// này là tín hiệu thành công duy nhất. Nảy lên từ mép dưới
// (easing vọt nhẹ) và tự tắt sau `durationMs`. Bên sở hữu
// tăng `trigger` (số thay đổi bất kỳ) mỗi lần muốn toast
// hiện lại, việc này cũng khởi động lại bộ đếm tự tắt.
//
// Cấu trúc hai phần có chủ đích: bong bóng hiển thị luôn được mount và
// chỉ bật tắt opacity/transform cho animation vào/ra, nghĩa là
// nội dung chữ của nó thực sự không bao giờ *đổi* — vùng aria-live chỉ được
// trình đọc màn hình đọc khi nội dung biến đổi, nên một vùng mà
// permanently "Đã gửi đánh giá" would go unannounced after the first mount.
// Một vùng sr-only riêng, có chữ đổi "" -> thông báo -> "" ở mỗi
// lần trigger, mới thực sự kích hoạt việc đọc thông báo; bong bóng hiển thị vẫn
// aria-hidden để thông báo không bị đọc hai lần.

import { useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";

interface SuccessToastProps {
  message: string;
  trigger: number;
  durationMs?: number;
  /** Biểu tượng trước chữ; mặc định dấu tích. */
  icon?: ReactNode;
  /** `"auto"`: đỉnh ở mobile, đáy từ 768px (lý do ở khối chú thích bên dưới).
   *  `"above-action-bar"`: ĐÁY ở mọi bề rộng, ngay trên dải nút dính đáy của
   *  màn làm bài — route đó ẩn BottomNav (`isExamFocusRoute`), nên thứ duy
   *  nhất ở đáy là dải "Câu trước · Nộp bài · Câu sau" cao ~73px. */
  placement?: "auto" | "above-action-bar";
}

export function SuccessToast({
  message,
  trigger,
  durationMs = 3000,
  icon,
  placement = "auto",
}: SuccessToastProps) {
  // Trạng thái được lưu là "trigger nào ĐÃ hết hạn", không phải "đang hiện".
  // Hiện/ẩn là giá trị DẪN XUẤT lúc render, nên không cần một lượt setState để
  // bật toast lên — trước đây effect gọi `setVisible(true)` ngay trong thân nó,
  // tức là mỗi lần trigger đổi thì render một lần ở trạng thái ẩn rồi lập tức
  // render lại ở trạng thái hiện (cascading render — `react-hooks/
  // set-state-in-effect`). Nay chỉ còn setState trong callback của setTimeout,
  // là đúng thứ effect được sinh ra để làm.
  const [expiredTrigger, setExpiredTrigger] = useState(0);
  const visible = trigger !== 0 && trigger !== expiredTrigger;

  useEffect(() => {
    if (trigger === 0) return;
    const timer = setTimeout(() => setExpiredTrigger(trigger), durationMs);
    return () => clearTimeout(timer);
  }, [trigger, durationMs]);

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {visible ? message : ""}
      </div>
      {/* Vị trí đổi theo bề rộng (tài liệu Mobile-Layout-Research-MS §6.2):
          - <768px: TOP-CENTER. Không phải tuỳ chọn thẩm mỹ mà là hệ quả bắt
            buộc của BottomNav — giữ `bottom-6` thì toast sẽ nằm ĐÚNG TRÊN thanh
            điều hướng đáy, tức tự tạo ra đúng kiểu đè chéo mà §6.2 mô tả, và
            che mất các ô điều hướng trong 3 giây. Đỉnh màn hình thuộc vùng nhìn
            ngoại vi: thấy được trạng thái mà không chặn luồng ngón tay.
          - ≥768px: giữ nguyên bottom-center như trước — không có thanh đáy để
            đụng, và đổi chỗ vô cớ là thay đổi hành vi desktop đã quen thuộc.
          Hướng trượt vào cũng lật theo: từ TRÊN xuống ở mobile, từ DƯỚI lên ở
          desktop — vật thể phải bay vào từ phía mép nó neo. */}
      <div
        aria-hidden
        className={`pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4 transition-[opacity,translate] motion-reduce:transition-none ${
          placement === "auto"
            ? "top-[calc(3.75rem+env(safe-area-inset-top,0px))] md:top-auto md:bottom-6"
            : "bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-6"
        } ${
          visible
            ? "translate-y-0 opacity-100 duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]"
            : placement === "auto"
              ? "-translate-y-3 opacity-0 duration-150 ease-out md:translate-y-3"
              : "translate-y-3 opacity-0 duration-150 ease-out"
        }`}
      >
        <div className="border-border bg-foreground text-background flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium">
          {icon ?? <Check className="h-4 w-4 shrink-0 text-[color:var(--ring)]" />}
          {message}
        </div>
      </div>
    </>
  );
}
