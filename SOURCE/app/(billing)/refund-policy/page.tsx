// /refund-policy — công khai. Câu "không tự gia hạn" đứng đầu, trước thân văn
// bản, để đọc được mà không phải cuộn (AC-040).

import type { Metadata } from "next";
import { LegalDocument } from "@/components/billing/LegalDocument";
import { LegalProse } from "@/components/billing/LegalProse";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";

// Khai lại canonical: root layout mặc định `canonical: "/"`.
export const metadata: Metadata = {
  title: "Chính sách hoàn tiền",
  alternates: { canonical: "/refund-policy" },
};

export default async function RefundPolicyPage() {
  return (
    <LegalDocument title={t("billing.refund.title")}>
      <Card variant="sun" padding="compact">
        <p className="text-sm leading-relaxed font-medium">{t("billing.noAutoRenew")}</p>
      </Card>
      <LegalProse body={t("billing.refund.body")} />
    </LegalDocument>
  );
}
