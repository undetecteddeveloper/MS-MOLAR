"use client";

// StatusBadge — nhãn trạng thái đề UGC (UI Spec D9 / Task 6.3).
// Phân biệt được cả khi GRAYSCALE: mỗi status có glyph + CHỮ riêng (không chỉ
// dựa màu). Client component vì hai nơi dùng nó (ExamRow, ReviewScreen) đều là
// client — không mất gì.
//
// Theme "Sân trường" (2026-09-09): primitive Badge, hết viền và hex theme cũ.
// Màu theo NỀN nó đứng trên — cùng một huy hiệu nằm trên thẻ surface (hàng Đề
// của tôi) và trên nền trắng (đầu trang rà soát), mà một viên "surface" trên
// surface hay "trắng" trên trắng thì tan vào nền. `on` nói nền nào; mặc định
// là thẻ surface vì đó là chỗ nó xuất hiện nhiều nhất.
//
// "Cần rà soát" mang vàng nắng: đó là trạng thái đang CHỜ TÁC GIẢ, đúng nghĩa
// "việc tiếp theo của bạn" mà vàng giữ ở BottomNav và thẻ Tiếp theo — và luôn
// kèm chữ đen, không tự nó truyền tin (§2).

import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

type Status = "processing" | "review" | "draft" | "published" | "failed";
type Variant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const CONFIG: Record<Status, { glyph: string; labelKey: MessageKey }> = {
  processing: { glyph: "◌", labelKey: "status.processing" },
  review: { glyph: "◑", labelKey: "status.needsReview" },
  draft: { glyph: "○", labelKey: "status.draft" },
  published: { glyph: "●", labelKey: "status.published" },
  failed: { glyph: "▲", labelKey: "status.needsFixing" },
};

/** Biến thể Badge + lớp chữ theo (trạng thái, nền). */
const LOOK: Record<
  "surface" | "background",
  Record<Status, { variant: Variant; text?: string }>
> = {
  surface: {
    processing: { variant: "plain", text: "text-muted-foreground" },
    review: { variant: "sun" },
    draft: { variant: "plain" },
    published: { variant: "plain", text: "text-success" },
    failed: { variant: "wrong" },
  },
  background: {
    processing: { variant: "muted" },
    review: { variant: "sun" },
    draft: { variant: "surface" },
    published: { variant: "success" },
    failed: { variant: "wrong" },
  },
};

export function StatusBadge({
  status,
  on = "surface",
  className,
}: {
  status: string;
  /** Nền huy hiệu đứng trên: thẻ surface (mặc định) hay nền trang trắng. */
  on?: "surface" | "background";
  className?: string;
}) {
  const key: Status = status in CONFIG ? (status as Status) : "processing";
  const cfg = CONFIG[key];
  const look = LOOK[on][key];
  return (
    <Badge variant={look.variant} className={cn(look.text, className)}>
      <span aria-hidden>{cfg.glyph}</span>
      {t(cfg.labelKey)}
    </Badge>
  );
}
