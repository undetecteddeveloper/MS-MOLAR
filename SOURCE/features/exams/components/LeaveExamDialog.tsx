"use client";

// LeaveExamDialog — modal cảnh báo rời trang làm bài (S#28 Q3, Layer 2).
// Theme "Sân trường": thẻ trắng bo 18px, không viền, không bóng — phân lớp bằng
// scrim xanh đen mờ; dưới 640px thẻ dính đáy như một tấm kéo lên (cùng khuôn
// với hộp thoại báo cáo đề ở ReportExam). "Huỷ" là nút phụ (surface); "Rời khỏi"
// mang màu đỏ vì nó xoá bài đang làm dở — màu nói đúng hậu quả, không nói đúng
// ý muốn. Esc hoặc click scrim = Huỷ.

import { useEffect } from "react";
import { t } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface LeaveExamDialogProps {
  open: boolean;
  onCancel: () => void;
  onLeave: () => void;
}

export function LeaveExamDialog({ open, onCancel, onLeave }: LeaveExamDialogProps) {
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
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6"
    >
      {/* Scrim — click ra ngoài = Hủy. */}
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onCancel}
        className="bg-foreground/40 absolute inset-0 cursor-default"
      />
      <Card variant="plain" className="relative w-full max-w-sm gap-3 p-5">
        <h2 id="leave-exam-title" className="text-foreground text-lg font-semibold">
          {t("player.leaveTitle")}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">{t("player.leaveBody")}</p>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={onLeave}>
            {t("player.leave")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
