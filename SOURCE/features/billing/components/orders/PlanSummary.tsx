"use client";

// Gói hiện tại + hạn mức còn lại, trên đầu /me/orders. Đọc `useEntitlement()`
// — provider mount ở AppShell của nhóm (billing).
//
// Hạn mức chỉ hiện khi CẢ HAI `known`. Nhánh `unknown` là hỏng-MỞ (máy chủ
// không chặn gì), nên KHÔNG in "0" hay "—" — một người đang trả tiền sẽ hiểu
// thành "hết hạn mức".

import { Card } from "@/components/ui/card";
import { useEntitlement } from "@/lib/billing/entitlement";
import type { Entitlement } from "@/lib/billing/types";
import { t } from "@/lib/copy";
import { formatDate } from "@/lib/format/datetime";

type Item = { term: string; value: string };

function planValue({ plan, expiresAt, inGracePeriod }: Entitlement): string {
  if (plan === "free") return t("billing.plan.free.name");
  if (expiresAt === null) return t("billing.plan.premium.name");
  const date = formatDate(expiresAt);
  return inGracePeriod
    ? t("billing.orders.planPremiumGrace", { date })
    : t("billing.orders.planPremiumUntil", { date });
}

/** Số lượt CÒN LẠI, kẹp ở 0 khi hạn mức bị hạ giữa kỳ. */
function remaining(used: number, limit: number): number {
  return Math.max(0, limit - used);
}

export function PlanSummary() {
  const entitlement = useEntitlement();
  const { tutor, upload } = entitlement;

  const quotaItems: Item[] | null =
    tutor.state === "known" && upload.state === "known"
      ? [
          { term: t("billing.orders.resetLabel"), value: formatDate(tutor.resetsAt) },
          {
            term: t("billing.orders.tutorLabel"),
            value: t("billing.orders.tutorRemaining", {
              count: remaining(tutor.used, tutor.limit),
              limit: tutor.limit,
            }),
          },
          {
            term: t("billing.orders.uploadLabel"),
            value: t("billing.orders.uploadRemaining", {
              count: remaining(upload.used, upload.limit),
              limit: upload.limit,
            }),
          },
        ]
      : null;

  const items: Item[] = [
    { term: t("billing.orders.planLabel"), value: planValue(entitlement) },
    ...(quotaItems ?? []),
  ];

  return (
    <Card as="section" className="gap-4">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.term} className="flex min-w-0 flex-col gap-0.5">
            <dt className="eyebrow">{item.term}</dt>
            <dd className="text-foreground text-base font-medium">{item.value}</dd>
          </div>
        ))}
      </dl>
      {quotaItems === null && (
        <p className="text-muted-foreground text-sm">{t("billing.quota.unavailable")}</p>
      )}
    </Card>
  );
}
