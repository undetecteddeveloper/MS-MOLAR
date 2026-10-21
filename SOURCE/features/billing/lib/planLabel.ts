// Nhãn một dòng của gói người dùng đang dùng ("Miễn phí", "Premium · đến 19/11/2026").
// Dùng chung cho dải "Gói đang dùng" (tab Gói) và huy hiệu của bảng Hạn mức (tab
// Tài khoản) để hai nơi không thể nói hai câu khác nhau về cùng một gói.

import type { Entitlement } from "@/lib/billing/types";
import { t } from "@/lib/copy";
import { formatDate } from "@/lib/format/datetime";

export function planLabel({ plan, expiresAt, inGracePeriod }: Entitlement): string {
  if (plan === "free") return t("billing.plan.free.name");
  if (expiresAt === null) return t("billing.plan.premium.name");
  const date = formatDate(expiresAt);
  return inGracePeriod
    ? t("billing.orders.planPremiumGrace", { date })
    : t("billing.orders.planPremiumUntil", { date });
}
