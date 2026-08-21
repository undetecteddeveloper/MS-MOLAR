// User Support System v1 — /admin/tickets (backend Design Doc v1.2).
// Server Component: guard riêng (không có layout.tsx chung cho (admin)) +
// đọc batched qua listSupportTickets(), prop-drill xuống TicketQueueList
// (task-14) — Server Component prop passing, không client fetch riêng
// (frontend DD Integration Point Map "Admin read").

import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { isAdminUserId } from "@/lib/auth/admin";
import { getTranslate } from "@/lib/i18n/server";
import { listSupportTickets } from "@/lib/supabase/service-role";
import { PageContainer } from "@/components/layout/PageContainer";
import { TicketQueueList } from "./TicketQueueList";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  const user = await getCurrentUser();
  if (!user || !isAdminUserId(user.id)) notFound();

  const t = await getTranslate();
  const tickets = await listSupportTickets();

  return (
    <div className="bg-background min-h-dvh">
      <PageContainer as="main" size="default" className="flex flex-col gap-6">
        <h1 className="sr-only">{t("support.admin.title")}</h1>
        <TicketQueueList tickets={tickets} />
      </PageContainer>
    </div>
  );
}
