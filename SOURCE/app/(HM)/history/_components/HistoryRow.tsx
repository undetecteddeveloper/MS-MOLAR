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
import type { MyHistoryEntry } from "@/app/(HM)/queries";
import { HistoryRowMenu } from "@/components/history/HistoryRowMenu";
import { formatCompletionTime, formatSubmittedDate } from "@/lib/history/format";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";

export function HistoryRow({ entry }: { entry: MyHistoryEntry }) {
  const pdfInput: AttemptPdfData = {
    examTitle: entry.examTitle,
    totalScore: entry.totalScore,
    startedAt: entry.startedAt,
    submittedAt: entry.submittedAt,
  };

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate text-lg text-foreground">{entry.examTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {entry.totalScore.toFixed(1)}/10 · {formatSubmittedDate(entry.submittedAt)} ·{" "}
          {formatCompletionTime(entry.startedAt, entry.submittedAt)}
        </p>
      </div>

      <div className="flex shrink-0 items-center justify-end">
        <HistoryRowMenu
          pdfInput={pdfInput}
          resultHref={`/exams/${entry.examId}/attempt/${entry.attemptId}/result`}
          examTitle={entry.examTitle}
        />
      </div>
    </li>
  );
}
