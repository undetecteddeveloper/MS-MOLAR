"use client";

// SuccessToast — confirmation toast (Rating Page UX pass, 2026-07-27).
// Top-center dưới 768px, bottom-center từ 768px trở lên — lý do ở khối chú
// thích ngay trên phần tử, đọc trước khi đổi vị trí. Replaces the old "Saved"
// button-label state: the submit
// button now only ever shows two states (Submit / Submitting), and this
// toast is the sole success signal instead. Bounces up from the bottom edge
// (slight overshoot easing) and auto-dismisses after `durationMs`. The owner
// bumps `trigger` (any changing number) each time it wants the toast to
// (re)appear, which also restarts the auto-dismiss timer.
//
// Two-part markup on purpose: the visible bubble is always mounted and
// merely toggles opacity/transform for its enter/exit animation, which means
// its text content never actually *changes* — an aria-live region only gets
// announced by a screen reader on a content mutation, so a region that's
// permanently "Đã gửi đánh giá" would go unannounced after the first mount.
// A separate sr-only region whose text flips "" -> message -> "" on each
// trigger is what actually fires the announcement; the visible bubble stays
// aria-hidden so the message isn't read out twice.

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

interface SuccessToastProps {
  message: string;
  trigger: number;
  durationMs?: number;
}

export function SuccessToast({ message, trigger, durationMs = 3000 }: SuccessToastProps) {
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
        className={`pointer-events-none fixed inset-x-0 top-[calc(3.75rem+env(safe-area-inset-top,0px))] z-[70] flex justify-center px-4 transition-all motion-reduce:transition-none md:top-auto md:bottom-6 ${
          visible
            ? "translate-y-0 opacity-100 duration-300 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]"
            : "-translate-y-3 opacity-0 duration-200 ease-in md:translate-y-3"
        }`}
      >
        <div className="border-border bg-foreground text-background flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium">
          <Check className="h-4 w-4 shrink-0 text-[color:var(--ring)]" />
          {message}
        </div>
      </div>
    </>
  );
}
