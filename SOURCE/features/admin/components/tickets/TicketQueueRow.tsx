"use client";

// TicketQueueRow — thẻ thu gọn của một ticket + mở rộng lộ TicketDetailPanel.
// `expanded` là useState CỤC BỘ, KHÔNG persist (không URL param, không
// localStorage) — không có yêu cầu PRD/UI-Spec nào đòi trạng thái này sống
// qua reload.
//
// Theme "Sân trường" (2026-09-10): thẻ surface. Cả phần thu gọn là MỘT nút
// (tên khả truy cập = loại + trích đoạn + trạng thái + ngày): hàng nhãn (loại
// phản hồi, "Kèm ảnh", cờ email hỏng, trạng thái, ngày giờ Việt Nam) → trích
// đoạn một dòng + mũi tên. Ngày giờ qua bộ định dạng chung ghim
// Asia/Ho_Chi_Minh — bản trước dùng `toLocaleDateString()` theo giờ MÁY: máy
// chủ Vercel chạy UTC còn trình duyệt chạy giờ Việt Nam nên cùng một chuỗi ra
// hai giá trị (lệch hydration), đúng lỗi đã sửa ở Đề của tôi.

import { useId, useState } from "react";
import { ChevronDown, Paperclip } from "lucide-react";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import { formatDateTime } from "@/lib/format/datetime";
import type { TicketWithNotes } from "@/lib/supabase/service-role";
import type { TicketIntent } from "@/lib/support/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { TicketStatusBadge } from "@/features/admin/components/tickets/TicketStatusBadge";
import { NotificationFailureFlag } from "@/features/admin/components/tickets/NotificationFailureFlag";
import { TicketDetailPanel } from "@/features/admin/components/tickets/TicketDetailPanel";

const INTENT_LABEL_KEY: Record<TicketIntent, MessageKey> = {
  bug: "support.intent.bug",
  suggestion: "support.intent.suggestion",
  question: "support.intent.question",
};

export function TicketQueueRow({ ticket }: { ticket: TicketWithNotes }) {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  return (
    <Card as="li" padding="compact" className="gap-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="focus-visible:ring-ring/40 flex w-full flex-col gap-2 rounded-lg text-left focus-visible:ring-3 focus-visible:outline-none"
      >
        <span className="flex w-full flex-wrap items-center gap-1.5">
          <Badge variant="plain">{t(INTENT_LABEL_KEY[ticket.intent])}</Badge>
          {ticket.screenshotUrl && (
            <Badge variant="plain">
              <Paperclip aria-hidden />
              {t("support.admin.hasScreenshot")}
            </Badge>
          )}
          {ticket.notifyFailed && <NotificationFailureFlag />}
          <TicketStatusBadge status={ticket.status} />
          <span className="text-muted-foreground ml-auto text-xs whitespace-nowrap tabular-nums">
            {formatDateTime(ticket.createdAt)}
          </span>
        </span>
        <span className="flex w-full items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm">{ticket.message}</span>
          {/* Mũi tên lật khi mở — không transition (§7: chuyển động chỉ ở nơi
              nó nói điều gì; ở đây trạng thái đã nói bằng phần mở rộng). */}
          <ChevronDown
            aria-hidden
            className={cn("text-muted-foreground size-4 shrink-0", expanded && "rotate-180")}
          />
        </span>
      </button>

      {expanded && <TicketDetailPanel id={panelId} ticket={ticket} />}
    </Card>
  );
}
