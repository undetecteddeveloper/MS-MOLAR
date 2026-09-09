"use client";

// usePresence — giữ một phần tử mở/đóng (menu, sheet, hộp thoại) trong cây
// thêm đúng khoảng thời gian chiều ĐÓNG của nó chạy xong, rồi mới gỡ.
//
// Vì sao cần: các menu/sheet của repo render có điều kiện (`open && <div>`),
// nên `open = false` là gỡ ngay — CSS không có gì để chuyển động ở chiều đóng.
// Hook này trả `present` (còn nên render không) và `closing` (đang đóng — nơi
// gọi gắn `data-closing` để CSS `.motion-*[data-closing]` tô trạng thái cuối).
//
// Chiều đóng chỉ CHẠY khi trình duyệt có `matchMedia` và người dùng KHÔNG bật
// giảm chuyển động; còn lại gỡ ngay như trước. jsdom không có `matchMedia`, nên
// mọi test hiện có (menu biến mất ngay sau click) giữ nguyên ý nghĩa.
//
// Pha đổi TRONG LÚC RENDER (mẫu "điều chỉnh state khi prop đổi" của React),
// không trong effect: mở lại trong lúc đang đóng thì ngay lượt render đó pha
// về "open" — transition CSS đang chạy ngược sẽ quay đầu, không nháy.

import { useEffect, useState } from "react";

/* Khớp với `--motion-*-exit` trong app/globals.css. Đổi một bên là bên kia
   hoặc gỡ sớm (cắt cụt chuyển động) hoặc gỡ muộn (phần tử vô hình còn nằm
   trong DOM). */
export const POP_EXIT_MS = 120;
export const MODAL_EXIT_MS = 150;
export const SHEET_EXIT_MS = 200;

type Phase = "closed" | "open" | "closing";

export function usePresence(open: boolean, exitMs: number): { present: boolean; closing: boolean } {
  const [phase, setPhase] = useState<Phase>(open ? "open" : "closed");

  if (open && phase !== "open") setPhase("open");
  if (!open && phase === "open") setPhase(canAnimateExit() ? "closing" : "closed");

  useEffect(() => {
    if (phase !== "closing") return;
    const id = window.setTimeout(() => setPhase("closed"), exitMs);
    return () => window.clearTimeout(id);
  }, [phase, exitMs]);

  return { present: phase !== "closed", closing: phase === "closing" };
}

function canAnimateExit(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
