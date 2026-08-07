"use client";

// LeaveExamDialog — modal cảnh báo rời trang làm bài (S#28 Q3, Layer 2).
// Theme Mực & Sơn mài: card nền background + viền hairline, KHÔNG đổ bóng
// (DESIGN.md Elevation & Depth) — phân lớp bằng scrim đen sơn mài mờ.
// Nút chính "Leave" đỏ son (hành động rời = hành động chính user đang muốn);
// "Cancel" outline phụ. Esc hoặc click scrim = Cancel.

import { useEffect } from "react";
import { useT } from "@/lib/i18n/client";

interface LeaveExamDialogProps {
  open: boolean;
  onCancel: () => void;
  onLeave: () => void;
}

export function LeaveExamDialog({ open, onCancel, onLeave }: LeaveExamDialogProps) {
  const t = useT();
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-exam-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
    >
      {/* Scrim — click ra ngoài = Hủy. */}
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-[#1B1512]/40"
      />
      <div className="border-border bg-background relative w-full max-w-sm rounded-lg border p-6">
        <h2 id="leave-exam-title" className="text-foreground font-serif text-xl">
          {t("player.leaveTitle")}
        </h2>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          {t("player.leaveBody")}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="border-border text-foreground hover:bg-accent rounded-[4px] border px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="bg-brand text-brand-foreground rounded-full px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-opacity hover:opacity-90"
          >
            {t("player.leave")}
          </button>
        </div>
      </div>
    </div>
  );
}
