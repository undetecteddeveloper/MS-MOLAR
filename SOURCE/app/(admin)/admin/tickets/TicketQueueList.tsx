"use client";

// TicketQueueList — danh sách ticket, most-recent-first (đã sắp ở
// listSupportTickets, AC-041) — không phân trang ở v1 (khối lượng PRD giả định).

import { useT } from "@/lib/i18n/client";
import type { TicketWithNotes } from "@/lib/supabase/service-role";
import { TicketQueueRow } from "./TicketQueueRow";

export function TicketQueueList({ tickets }: { tickets: TicketWithNotes[] }) {
  const t = useT();

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
