"use client";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";

// RateButton — điều khiển "Rate" trên mỗi ExamCard (Rating System, R4). LÀ
// sibling của Link thẻ đề (stretched-link restructure, code:F1) — KHÔNG lồng
// bên trong Link để tránh interactive-trong-interactive không hợp lệ. 3 trạng
// thái: "eligible" (Link đến /exams/[id]/rate); "not-attempted"/"logged-out"
// (focusable aria-disabled, KHÔNG native disabled — vẫn nhận focus/tooltip;
// lý do lộ cho AT qua aria-describedby, AC-011/026). relative z-10 (tự thân)
// để nhận click độc lập, không bị Link stretched (after:inset-0, z-index auto)
// đè lên (ExamCard.tsx).
//
// Task 9-frontend axe/manual a11y audit finding (WCAG 1.4.3, AA): the enabled
// state renders on ExamCard's ivory `--block-bg`/`--card` (#ede1c8), where
// literal copper (`--sidebar-accent` #b8863b, the token frontend DD code:F3
// otherwise reserves for "{t("rating.rate")}") measures ~2.49:1 — far under the 4.5:1
// normal-text floor (worse still with the previous `hover:opacity-80` dim,
// ~3.87:1). Copper only clears AA against the DARK `--sidebar` surfaces it is
// used on elsewhere (PartCard/PartDetail/CircleScale, ~5.3-5.6:1). Fixed here
// by reusing `--brand` (5.37:1 on ivory) — already this exact file tree's
// on-light interactive-text color (ExamCard's own title `group-hover:text-
// [var(--block-hover)]`, ExamFilters' "Clear" link, RatingModal's "Close"
// button), so no new design token is introduced.

import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type RateEligibility = "eligible" | "not-attempted" | "logged-out";

const DISABLED_REASON_KEY: Record<Exclude<RateEligibility, "eligible">, MessageKey> = {
  "not-attempted": "rating.finishExamFirst",
  "logged-out": "rating.logInToRate",
};

interface RateButtonProps {
  examId: string;
  eligibility: RateEligibility;
}

// `inline-flex min-h-11 items-center`: chữ 12px chỉ cao 16px, nên vùng chạm
// trước 2026-08-07 đo được 63×16px — dưới hẳn ngưỡng 44–48px mà tài liệu
// Mobile-Layout-Research-MS §4.3 đặt ra cho phần tử tương tác trên cảm ứng.
// Nới bằng CHIỀU CAO TỐI THIỂU chứ không phải padding: padding sẽ đẩy nút ra
// khỏi mép phải thẻ mà nó đang canh theo (`justify-end` ở ExamCard).
const RATE_BUTTON_CLASS =
  "relative z-10 inline-flex min-h-11 items-center text-xs font-medium uppercase tracking-[0.14em] transition-opacity";

export function RateButton({ examId, eligibility }: RateButtonProps) {
  const t = useT();
  if (eligibility === "eligible") {
    return (
      <Link
        href={`/exams/${examId}/rate`}
        className={`${RATE_BUTTON_CLASS} text-brand hover:underline`}
      >
        {t("rating.rate")}
      </Link>
    );
  }

  const reasonId = `rate-reason-${examId}`;
  const reason = t(DISABLED_REASON_KEY[eligibility]);

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-disabled="true"
        aria-describedby={reasonId}
        className={`${RATE_BUTTON_CLASS} text-muted-foreground cursor-default hover:opacity-100`}
      >
        {t("rating.rate")}
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
      {/* Fallback AT-exposed lý do (Risk R-3, frontend DD Assumed Behaviors) —
          luôn có trong DOM ngay cả khi tooltip base-ui không hiện lúc focus. */}
      <span id={reasonId} className="sr-only">
        {reason}
      </span>
    </Tooltip>
  );
}
