// /pricing — bảng giá. Cần đăng nhập (không nằm trong PUBLIC_PATHS).
//
// `force-dynamic` bắt buộc: `isPaidTierEnabled()` đọc env lúc render; prerender
// lúc build sẽ đông cứng giá trị cờ tới lần deploy sau.

import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { LegalLinks } from "@/components/billing/LegalLinks";
import { isPaidTierEnabled } from "@/lib/billing/paidTier";
import { t } from "@/lib/copy";
import { PlanComparison } from "@/features/billing/components/pricing/PlanComparison";
import { PurchaseCta } from "@/features/billing/components/pricing/PurchaseCta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bảng giá" };

export default async function PricingPage() {
  const canPurchase = isPaidTierEnabled();

  return (
    <PageContainer
      as="main"
      size="default"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      <PageHeader
        eyebrow={t("billing.pricing.eyebrow")}
        title={t("billing.pricing.title")}
        description={t("billing.pricing.description")}
      />

      <PlanComparison
        premiumFooter={
          <>
            {/* Liên kết pháp lý đứng TRƯỚC nút mua trong DOM (AC-039). */}
            <LegalLinks />
            <PurchaseCta canPurchase={canPurchase} />
          </>
        }
      />

      {/* Gói trả trước, không tự gia hạn — kỳ vọng dễ hiểu sai nhất (AC-040). */}
      <Card variant="outline" padding="compact" className="border-dashed">
        <p className="text-muted-foreground text-sm leading-relaxed">{t("billing.noAutoRenew")}</p>
      </Card>
    </PageContainer>
  );
}
