"use client";

// TicketStatusBadge — nhãn trạng thái ticket hỗ trợ (UI Spec, I002 fix).
// Sibling ĐỘC LẬP của StatusBadge.tsx ((layer4)) — Status/CONFIG riêng, KHÔNG
// merge vào StatusBadge's CONFIG (UI-D2/I002). Glyph khác hẳn bộ ◌/◑/○/●/▲
// của StatusBadge để hai hệ thống không lẫn vào nhau.

import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import type { TicketStatus } from "@/lib/support/types";
import { cn } from "@/lib/utils";

const CONFIG: Record<TicketStatus, { glyph: string; labelKey: MessageKey; className: string }> = {
  new: { glyph: "✉", labelKey: "support.admin.status.new", className: "border-border text-muted-foreground" },
  in_progress: {
    glyph: "▶",
    labelKey: "support.admin.status.inProgress",
    className: "border-[#B8863B] text-[#8a6420]",
  },
  resolved: {
    glyph: "✓",
    labelKey: "support.admin.status.resolved",
    className: "border-[#3f7d4f] text-[#2f6b3f]",
  },
};

export function TicketStatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  const t = useT();
  // Không có giá trị nào ngoài 3 trạng thái cố định thực sự tới được đây (AC-028
  // DB default 'new'), nhưng fallback về 'new' thay vì render trống — mirror
  // StatusBadge's `CONFIG[status] ?? CONFIG.processing` convention.
  const cfg = CONFIG[status] ?? CONFIG.new;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        cfg.className,
        className
      )}
    >
      <span aria-hidden>{cfg.glyph}</span>
      {t(cfg.labelKey)}
    </span>
  );
}
