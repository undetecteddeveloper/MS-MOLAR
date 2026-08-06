// Result — /exams/[id]/attempt/[attemptId]/result (Layer 2). M2.6 → GĐ 3 M3.1 Task 4.
// Server Component: đọc kết quả đã chấm + lưu trong DB qua getResult().
// Attempt chưa nộp / không tồn tại / không thuộc user → redirect về trang đề (Q2=A).
// Bố cục: block điểm · save/share + trở về · nav (Chi tiết → page riêng / Làm lại) ·
// rating entry. Visual "tờ giấy trắng".
//
// 2026-07-27: bỏ hẳn khối "Topics" (số câu đúng theo chủ đề, cũ dùng
// TopicBreakdown.tsx — component đã xóa, không còn nơi nào khác dùng) theo
// yêu cầu — layout bên dưới được dựng lại từ đầu cho vừa khít 1 cột thay vì
// grid 2 cột [Topics | Save/Share+Return] cũ (xóa Topics để trống cột trái
// sẽ vỡ bố cục nếu giữ nguyên grid đó).

import Link from "next/link";
import { getTranslate } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { getMyRating } from "@/app/(layer2)/actions";
import { getResult } from "@/app/(layer2)/queries";
import { ScoreCard } from "@/app/(layer2)/_components/ScoreCard";
import { ResultActions } from "@/app/(layer2)/_components/ResultActions";
import { mapFromMyRating } from "@/lib/rating";
import { formatCompletionTime, formatOvertime } from "@/lib/history/format";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const t = await getTranslate();
  const { id, attemptId } = await params;
  const data = await getResult(attemptId);

  if (!data) {
    redirect(`/exams/${id}`);
  }

  const { examTitle, result } = data;
  // Đã rated trước đó chưa → nhãn nút rating "Edit your rating"/"Rate this
  // exam" (AC-006/013), cùng pattern mapFromMyRating(getMyRating(id)) như
  // /exams/[id]/rate/page.tsx.
  const initialScores = mapFromMyRating(await getMyRating(id));
  const hasRated = initialScores !== undefined;

  // Task 12: computed once here (no extra round trip, AC-009) and passed
  // down to ScoreCard/ResultActions — same shared formatter/type HistoryRow
  // (Task 13) and generateAttemptPdf.ts use, so all surfaces stay in sync.
  const completionTimeLabel = formatCompletionTime(data.startedAt, data.submittedAt);
  const pdfInput: AttemptPdfData = {
    examTitle,
    totalScore: result.totalScore,
    startedAt: data.startedAt,
    submittedAt: data.submittedAt,
  };

  return (
    <div className="bg-background">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-6 py-8">
        {/* preload order 1–4 — các block fade lần lượt sau navbar (S#21). */}
        <div className="preload-fade" style={{ "--preload-order": 1 } as React.CSSProperties}>
          <ScoreCard
            examTitle={examTitle}
            result={result}
            completionTimeLabel={completionTimeLabel}
          />
        </div>

        {/* Quá giờ (Security review #6). DB tự tính overtime_seconds trong
            record_exam_result() từ started_at + duration_minutes, nên nhãn này
            không nói dối được kể cả khi người làm tắt JS để vô hiệu hoá đồng hồ.
            Điểm vẫn được chấm bình thường — chỉ nói rõ là ngoài thời gian. */}
        {data.overtimeSeconds > 0 && (
          <div
            className="preload-fade border-border bg-card text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-sm"
            style={{ "--preload-order": 2 } as React.CSSProperties}
          >
            <span className="text-foreground font-medium">{t("result.submittedAfterTime")}</span>{" "}
            This attempt went {formatOvertime(data.overtimeSeconds)} over the allotted time, so the
            score is not a valid timed result.
          </div>
        )}

        {/* Save · Share · Return — 3 ô ngang bằng nhau, không còn phụ thuộc
            cột Topics đã xóa để định chiều cao/chiều rộng. */}
        <div
          className="preload-fade grid grid-cols-3 gap-3"
          style={{ "--preload-order": 2 } as React.CSSProperties}
        >
          <ResultActions pdfInput={pdfInput} />
          {/* Return → ExamBrowser (S#26 — đổi từ Home→"/" cũ). */}
          <Link
            href="/exams"
            className="border-border bg-card text-foreground hover:border-brand flex items-center justify-center rounded-xl border px-3 py-4 text-center text-sm transition-colors"
          >
            {t("result.return")}
          </Link>
        </div>

        {/* Nav cuối: Chi tiết (page riêng, Q5) · Làm lại (→ Detail, tạo attempt mới). */}
        <div
          className="preload-fade grid grid-cols-2 gap-3"
          style={{ "--preload-order": 3 } as React.CSSProperties}
        >
          <Link
            href={`/exams/${id}/attempt/${attemptId}/result/detail`}
            className="border-brand bg-brand text-brand-foreground rounded-lg border px-4 py-3 text-center text-sm font-medium transition-opacity hover:opacity-90"
          >
            {t("common.viewDetails")}
          </Link>
          <Link
            href={`/exams/${id}`}
            className="border-border bg-card text-foreground hover:border-brand rounded-lg border px-4 py-3 text-center text-sm font-medium transition-colors"
          >
            {t("common.tryAgain")}
          </Link>
        </div>

        {/* Rating System — điều hướng thẳng sang trang Rating chính
            (/exams/[id]/rate) thay vì mở popup tại chỗ (2026-07-27). Kèm
            ?returnTo= chính URL trang này, để nút "← Back" trên trang rate
            quay lại ĐÚNG trang kết quả này thay vì mặc định /exams. */}
        <div className="preload-fade" style={{ "--preload-order": 4 } as React.CSSProperties}>
          <Link
            href={`/exams/${id}/rate?returnTo=${encodeURIComponent(
              `/exams/${id}/attempt/${attemptId}/result`
            )}`}
            className="border-border bg-card text-foreground hover:border-brand block w-full rounded-lg border px-4 py-3 text-center text-sm font-medium transition-colors"
          >
            {hasRated ? t("result.editRating") : t("result.rateThisExam")}
          </Link>
        </div>
      </main>
    </div>
  );
}
