import Link from "next/link";
import { t } from "@/lib/copy";
import type { Exam } from "@/types/exam";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AuthorByline } from "@/components/shared/AuthorByline";
import { DifficultyBadge } from "@/components/rating/DifficultyBadge";
import { RateButton, type RateEligibility } from "@/features/exams/components/rating/RateButton";
import { subjectLabel } from "@/lib/ugc/subjects";

interface ExamCardProps {
  exam: Exam;
  /** Rating System (R4) — 1 trong 3 trạng thái nút Chấm điểm, tính 1 lần/trang
   *  từ tập id đã nộp (ExamBrowser), KHÔNG per-card query (NFR Performance). */
  eligibility: RateEligibility;
}

// ExamCard — thẻ đề (theme "Sân trường"): nhãn môn + lớp, tên đề, tác giả,
// hàng meta (thời lượng, số câu, trường), độ khó, nút Chấm điểm + "Làm đề".
//
// Stretched link: Link phủ toàn thẻ (absolute inset-0), KHÔNG bọc nội dung —
// tránh lồng interactive-trong-interactive (button trong <a> là HTML không hợp
// lệ). RateButton là sibling `relative z-10` để nhận click độc lập. Chữ "Làm đề"
// là VIÊN THUỐC TRANG TRÍ (aria-hidden, pointer-events-none): cả thẻ đã là một
// liên kết mang tên đề, thêm một liên kết thứ hai cùng đích chỉ tạo hai điểm
// dừng Tab cho một việc.
//
// KHÔNG `translate` khi hover: Tailwind v4 dịch `translate-y-*` ra thuộc tính
// `translate`, thứ tự tạo stacking context và từng nuốt click của Link stretched
// (bug 2026-08). Phản hồi hover là đổi nền + đổi màu tiêu đề.
export async function ExamCard({ exam, eligibility }: ExamCardProps) {
  return (
    <Card
      as="li"
      className="group relative h-full transition-colors hover:bg-[color-mix(in_oklch,var(--surface),var(--foreground)_4%)] active:bg-[color-mix(in_oklch,var(--surface),var(--foreground)_7%)]"
    >
      <Link
        href={`/exams/${exam.id}`}
        aria-label={exam.title}
        className="rounded-card focus-visible:ring-ring/40 absolute inset-0 z-0 focus-visible:ring-3 focus-visible:outline-none"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {/* Nhãn tiếng Việt (DB lưu khoá canonical "Math") — cùng `subjectLabel`
            với Thống kê và Lịch sử; site chỉ có một ngôn ngữ (engineer 2026-09-08). */}
        <Badge variant="plain">{subjectLabel(exam.subject)}</Badge>
        <Badge variant="plain">{t("exams.gradeValue", { grade: exam.grade })}</Badge>
      </div>

      <h3 className="group-hover:text-primary text-lg leading-snug font-semibold transition-colors">
        {exam.title}
      </h3>

      {/* Byline UGC — chỉ hiện với đề có tác giả; đề seed bỏ qua. */}
      <AuthorByline name={exam.authorDisplayName} />

      <p className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="tabular-nums">
          {exam.durationMinutes} {t("exams.minutesShort")}
        </span>
        <span className="tabular-nums">
          {t("exams.questionCount", { count: exam.questionIds.length })}
        </span>
        {exam.school && <span>{exam.school}</span>}
      </p>

      <div className="mt-auto flex items-center justify-between gap-3 pt-1">
        <DifficultyBadge communityDifficulty={exam.communityDifficulty} variant="card" />
        <div className="flex items-center gap-1">
          <RateButton examId={exam.id} eligibility={eligibility} />
          <span
            aria-hidden
            className="bg-primary text-primary-foreground pointer-events-none inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold"
          >
            {t("exams.open")}
          </span>
        </div>
      </div>
    </Card>
  );
}
