// TicketDetailPanel — nội dung mở rộng của một ticket (R12/UI-D4, AC-037/038,
// AC-014 — đóng document review finding I002).
//
// ⚠ AN TOÀN: message/pageUrl/userAgent là NỘI DUNG NGƯỜI DÙNG CHƯA TIN CẬY.
// CHỈ render qua <p className="whitespace-pre-wrap"> (text thuần, escaped tự
// động bởi React) — KHÔNG BAO GIỜ RichText, KHÔNG BAO GIỜ dangerouslySetInnerHTML.
// Screenshot CHỈ qua <img src=...> — không đi qua bất kỳ pipeline diễn giải
// markup nào. Đây là chỗ một sản phẩm dành cho học sinh dễ bị XSS nhất nếu
// đổi sai — xem lại proof obligation trước khi sửa file này.

import type { TicketWithNotes } from "@/lib/supabase/service-role";
import { t } from "@/lib/copy";
import { TicketStatusControl } from "@/features/admin/components/tickets/TicketStatusControl";
import { InternalNotesPanel } from "@/features/admin/components/tickets/InternalNotesPanel";

export function TicketDetailPanel({ ticket }: { ticket: TicketWithNotes }) {
  return (
    <div className="border-border mt-3 border-t pt-3">
      <p className="whitespace-pre-wrap text-sm">{ticket.message}</p>

      <dl className="text-muted-foreground mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-xs">
        <dt>{t("support.admin.meta.page")}</dt>
        <dd className="whitespace-pre-wrap break-all">{ticket.pageUrl ?? "—"}</dd>
        <dt>{t("support.admin.meta.userAgent")}</dt>
        <dd className="whitespace-pre-wrap break-all">{ticket.userAgent ?? "—"}</dd>
        <dt>{t("support.admin.meta.screen")}</dt>
        <dd>
          {ticket.screenWidth ?? "?"}×{ticket.screenHeight ?? "?"}
        </dd>
      </dl>

      {ticket.screenshotUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, không phải asset tĩnh của Next Image
        <img
          src={ticket.screenshotUrl}
          alt={t("support.admin.screenshotAlt")}
          className="border-border mt-3 max-h-80 rounded-md border object-contain"
        />
      )}

      <div className="mt-4">
        <TicketStatusControl ticketId={ticket.id} status={ticket.status} />
      </div>

      <InternalNotesPanel ticketId={ticket.id} notes={ticket.notes} />
    </div>
  );
}
