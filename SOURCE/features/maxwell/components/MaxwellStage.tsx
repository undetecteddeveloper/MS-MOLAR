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

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { MaxwellScene } from "../scene/createMaxwellScene";

type Status = "loading" | "ready" | "unsupported";

export function MaxwellStage({ className }: { className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("loading");

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
        return scene.ready.then(() => {
          if (!cancelled) setStatus("ready");
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("unsupported");
      });

    return () => {
      cancelled = true;
      scene?.dispose();
    };
  }, []);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={hostRef}
        role="img"
        aria-label={t("maxwell.sceneLabel")}
        data-testid="maxwell-scene"
        data-status={status}
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
    </div>
  );
}
