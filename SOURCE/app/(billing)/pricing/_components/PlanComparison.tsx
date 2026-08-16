"use client";

// PlanComparison — UI Spec C-02. Hai thẻ gói, Free và Premium.
//
// Đọc `useEntitlement()` để đánh dấu gói hiện tại, nên phải là client component;
// mọi thứ khác trong thẻ là hằng số.

import { Check } from "lucide-react";
import { BentoCell } from "@/components/layout/BentoGrid";
import { useEntitlement } from "@/lib/billing/entitlement";
import type { Plan } from "@/lib/billing/types";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";

type PlanCard = {
  plan: Plan;
  nameKey: MessageKey;
  priceKey: MessageKey;
  periodKey: MessageKey;
  lineKeys: MessageKey[];
};

// Đúng HAI gói và đúng MỘT mức giá (PRD D2/AC-002). Bốn dòng mỗi thẻ là TRẦN,
// không phải gợi ý: chỉ số định tính #3 của PRD đòi trang đọc được trong một
// lần nhìn — "hai cột, một giá, mỗi dòng khác biệt là một câu người dùng hiểu
// được", và nói thẳng là KHÔNG có bảng so sánh 20 dòng.
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

export function PlanComparison() {
  const t = useT();
  const { plan: currentPlan } = useEntitlement();

  return (
    // Lưới 12 cột từ `md:` chứ không phải `sm:` — globals.css:212-218 quy định
    // mọi lằn ranh QUYẾT ĐỊNH BỐ CỤC phải là `md:` (768px), `sm:` (640px) chỉ
    // còn hợp lệ cho cỡ chữ/khoảng cách. Hai thẻ gói cạnh nhau ở 640px trên máy
    // 360px-class sẽ còn ~300px mỗi thẻ để chứa giá + 4 dòng + nút.
    //
    // Không dùng chính <BentoGrid>: nó hardcode `sm:grid-cols-12`, mà truyền
    // thêm class `md:grid-cols-12` không huỷ được class cũ (khác breakpoint nên
    // twMerge giữ cả hai). Chỉ khung lưới tự viết; <BentoCell> — thứ thật sự
    // đáng tái dùng, và là thứ UI Spec Engine 1 D2 cấm dựng lại — vẫn giữ.
    <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
      {PLANS.map((card) => {
        const isCurrent = card.plan === currentPlan;
        return (
          <BentoCell
            key={card.plan}
            as="section"
            span="half"
            aria-labelledby={`plan-${card.plan}-name`}
            className={cn(
              // Nhấn mạnh bằng VIỀN 2px, không bằng đổ bóng hay nền đỏ:
              // globals.css:72-73 cấm shadow/gradient, và .claude/MEMORY.md:103
              // cấm đỏ son phủ khối lớn.
              card.plan === "premium" && "border-brand border-2"
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 id={`plan-${card.plan}-name`} className="font-serif text-xl">
                {t(card.nameKey)}
              </h2>
              {isCurrent && (
                <span className="eyebrow shrink-0">{t("billing.plan.current")}</span>
              )}
            </div>

            {/* Giá là TEXT LỚN nên phải là `foreground` trên nền ngà, không bao
                giờ là một khối đỏ son (.claude/MEMORY.md:103; PRD :383 áp đúng
                quy tắc này cho đúng phần tử này). */}
            <p className="text-foreground mt-3 font-serif text-3xl">{t(card.priceKey)}</p>
            <p className="text-muted-foreground mt-1 text-sm">{t(card.periodKey)}</p>

            <ul className="mt-4 flex flex-col gap-2">
              {card.lineKeys.map((key) => (
                <li key={key} className="flex items-start gap-2 text-sm leading-relaxed">
                  <Check className="text-brand mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{t(key)}</span>
                </li>
              ))}
            </ul>
          </BentoCell>
        );
      })}
    </div>
  );
}
