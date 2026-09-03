"use client";

// StatusBadge — nhãn trạng thái đề UGC (UI Spec D9 / Task 6.3).
// Phân biệt được cả khi GRAYSCALE: mỗi status có glyph + CHỮ riêng (không chỉ
// dựa màu). Client component vì nhãn phải theo ngôn ngữ đang chọn — cả hai nơi
// dùng nó (ExamRow, ReviewScreen) đều đã là client nên không mất gì.

import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

type Status = "processing" | "review" | "draft" | "published" | "failed";

const CONFIG: Record<
  Status,
  { glyph: string; labelKey: MessageKey; className: string }
> = {
  processing: {
    glyph: "◌",
    labelKey: "status.processing",
    className: "border-border text-muted-foreground",
  },
  review: {
    glyph: "◑",
    labelKey: "status.needsReview",
    className: "border-[#B8863B] text-[#8a6420]",
  },
  draft: {
    glyph: "○",
    labelKey: "status.draft",
    className: "border-border text-muted-foreground",
  },
  published: {
    glyph: "●",
    labelKey: "status.published",
    className: "border-[#3f7d4f] text-[#2f6b3f]",
  },
  failed: {
    glyph: "▲",
    labelKey: "status.needsFixing",
    className: "border-brand text-brand",
  },
};

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const t = useT();
  const cfg = CONFIG[status as Status] ?? CONFIG.processing;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cfg.className,
        className,
      )}
    >
      <span aria-hidden>{cfg.glyph}</span>
      {t(cfg.labelKey)}
    </span>
  );
}
