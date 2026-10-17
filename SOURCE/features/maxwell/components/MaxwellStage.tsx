"use client";

// MaxwellStage — khung chứa cảnh 3D của trang ẩn Maxwell.
//
// `three` + cảnh được nạp bằng `import()` động TRONG effect: HTML của trang (tiêu
// đề, nút quay lại, dòng ghi công) về ngay, phần 3D tải sau. Khung có kích thước
// cố định theo `className` của nơi dùng nên cảnh hiện ra không làm trang nhảy
// (CLS = 0).
//
// Ba trạng thái và không có trạng thái nào là trang trắng:
//  - loading: một câu "Đang gọi Maxwell…" đúng chỗ mô hình sẽ hiện;
//  - ready: canvas WebGL;
//  - unsupported: không có WebGL / tải hỏng / máy thu hồi ngữ cảnh đồ hoạ — một
//    câu báo, tiêu đề phía dưới vẫn ở đó.
//
// Cú đá (2026-10-17): nhấn vào mô hình MỘT lần thì Maxwell bị hất văng khỏi bục.
// Lớp bắt nhấn là một <button> trong suốt phủ trên canvas — một nút thật thì bàn
// phím (Enter/Space) và trình đọc màn hình cũng đá được; `event.detail === 0` là
// dấu hiệu click do bàn phím sinh ra (không có toạ độ con trỏ). Nhấn trượt mô hình
// thì không có gì xảy ra. Đá xong là hết: nút biến mất, tải lại trang thì Maxwell về.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { MaxwellScene } from "../scene/createMaxwellScene";

type Status = "loading" | "ready" | "unsupported";

// Canvas phủ KHUNG CẢ TRANG (2026-10-17): sàn dưới bục kéo xuống tận mép dưới và
// `children` (tiêu đề…) là lớp chữ đè lên sàn, thay vì canvas và chữ chia hai vùng
// với một đường cắt ngang. Chữ đo chiều cao của chính nó rồi báo cho cảnh
// (`setBottomInset`) để bục + mô hình dàn trong phần phía trên, không chui xuống
// dưới chữ. Lớp chữ `pointer-events-none`: cú nhấn xuyên qua tới nút đá; link bên
// trong tự bật lại `pointer-events-auto`.
export function MaxwellStage({ className, children }: { className?: string; children?: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<MaxwellScene | null>(null);
  const insetRef = useRef(0);
  const [status, setStatus] = useState<Status>("loading");
  const [kicked, setKicked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let scene: MaxwellScene | null = null;

    import("../scene/createMaxwellScene")
      .then(({ createMaxwellScene }) => {
        const host = hostRef.current;
        if (cancelled || !host) return;
        // Ném khi trình duyệt không tạo được ngữ cảnh WebGL → rơi xuống catch.
        scene = createMaxwellScene(host, {
          onContextLost: () => {
            if (!cancelled) setStatus("unsupported");
          },
        });
        sceneRef.current = scene;
        scene.setBottomInset(insetRef.current);
        return scene.ready.then(() => {
          if (!cancelled) setStatus("ready");
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("unsupported");
      });

    return () => {
      cancelled = true;
      sceneRef.current = null;
      scene?.dispose();
    };
  }, []);

  // Đo lớp chữ; cảnh có thể chưa tạo xong — giá trị nằm trong `insetRef` chờ sẵn.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || typeof ResizeObserver === "undefined") return;
    const apply = () => {
      insetRef.current = overlay.offsetHeight;
      sceneRef.current?.setBottomInset(insetRef.current);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(overlay);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn("relative flex flex-col", className)}>
      <div
        ref={hostRef}
        role="img"
        aria-label={kicked ? t("maxwell.sceneLabelKicked") : t("maxwell.sceneLabel")}
        data-testid="maxwell-scene"
        data-status={status}
        data-kicked={kicked}
        className="absolute inset-0"
      />
      {status !== "ready" && (
        <p
          aria-live="polite"
          data-testid="maxwell-status"
          className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/70"
        >
          {status === "loading" ? t("maxwell.loading") : t("maxwell.unsupported")}
        </p>
      )}
      {status === "ready" && !kicked && (
        <button
          type="button"
          aria-label={t("maxwell.kick")}
          data-testid="maxwell-kick"
          // `touch-pan-y`: vuốt dọc trên mô hình vẫn cuộn được trang như canvas cũ.
          className="absolute inset-0 touch-pan-y focus-visible:ring-3 focus-visible:ring-white/50 focus-visible:outline-none focus-visible:ring-inset"
          onPointerMove={(event) => {
            const over = sceneRef.current?.isOverModel(event.clientX, event.clientY) ?? false;
            event.currentTarget.style.cursor = over ? "pointer" : "default";
          }}
          onClick={(event) => {
            const scene = sceneRef.current;
            if (!scene) return;
            const hit =
              event.detail === 0 ? scene.kick() : scene.kickAt(event.clientX, event.clientY);
            if (hit) setKicked(true);
          }}
        />
      )}
      {/* Người dùng trình đọc màn hình nghe được kết quả của cú đá. */}
      <p aria-live="polite" className="sr-only">
        {kicked ? t("maxwell.sceneLabelKicked") : ""}
      </p>
      {children && (
        <div ref={overlayRef} className="pointer-events-none relative z-10 mt-auto">
          {children}
        </div>
      )}
    </div>
  );
}
