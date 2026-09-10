"use client";

// TicketQueueList — danh sách ticket, most-recent-first (đã sắp ở
// listSupportTickets, AC-041) — không phân trang ở v1 (khối lượng PRD giả định).
//
// Theme "Sân trường" (2026-09-10): trạng thái rỗng là thẻ nét đứt căn giữa
// (cùng lối với Lịch sử); có dữ liệu thì một cột thẻ, mỗi thẻ là một <li>.

import { t } from "@/lib/copy";
import type { TicketWithNotes } from "@/lib/supabase/service-role";
import { Card } from "@/components/ui/card";
import { TicketQueueRow } from "@/features/admin/components/tickets/TicketQueueRow";

export function TicketQueueList({ tickets }: { tickets: TicketWithNotes[] }) {
  if (tickets.length === 0) {
    return (
      <Card variant="outline" className="items-center border-dashed py-8 text-center">
        <p className="text-muted-foreground text-sm">{t("support.admin.empty")}</p>
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {tickets.map((ticket) => (
        <TicketQueueRow key={ticket.id} ticket={ticket} />
      ))}
    </ul>
  );
}
