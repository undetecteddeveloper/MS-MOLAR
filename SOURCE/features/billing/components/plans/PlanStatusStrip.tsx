"use client";

// Dải mỏng đầu tab Gói: "Gói đang dùng" + tên gói (kèm hạn nếu là Premium) và, bên
// phải, hai con số hạn mức của gói đó theo kỳ. Đọc `useEntitlement()` — provider
// mount ở AppShell của nhóm (analytics). Người Premium có viền nhấn để phân biệt
// với dải Miễn phí; thẻ mua bên dưới là thứ DUY NHẤT còn lại để bấm.

import { Card } from "@/components/ui/card";
import { useEntitlement } from "@/lib/billing/entitlement";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { planLabel } from "@/features/billing/lib/planLabel";

export function PlanStatusStrip() {
  const entitlement = useEntitlement();
  const premium = entitlement.plan === "premium";

  return (
    <Card
      as="section"
      aria-label={t("billing.plan.current")}
      className={cn(
        "gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        premium && "ring-primary ring-2"
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="eyebrow">{t("billing.plan.current")}</span>
        <span className="text-foreground text-xl font-semibold">{planLabel(entitlement)}</span>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed sm:text-right">
        {t(premium ? "billing.plan.premium.summary" : "billing.plan.free.summary")}
      </p>
    </Card>
  );
}
