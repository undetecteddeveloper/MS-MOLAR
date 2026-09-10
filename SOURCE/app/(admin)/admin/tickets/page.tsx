// User Support System v1 — /admin/tickets (backend Design Doc v1.2).
// Server Component: guard riêng theo allowlist (layout của nhóm chỉ dựng khung,
// không phải cổng) + đọc batched qua listSupportTickets(), prop-drill xuống
// TicketQueueList — Server Component prop passing, không client fetch riêng.
//
// Theme "Sân trường" (2026-09-10): khung do (admin)/layout.tsx cấp; PageHeader
// chuẩn + một câu nói hộp thư này chứa gì, thay tiêu đề `sr-only`.

import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { isAdminUserId } from "@/lib/auth/admin";
import { t } from "@/lib/copy";
import { listSupportTickets } from "@/lib/supabase/service-role";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { TicketQueueList } from "@/features/admin/components/tickets/TicketQueueList";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage() {
  const user = await getCurrentUser();
  if (!user || !isAdminUserId(user.id)) notFound();

  const tickets = await listSupportTickets();

  return (
    <PageContainer
      as="main"
      size="default"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      <PageHeader title={t("support.admin.title")} description={t("support.admin.intro")} />
      <TicketQueueList tickets={tickets} />
    </PageContainer>
  );
}
