"use client";

// Hai thẻ gói Free / Premium, đặt cạnh nhau từ `md:`. Premium là thẻ nổi (viền
// xanh) và chứa luôn liên kết pháp lý + nút mua, để hành động nằm ngay cạnh
// thứ người dùng đang cân nhắc. Client component vì đọc `useEntitlement()`.

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useEntitlement } from "@/lib/billing/entitlement";
import type { Plan } from "@/lib/billing/types";
import { t, type MessageKey } from "@/lib/copy";
import { cn } from "@/lib/utils";

type PlanCard = {
  plan: Plan;
  nameKey: MessageKey;
  priceKey: MessageKey;
  periodKey: MessageKey;
  lineKeys: MessageKey[];
};

const PLANS: PlanCard[] = [
  {
    plan: "free",
    nameKey: "billing.plan.free.name",
    priceKey: "billing.plan.free.price",
    periodKey: "billing.plan.free.period",
    lineKeys: [
      "billing.plan.free.line1",
      "billing.plan.free.line2",
      "billing.plan.free.line3",
      "billing.plan.free.line4",
    ],
  },
  {
    plan: "premium",
    nameKey: "billing.plan.premium.name",
    priceKey: "billing.plan.premium.price",
    periodKey: "billing.plan.premium.period",
    lineKeys: [
      "billing.plan.premium.line1",
      "billing.plan.premium.line2",
      "billing.plan.premium.line3",
      "billing.plan.premium.line4",
    ],
  },
];

export function PlanComparison({ premiumFooter }: { premiumFooter: React.ReactNode }) {
  const { plan: currentPlan } = useEntitlement();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {PLANS.map((card) => {
        const premium = card.plan === "premium";
        return (
          <Card
            key={card.plan}
            as="section"
            variant={premium ? "plain" : "tint"}
            aria-labelledby={`plan-${card.plan}-name`}
            className={cn("gap-5", premium && "ring-primary ring-2")}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id={`plan-${card.plan}-name`} className="text-lg font-semibold">
                {t(card.nameKey)}
              </h2>
              {card.plan === currentPlan && (
                <Badge variant={premium ? "success" : "muted"}>{t("billing.plan.current")}</Badge>
              )}
            </div>

            <div>
              <p className="text-3xl font-bold tabular-nums">{t(card.priceKey)}</p>
              <p className="text-muted-foreground mt-1 text-sm">{t(card.periodKey)}</p>
            </div>

            <ul className="flex flex-col gap-2.5">
              {card.lineKeys.map((key) => (
                <li key={key} className="flex items-start gap-2 text-sm leading-relaxed">
                  <Check className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>

            {premium && <div className="mt-auto flex flex-col gap-3 pt-1">{premiumFooter}</div>}
          </Card>
        );
      })}
    </div>
  );
}
