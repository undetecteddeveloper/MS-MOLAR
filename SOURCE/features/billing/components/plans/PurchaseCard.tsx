"use client";

// Thẻ Premium của tab Gói — CHỈ cho người đang ở gói Miễn phí. Người Premium không
// thấy thẻ này (2026-10-21, người dùng bỏ "Mua thêm 30 ngày"): với họ tab chỉ còn
// dải gói đang dùng và Lịch sử mua.
//
// Cặp link Điều khoản / Hoàn tiền nằm ở GÓC TRÊN PHẢI, cùng hàng với tên gói, cho
// khỏi để trống cột phải; hàng đó đứng trước nút mua trong DOM nên AC-039 vẫn đúng.

import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LegalLinks } from "@/components/billing/LegalLinks";
import { useEntitlement } from "@/lib/billing/entitlement";
import { t, type MessageKey } from "@/lib/copy";
import { PurchaseCta } from "@/features/billing/components/pricing/PurchaseCta";

const PREMIUM_LINES: MessageKey[] = [
  "billing.plan.premium.line1",
  "billing.plan.premium.line2",
  "billing.plan.premium.line3",
];

export function PurchaseCard({ canPurchase }: { canPurchase: boolean }) {
  const { plan } = useEntitlement();
  if (plan === "premium") return null;

  return (
    <Card as="section" aria-labelledby="plan-purchase-title" className="ring-primary gap-5 ring-2">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <h2 id="plan-purchase-title" className="text-lg font-semibold">
          {t("billing.plan.premium.name")}
        </h2>
        <LegalLinks intro={false} />
      </div>

      <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <p className="text-3xl font-bold tabular-nums">{t("billing.plan.premium.price")}</p>
            <p className="text-muted-foreground mt-1 text-sm">{t("billing.plan.premium.period")}</p>
          </div>
          <ul className="flex flex-col gap-2.5">
            {PREMIUM_LINES.map((key) => (
              <li key={key} className="flex items-start gap-2 text-sm leading-relaxed">
                <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 md:w-64 md:shrink-0">
          <PurchaseCta canPurchase={canPurchase} />
          <p className="text-muted-foreground text-sm leading-relaxed">{t("billing.noAutoRenew")}</p>
        </div>
      </div>
    </Card>
  );
}
