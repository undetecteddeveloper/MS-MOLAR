"use client";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";

// RateButton — điều khiển "Chấm điểm" trên mỗi ExamCard (Rating System, R4). LÀ
// sibling của Link thẻ đề (stretched-link) — KHÔNG lồng bên trong Link để tránh
// interactive-trong-interactive không hợp lệ. 3 trạng thái: "eligible" (Link
// đến /exams/[id]/rate); "not-attempted"/"logged-out" (focusable aria-disabled,
// KHÔNG native disabled — vẫn nhận focus/tooltip; lý do lộ cho AT qua
// aria-describedby, AC-011/026). `relative z-10` để nhận click độc lập, không
// bị Link stretched đè lên (ExamCard.tsx).

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

// h-9 + min-w cho vùng chạm; đặt cạnh nút "Làm đề" cùng cỡ trong ExamCard.
const RATE_BUTTON_CLASS =
  "relative z-10 inline-flex h-9 items-center rounded-full px-3 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none";

export function RateButton({ examId, eligibility }: RateButtonProps) {
  if (eligibility === "eligible") {
    return (
      <Link
        href={`/exams/${examId}/rate`}
        className={`${RATE_BUTTON_CLASS} text-primary hover:bg-background`}
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
        className={`${RATE_BUTTON_CLASS} text-muted-foreground cursor-default`}
      >
        {t("rating.rate")}
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
      {/* Fallback AT-exposed lý do — luôn có trong DOM ngay cả khi tooltip
          base-ui không hiện lúc focus. */}
      <span id={reasonId} className="sr-only">
        {reason}
      </span>
    </Tooltip>
  );
}
