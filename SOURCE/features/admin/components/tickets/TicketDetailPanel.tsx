// TicketDetailPanel — nội dung mở rộng của một ticket (R12/UI-D4, AC-037/038,
// AC-014 — đóng document review finding I002).
//
// ⚠ AN TOÀN: message/pageUrl/userAgent là NỘI DUNG NGƯỜI DÙNG CHƯA TIN CẬY.
// CHỈ render qua <p className="whitespace-pre-wrap"> (text thuần, escaped tự
// động bởi React) — KHÔNG BAO GIỜ RichText, KHÔNG BAO GIỜ dangerouslySetInnerHTML.
// Screenshot CHỈ qua <img src=...> — không đi qua bất kỳ pipeline diễn giải
// markup nào. Đây là chỗ một sản phẩm dành cho học sinh dễ bị XSS nhất nếu
// đổi sai — xem lại proof obligation trước khi sửa file này.
//
// Theme "Sân trường" (2026-09-10): mở ra bằng `.motion-unfold` dưới một kẻ
// chia; nội dung học sinh gõ nằm trong thẻ TRẮNG con (trắng trên surface tách
// rõ mà không cần viền); ba dòng meta nhãn tiếng Việt; ảnh trên nền trắng bo
// 14px thay viền.

import type { TicketWithNotes } from "@/lib/supabase/service-role";
import { t } from "@/lib/copy";
import { Card } from "@/components/ui/card";
import { TicketStatusControl } from "@/features/admin/components/tickets/TicketStatusControl";
import { InternalNotesPanel } from "@/features/admin/components/tickets/InternalNotesPanel";

export function TicketDetailPanel({ ticket, id }: { ticket: TicketWithNotes; id?: string }) {
  return (
    <div id={id} className="motion-unfold border-border mt-3 flex flex-col gap-4 border-t pt-3">
      <Card variant="plain" padding="compact">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.message}</p>
      </Card>

      <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt>{t("support.admin.meta.page")}</dt>
        <dd className="whitespace-pre-wrap break-all">{ticket.pageUrl ?? "—"}</dd>
        <dt>{t("support.admin.meta.userAgent")}</dt>
        <dd className="whitespace-pre-wrap break-all">{ticket.userAgent ?? "—"}</dd>
        <dt>{t("support.admin.meta.screen")}</dt>
        <dd className="tabular-nums">
          {ticket.screenWidth ?? "?"}×{ticket.screenHeight ?? "?"}
        </dd>
      </dl>

      {ticket.screenshotUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, không phải asset tĩnh của Next Image
        <img
          src={ticket.screenshotUrl}
          alt={t("support.admin.screenshotAlt")}
          className="bg-card max-h-80 self-start rounded-lg object-contain"
        />
      )}

      <TicketStatusControl ticketId={ticket.id} status={ticket.status} />

      <InternalNotesPanel ticketId={ticket.id} notes={ticket.notes} />
    </div>
  );
}
