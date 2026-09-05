"use client";

// TicketQueueList — danh sách ticket, most-recent-first (đã sắp ở
// listSupportTickets, AC-041) — không phân trang ở v1 (khối lượng PRD giả định).

import { t } from "@/lib/copy";
import type { TicketWithNotes } from "@/lib/supabase/service-role";
import { TicketQueueRow } from "@/features/admin/components/tickets/TicketQueueRow";

export function TicketQueueList({ tickets }: { tickets: TicketWithNotes[] }) {

  if (tickets.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("support.admin.empty")}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {tickets.map((ticket) => (
        <TicketQueueRow key={ticket.id} ticket={ticket} />
      ))}
    </div>
  );
}
