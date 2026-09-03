// HistoryRow — one row per attempt in HistoryList (S-01, Task 13). Server
// Component: mirrors ExamRow's <li> shell (docs/design/history-frontend-design.md
// v1.3 § HistoryList / HistoryRow) — title (read-only, links nowhere itself),
// "X/10" score + submitted date + completion time joined with " · " (reusing
// lib/history/format.ts's shared formatters, not a locally reimplemented
// time-diff calc — Reference Contract), then a single HistoryRowMenu (⋯)
// consolidating Save/Share (AC-007's single shared PDF pipeline) + "View
// details" (front-adjust: previously 3 separate controls). pdfInput is built
// once per row from the entry's own already-loaded fields — no extra fetch
// (AC-009).
import type { MyHistoryEntry } from "@/features/history/queries";
import { EssayLifecycleBadge } from "@/components/essay/EssayLifecycleBadge";
import { HistoryRowMenu } from "@/components/history/HistoryRowMenu";
import { getTranslate } from "@/lib/i18n/server";
import { formatCompletionTime, formatSubmittedDate } from "@/lib/history/format";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";

export async function HistoryRow({
  entry,
  examineeName,
}: {
  entry: MyHistoryEntry;
  examineeName: string;
}) {
  const t = await getTranslate();
  const pdfInput: AttemptPdfData = {
    subject: entry.subject,
    examTitle: entry.examTitle,
    totalScore: entry.totalScore,
    examineeName,
    submittedAt: entry.submittedAt,
    correct: entry.correct,
    total: entry.total,
    // Đối xứng với chỗ dựng kia (result/page.tsx): ĐỌC trường đã published của
    // `MyHistoryEntry`, không suy lại RS-6 tại chỗ (EG-BE-036).
    hasIncompleteEssay: entry.hasIncompleteEssay,
  };

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-lg text-foreground">{entry.examTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {entry.totalScore.toFixed(1)}/10 · {formatSubmittedDate(entry.submittedAt)} ·{" "}
          {formatCompletionTime(entry.startedAt, entry.submittedAt)}
        </p>
        {/* Huy hiệu ở CUỐI dòng meta, KHÔNG cạnh điểm. `{score}/10 · {ngày} ·
            {thời lượng}` là MỘT đơn vị đọc; chèn một huy hiệu vào giữa chuỗi ấy
            làm vỡ nó. Ở cuối, nó đọc ra là một chú thích cho CẢ DÒNG — đúng thứ
            nó là.

            Con số `{totalScore}/10` KHÔNG DI CHUYỂN (AC-057 + D5): huy hiệu
            chính là thứ nói rằng con số ấy chưa phải con số cuối. */}
        {entry.hasUnresolvedEssay && (
          <p className="mt-1">
            <EssayLifecycleBadge state="pending" />
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-end">
        {/* CỬA THỨ HAI của cổng AC-058 (UI-D4), nay đã đóng. `/history` là nơi
            học sinh quay lại sau vài ngày, tức nơi một lượt xuất PDF DỄ XẢY RA
            NHẤT — nên chặn ở `/result` mà mở ở đây là không chặn gì cả.

            `hasUnresolvedEssay` ĐỌC từ trường đã published của đường đọc này,
            KHÔNG suy lại tại chỗ (EG-BE-036). */}
        <HistoryRowMenu
          blockedReason={entry.hasUnresolvedEssay ? t("result.essay.pdfBlocked") : null}
          pdfInput={pdfInput}
          resultHref={`/exams/${entry.examId}/attempt/${entry.attemptId}/result`}
          examTitle={entry.examTitle}
        />
      </div>
    </li>
  );
}
