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
  /** `grid` (mặc định) = lưới 1→2→3 cột của /exams, thẻ ĐẦY ĐỦ. `stack` = một
   *  cột dọc cho trang chủ (cột hẹp cạnh hero khi có, dải "Đề nổi nhất" full-
   *  width khi đã đăng nhập) — LUÔN kéo theo thẻ GỌN (`compact`, cùng hình
   *  dạng `ExamShelf` dùng cho kệ cuộn ngang trên /exams), vì `stack` chỉ có
   *  ĐÚNG một nơi gọi (trang chủ) nên không cần một cờ `compact` tách rời chỉ
   *  để hai nơi gọi nhớ truyền cùng nhau (engineer 2026-09-30, phản hồi kèm
   *  ảnh chụp: thẻ đầy đủ trên trang chủ "không nhỏ gọn"). */
  layout?: "grid" | "stack";
  /** Từ khoá đang tìm (`?q=`, ADR-0020) — trạng thái rỗng nhắc lại đúng từ
   *  khoá để người dùng biết vì sao lưới trống. */
  query?: string;
}

export async function ExamBrowser({
  exams,
  submittedExamIds,
  isLoggedIn,
  layout = "grid",
  query,
}: ExamBrowserProps) {
  if (exams.length === 0) {
    return (
      <Card variant="outline" className="items-center justify-center gap-1 border-dashed py-14 text-center">
        <p className="text-foreground text-lg font-semibold">
          {query !== undefined ? t("exams.noSearchMatch", { query }) : t("exams.noMatch")}
        </p>
        <p className="text-muted-foreground text-sm">
          {query !== undefined ? t("exams.noSearchMatchHint") : t("exams.noMatchHint")}
        </p>
      </Card>
    );
  }

  const compact = layout === "stack";

  return (
    <ul
      className={
        compact ? "flex flex-col gap-3" : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      }
    >
      {exams.map((exam) => (
        <ExamCard
          key={exam.id}
          exam={exam}
          eligibility={eligibilityFor(exam.id, submittedExamIds, isLoggedIn)}
          compact={compact}
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
