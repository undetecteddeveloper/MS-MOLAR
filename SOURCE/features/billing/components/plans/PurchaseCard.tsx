"use client";

// Thẻ mua của tab Gói. Người Miễn phí: thẻ Premium đủ giá + quyền lợi. Người Premium
// (kể cả đang ân hạn): thẻ gia hạn gọn với nút "Gia hạn thêm 30 ngày" (2026-10-21,
// người dùng chốt giữ nút gia hạn và đổi nhãn; bỏ tiêu đề "Mua thêm 30 ngày").
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

  if (plan === "premium") {
    // Thẻ gia hạn gọn: không tiêu đề (dải "Gói đang dùng" bên trên đã nói gói nào),
    // một dòng giá + cộng dồn, cặp link pháp lý góc trên phải rồi tới nút. Không viền
    // nhấn — viền thuộc về dải gói đang dùng. Người đang ân hạn cũng vào nhánh này.
    return (
      <Card
        as="section"
        aria-label={t("billing.cta.renew")}
        className="gap-3 md:flex-row md:items-center md:justify-between md:gap-8"
      >
        <p className="text-muted-foreground text-sm leading-relaxed">
          {t("billing.plan.renewBody")}
        </p>
        <div className="flex flex-col gap-3 md:w-80 md:shrink-0 md:text-left">
          <LegalLinks intro={false} />
          <PurchaseCta canPurchase={canPurchase} label="billing.cta.renew" />
        </div>
      </Card>
    );
  }

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
