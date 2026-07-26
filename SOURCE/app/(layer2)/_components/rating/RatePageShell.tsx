"use client";

// RatePageShell — chrome trang độc lập /exams/[id]/rate (Rating System, UI
// Spec Component: RatePageShell). Bordered ivory main block bọc RatingForm
// (layout="page") — content area của khối này LÀ đích bubble-expand mà
// RatingForm tự thực hiện khi layout="page" (xem RatingForm.tsx). Wire
// submitRating(examId, scores) làm onSubmit — đúng ranh giới server-action
// (submitRating.ts). .preload-fade mount theo convention S#21.

import type { PartId, PartScore } from "@/lib/rating";
import { RatingForm } from "./RatingForm";
import { submitRating } from "./submitRating";

interface RatePageShellProps {
  examId: string;
  initialScores?: Partial<Record<PartId, PartScore>>;
}

export function RatePageShell({ examId, initialScores }: RatePageShellProps) {
  return (
    <main className="bg-background mx-auto flex w-full max-w-2xl flex-col px-6 py-10">
      <div
        className="preload-fade border-border overflow-hidden rounded-lg border bg-[var(--card)]"
        style={{ "--preload-order": 1 } as React.CSSProperties}
      >
        <RatingForm
          examId={examId}
          layout="page"
          initialScores={initialScores}
          onSubmit={(scores) => submitRating(examId, scores)}
        />
      </div>
    </main>
  );
}
