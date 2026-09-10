"use client";

// TicketStatusBadge — nhãn trạng thái ticket hỗ trợ (UI Spec, I002 fix).
// Sibling ĐỘC LẬP của StatusBadge.tsx ((authoring)) — Status/CONFIG riêng, KHÔNG
// merge vào StatusBadge's CONFIG (UI-D2/I002). Glyph khác hẳn bộ ◌/◑/○/●/▲
// của StatusBadge để hai hệ thống không lẫn vào nhau.
//
// Theme "Sân trường" (2026-09-10): primitive Badge, hết viền và hex theme cũ.
// Huy hiệu luôn đứng trên thẻ surface (hàng ticket) nên nền TRẮNG; "Đang xử
// lý" mang vàng nắng — đó là việc đang nằm trên bàn quản trị, cùng nghĩa "việc
// tiếp theo của bạn" mà vàng giữ ở BottomNav — và luôn kèm chữ đen (§2). "Đã
// xử lý" chữ xanh. Glyph vẫn là CHỮ (không phải icon): ca kiểm đọc glyph qua
// textContent để chứng minh ba trạng thái phân biệt được không nhờ màu.

import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import type { TicketStatus } from "@/lib/support/types";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

type Variant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

const CONFIG: Record<
  TicketStatus,
  { glyph: string; labelKey: MessageKey; variant: Variant; text?: string }
> = {
  new: { glyph: "✉", labelKey: "support.admin.status.new", variant: "plain" },
  in_progress: { glyph: "▶", labelKey: "support.admin.status.inProgress", variant: "sun" },
  resolved: {
    glyph: "✓",
    labelKey: "support.admin.status.resolved",
    variant: "plain",
    text: "text-success",
  },
};

export function TicketStatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  // Không có giá trị nào ngoài 3 trạng thái cố định thực sự tới được đây (AC-028
  // DB default 'new'), nhưng fallback về 'new' thay vì render trống — mirror
  // StatusBadge's `CONFIG[status] ?? CONFIG.processing` convention.
  const cfg = CONFIG[status] ?? CONFIG.new;
  return (
    <Badge variant={cfg.variant} className={cn(cfg.text, className)}>
      <span aria-hidden>{cfg.glyph}</span>
      {t(cfg.labelKey)}
    </Badge>
  );
}
