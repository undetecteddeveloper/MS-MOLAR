// /me/orders — đơn hàng của tôi. Cần đăng nhập; chốt chạy TRƯỚC mọi lượt đọc.
//
// Nằm trong nhóm (billing) vì AppShell ở đây mount EntitlementProvider — ngoài
// provider, PlanSummary lặng lẽ hiện dữ liệu Free cho cả người dùng Premium.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { t } from "@/lib/copy";
import { listMyOrders } from "@/features/billing/queries";
import { OrderList } from "@/features/billing/components/orders/OrderList";
import { PlanSummary } from "@/features/billing/components/orders/PlanSummary";

export const metadata: Metadata = { title: "Đơn hàng của tôi" };

export default async function MyOrdersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin");

  const orders = await listMyOrders();

  return (
    <PageContainer
      as="main"
      size="default"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      <PageHeader
        title={t("billing.orders.title")}
        actions={
          <Link href="/pricing" className={buttonVariants({ variant: "secondary", size: "sm" })}>
            {t("billing.quota.upgradeLink")}
          </Link>
        }
      />
      <PlanSummary />
      <OrderList orders={orders} />
    </PageContainer>
  );
}
