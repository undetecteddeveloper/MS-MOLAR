"use client";

// Thẻ mua của tab Gói. Người Miễn phí: thẻ Premium đủ giá + quyền lợi. Người Premium
// (kể cả đang ân hạn): thẻ gia hạn gọn với nút "Gia hạn thêm 30 ngày" (2026-10-21,
// người dùng chốt giữ nút gia hạn và đổi nhãn; bỏ tiêu đề "Mua thêm 30 ngày").
//
// BỐ CỤC là lưới, không phải cột lồng cột, vì cặp link Điều khoản/Hoàn tiền phải ở
// hai chỗ khác nhau theo cỡ màn hình mà DOM chỉ có MỘT bản: điện thoại — nằm DƯỚI nút
// mua, căn giữa; từ `md` — góc trên phải. Trong DOM nó vẫn đứng TRƯỚC nút mua (AC-039);
// thứ tự nhìn thấy trên điện thoại đổi bằng `order-*`.

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
    // một dòng giá + cộng dồn, rồi nút. Không viền nhấn — viền thuộc về dải gói đang
    // dùng. Người đang ân hạn cũng vào nhánh này.
    return (
      <Card
        as="section"
        aria-label={t("billing.cta.renew")}
        className="grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <p className="text-muted-foreground order-1 text-sm leading-relaxed md:col-start-1 md:row-span-2 md:row-start-1 md:self-center">
          {t("billing.plan.renewBody")}
        </p>
        <div className="order-3 text-center md:col-start-2 md:row-start-1 md:text-left">
          <LegalLinks intro={false} />
        </div>
        <div className="order-2 md:col-start-2 md:row-start-2">
          <PurchaseCta canPurchase={canPurchase} label="billing.cta.renew" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      as="section"
      aria-labelledby="plan-purchase-title"
      className="ring-primary grid grid-cols-1 gap-x-8 gap-y-4 ring-2 md:grid-cols-[minmax(0,1fr)_16rem]"
    >
      <h2
        id="plan-purchase-title"
        className="order-1 text-lg font-semibold md:col-start-1 md:row-start-1"
      >
        {t("billing.plan.premium.name")}
      </h2>

      <div className="order-4 text-center md:col-start-2 md:row-start-1 md:text-right">
        <LegalLinks intro={false} />
      </div>

      <div className="order-2 flex min-w-0 flex-col gap-4 md:col-start-1 md:row-span-2 md:row-start-2">
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

      <div className="order-3 md:col-start-2 md:row-start-2">
        <PurchaseCta canPurchase={canPurchase} />
      </div>

      <p className="text-muted-foreground order-5 text-sm leading-relaxed md:col-start-2 md:row-start-3">
        {t("billing.noAutoRenew")}
      </p>
    </Card>
  );
}
