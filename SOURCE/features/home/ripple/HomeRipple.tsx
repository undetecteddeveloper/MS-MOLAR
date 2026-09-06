"use client";

// HomeRipple — sóng ô vuông nổi lên khi chạm vào NỀN trang chủ (engineer
// 2026-09-05: "vô hình cho tới khi chạm"). Đây là phần rẻ nhất có thể ở trạng
// thái nghỉ: ba listener pointer trên document, không canvas, không mã vẽ —
// module vẽ (rippleCanvas.ts) chỉ được nạp ở cú chạm đầu tiên hợp lệ.
//
// Sóng KHÔNG nổi khi: người dùng đã chọn giảm chuyển động; mục tiêu chạm không
// phải khoảng trắng — chữ, hình, nút/liên kết/ô nhập, hay bất kỳ khối có nền
// tô (tap.ts, engineer 2026-09-06); ngón tay đã kéo (>10px) hoặc giữ (>600ms).
// Lớp vẽ nằm SAU nội dung (z âm trong stacking context của trang, xem
// app/page.tsx), pointer-events: none — không bao giờ chắn một cú bấm.
import { useEffect, useRef } from "react";
import { isBackgroundTarget, isTap, type PointerPoint } from "./tap";
import type { RippleLayer } from "./rippleCanvas";

const FALLBACK_COLOR = "#117a45";

export function HomeRipple() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Mốc dừng khi dò ngược nền: khối trang có `data-ripple-root` (app/page.tsx)
    // — chính nền trắng của nó là "mặt nước".
    const root = host.closest("[data-ripple-root]") ?? document.body;

    let layer: RippleLayer | null = null;
    let loading: Promise<RippleLayer> | null = null;
    let disposed = false;
    let down: PointerPoint | null = null;

    // Nạp module vẽ đúng một lần, ở cú chạm đầu; các cú chạm trong lúc đang
    // tải đều nối vào cùng một promise.
    function getLayer(): Promise<RippleLayer> {
      if (layer) return Promise.resolve(layer);
      loading ??= import("./rippleCanvas").then((mod) => {
        // Màu lấy từ token --primary của theme để canvas không lệch khỏi
        // globals.css khi theme đổi.
        const color =
          getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() ||
          FALLBACK_COLOR;
        layer = mod.createRippleLayer(host as HTMLElement, color);
        return layer;
      });
      return loading;
    }

    function onDown(e: PointerEvent) {
      down =
        e.isPrimary && e.button === 0 && isBackgroundTarget(e.target, root)
          ? { id: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp }
          : null;
    }

    function onUp(e: PointerEvent) {
      const up: PointerPoint = { id: e.pointerId, x: e.clientX, y: e.clientY, time: e.timeStamp };
      const ok = isTap(down, up);
      down = null;
      if (!ok) return;
      void getLayer().then((l) => {
        if (!disposed) l.tap(up.x, up.y);
      });
    }

    function onCancel() {
      down = null;
    }

    document.addEventListener("pointerdown", onDown, { passive: true });
    document.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointercancel", onCancel, { passive: true });
    return () => {
      disposed = true;
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onCancel);
      layer?.destroy();
    };
  }, []);

  return <div ref={hostRef} aria-hidden className="pointer-events-none fixed inset-0 -z-10" />;
}
