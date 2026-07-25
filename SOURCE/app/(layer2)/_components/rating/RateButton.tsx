"use client";

// RateButton — điều khiển "Rate" trên mỗi ExamCard (Rating System, R4). LÀ
// sibling của Link thẻ đề (stretched-link restructure, code:F1) — KHÔNG lồng
// bên trong Link để tránh interactive-trong-interactive không hợp lệ. 3 trạng
// thái: "eligible" (Link đến /exams/[id]/rate); "not-attempted"/"logged-out"
// (focusable aria-disabled, KHÔNG native disabled — vẫn nhận focus/tooltip;
// lý do lộ cho AT qua aria-describedby, AC-011/026). relative z-10 (tự thân)
// để nhận click độc lập, không bị Link stretched (after:inset-0, z-index auto)
// đè lên (ExamCard.tsx).

import Link from "next/link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type RateEligibility = "eligible" | "not-attempted" | "logged-out";

const DISABLED_REASON: Record<Exclude<RateEligibility, "eligible">, string> = {
  "not-attempted": "Finish this exam first",
  "logged-out": "Log in to rate",
};

interface RateButtonProps {
  examId: string;
  eligibility: RateEligibility;
}

const RATE_BUTTON_CLASS =
  "relative z-10 text-xs font-medium uppercase tracking-[0.14em] transition-opacity";

export function RateButton({ examId, eligibility }: RateButtonProps) {
  if (eligibility === "eligible") {
    return (
      <Link
        href={`/exams/${examId}/rate`}
        className={`${RATE_BUTTON_CLASS} text-[var(--sidebar-accent)] hover:opacity-80`}
      >
        Rate →
      </Link>
    );
  }

  const reasonId = `rate-reason-${examId}`;
  const reason = DISABLED_REASON[eligibility];

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-disabled="true"
        aria-describedby={reasonId}
        className={`${RATE_BUTTON_CLASS} cursor-default text-muted-foreground hover:opacity-100`}
      >
        Rate →
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
