// ExamTimer — đồng hồ đếm ngược cho Exam Player (Layer 2). GĐ 3 M3.1 Task 3.
// Đếm từ `durationMinutes` về 0; hết giờ → gọi `onTimeUp` (ExamPlayer auto-submit, PA A).
// Hiển thị MM:SS dạng serif (đồng bộ TEMPLATE/L2/ExamPage), KHÔNG nhấp nháy
// (UI-LAYER-MAP 4.2) — chỉ đổi màu cảnh báo ở phút cuối. Đếm bằng setTimeout
// từng giây để tránh dồn tick khi tab nền.
"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { Translate } from "@/lib/i18n/translate";

interface ExamTimerProps {
  durationMinutes: number;
  /** Gọi đúng một lần khi đồng hồ về 0. */
  onTimeUp: () => void;
}

export function ExamTimer({ durationMinutes, onTimeUp }: ExamTimerProps) {
  const t = useT();
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.round(durationMinutes * 60)));

  // Fire lúc hết giờ phải dùng `onTimeUp` MỚI NHẤT (nó đóng gói answers hiện
  // tại của ExamPlayer), nhưng KHÔNG được là dependency: mỗi lần người làm bài
  // gõ một ký tự, ExamPlayer render lại và `submit` là hàm mới → effect nào phụ
  // thuộc nó sẽ chạy lại và auto-submit lặp. Trước đây tách hai thứ đó bằng
  // latest-ref (`ref.current = onTimeUp` ngay trong thân render) — đúng hành vi
  // nhưng ghi ref lúc render là thao tác KHÔNG an toàn với concurrent rendering
  // (render có thể bị React bỏ dở/chạy lại), nên `react-hooks/refs` chặn.
  // `useEffectEvent` là đúng nguyên hàm cho tình huống này: luôn thấy props mới
  // nhất, và bị loại khỏi dependency của effect theo thiết kế.
  const fireTimeUp = useEffectEvent(() => onTimeUp());

  // Tick mỗi giây cho tới 0.
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  // Khi chạm 0 → auto-submit (đúng một lần vì `remaining` chỉ tới 0 một lần).
  useEffect(() => {
    if (remaining === 0) fireTimeUp();
  }, [remaining]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const low = remaining <= 60; // cảnh báo phút cuối

  return (
    <>
      <span
        role="timer"
        aria-label={t("player.timeRemaining")}
        className={`font-serif text-2xl font-semibold tabular-nums transition-colors ${
          low ? "text-destructive" : "text-foreground"
        }`}
      >
        {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
      </span>

      {/* Cảnh báo phút cuối phải có NHÃN CHỮ, không chỉ đổi màu sang đỏ: WCAG
          1.4.1 (Use of Color) cấm dùng màu làm phương tiện DUY NHẤT để truyền
          đạt thông tin. Người mù màu đỏ-lục — và bất cứ ai không nhớ đồng hồ
          "bình thường" trông ra sao — không đọc được tín hiệu chỉ-bằng-màu.
          Nằm NGOÀI phần tử role="timer" để chuỗi MM:SS mà trình đọc màn hình
          lấy ra vẫn sạch. */}
      {low && <span className="eyebrow text-destructive mt-1 block">{t("player.lastMinute")}</span>}

      {/* role="timer" KHÔNG tự đọc lên: nó chỉ gắn nhãn vai trò cho phần tử,
          không phải vùng động. Trước đây người dùng trình đọc màn hình phải chủ
          động rê con trỏ tới đồng hồ mới biết còn bao lâu — trong lúc đang làm
          bài tính giờ. Vùng live này đọc ở các MỐC thay vì từng giây (đọc mỗi
          giây sẽ chèn ngang liên tục, khiến bài thi không làm nổi). */}
      <span aria-live="polite" className="sr-only">
        {ANNOUNCE_AT.has(remaining) ? announce(t, remaining) : ""}
      </span>
    </>
  );
}

// Các mốc (giây) sẽ được đọc lên: 10 phút, 5 phút, 1 phút, 30 giây, 10 giây.
const ANNOUNCE_AT = new Set([600, 300, 60, 30, 10]);

/**
 * Câu đọc lên tại một mốc. Tách khoá "1 phút" riêng khỏi khoá "{count} phút"
 * vì tiếng Anh đổi dạng số ít/số nhiều (minute/minutes) — ghép chuỗi bằng tay
 * sẽ ra "1 minutes". Tiếng Việt không phân biệt nhưng vẫn dùng chung cấu trúc.
 */
function announce(t: Translate, sec: number): string {
  if (sec === 60) return t("player.oneMinuteRemaining");
  if (sec >= 60) return t("player.minutesRemaining", { count: sec / 60 });
  return t("player.secondsRemaining", { count: sec });
}
