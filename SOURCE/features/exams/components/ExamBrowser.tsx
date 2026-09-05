// ExamBrowser — lưới thẻ đề: 1 cột (mobile) → 2 (sm) → 3 (lg). Empty state khi
// lọc không ra kết quả. Lọc do ExamFilters đảm nhiệm.
// Rating System (R4, NFR Performance): tính eligibility per-card TẠI ĐÂY, từ
// MỘT tập submittedExamIds + isLoggedIn nhận từ trang — KHÔNG per-card fetch.

import { t } from "@/lib/copy";
import type { Exam } from "@/types/exam";
import { Card } from "@/components/ui/card";
import { ExamCard } from "@/features/exams/components/ExamCard";
import type { RateEligibility } from "@/features/exams/components/rating/RateButton";

interface ExamBrowserProps {
  exams: Exam[];
  submittedExamIds: Set<string>;
  isLoggedIn: boolean;
  /** `grid` (mặc định) = lưới 1→2→3 cột của /exams. `stack` = một cột dọc, cho
   *  cột hẹp bên phải hero ở trang chủ. */
  layout?: "grid" | "stack";
}

export async function ExamBrowser({
  exams,
  submittedExamIds,
  isLoggedIn,
  layout = "grid",
}: ExamBrowserProps) {
  if (exams.length === 0) {
    return (
      <Card variant="outline" className="items-center justify-center gap-1 border-dashed py-14 text-center">
        <p className="text-foreground text-lg font-semibold">{t("exams.noMatch")}</p>
        <p className="text-muted-foreground text-sm">{t("exams.noMatchHint")}</p>
      </Card>
    );
  }

  return (
    <ul
      className={
        layout === "stack"
          ? "flex flex-col gap-3"
          : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      }
    >
      {exams.map((exam) => (
        <ExamCard
          key={exam.id}
          exam={exam}
          eligibility={eligibilityFor(exam.id, submittedExamIds, isLoggedIn)}
        />
      ))}
    </ul>
  );
}

function eligibilityFor(
  examId: string,
  submittedExamIds: Set<string>,
  isLoggedIn: boolean
): RateEligibility {
  if (!isLoggedIn) return "logged-out";
  return submittedExamIds.has(examId) ? "eligible" : "not-attempted";
}
