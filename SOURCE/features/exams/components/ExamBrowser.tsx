// ExamBrowser — danh sách đề trong Exam Browser (Layer 2).
// Lưới ExamCard responsive: 1 cột (mobile) → 2 (sm) → 3 (lg) với gap đều
// (S#19 — container /exams nới max-w-6xl để đủ chỗ 3 card/hàng). Empty state
// khi lọc không ra kết quả. Lọc do ExamFilters (overlay) đảm nhiệm.
// Rating System (R4, NFR Performance): tính eligibility per-card TẠI ĐÂY, từ
// MỘT set submittedExamIds + isLoggedIn nhận từ ExamsPage — KHÔNG per-card
// fetch (Minimal Surface Alternatives Element 1, frontend DD).

import { getTranslate } from "@/lib/i18n/server";
import type { Exam } from "@/types/exam";
import { ExamCard } from "@/features/exams/components/ExamCard";
import type { RateEligibility } from "@/features/exams/components/rating/RateButton";

interface ExamBrowserProps {
  exams: Exam[];
  submittedExamIds: Set<string>;
  isLoggedIn: boolean;
}

export async function ExamBrowser({ exams, submittedExamIds, isLoggedIn }: ExamBrowserProps) {
  const t = await getTranslate();
  if (exams.length === 0) {
    return (
      <div className="border-border flex min-h-50 flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-16 text-center">
        <p className="text-foreground font-serif text-lg">{t("exams.noMatch")}</p>
        <p className="text-muted-foreground text-sm">{t("exams.noMatchHint")}</p>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
