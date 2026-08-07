// (HM)/history — page-level auth guard, mirrors (layer4)/upload/page.tsx:8-10.
// Guard runs strictly BEFORE any data fetch (AC-016: zero attempt rows fetched
// for a guest — backend Design Doc history-backend-design.md v1.2, § Auth
// Guard and Layout).
//
// Front-adjust: this page owns a single-column <main>; HistoryFilters is
// passed into HistoryList's `filters` slot, which renders it beside the
// "History" heading (engineer feedback: the filter trigger belongs in the
// page header, balanced against the title — not a separate left-rail column
// like ExamFilters/ExamBrowser on /exams). Filter state lives in the URL
// (same convention as ExamFilters) and is applied via filterHistoryEntries()
// against the single listMyHistory() fetch — no extra round trip per filter
// change.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { listMyHistory } from "@/app/(HM)/queries";
import { filterHistoryEntries, type HistoryEntryFilters } from "@/lib/history/filterEntries";
import { HistoryFilters } from "./_components/HistoryFilters";
import { HistoryList } from "./_components/HistoryList";
import { PageContainer } from "@/components/layout/PageContainer";

type SearchParams = Promise<{
  subject?: string;
  examId?: string;
  scoreMin?: string;
  scoreMax?: string;
  dateFrom?: string;
  dateTo?: string;
}>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Unknown/out-of-range value -> undefined ("no filter applied"), matching
// ExamsPage's own field-propagation convention for `sort`/`level`.
function parseScore(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : undefined;
}

function parseDate(raw: string | undefined): string | undefined {
  return raw && ISO_DATE.test(raw) ? raw : undefined;
}

export default async function HistoryPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin");

  const sp = await searchParams;
  const entries = await listMyHistory();

  const subjects = [...new Set(entries.map((e) => e.subject))].sort();
  const exams = [
    ...new Map(entries.map((e) => [e.examId, { id: e.examId, title: e.examTitle }])).values(),
  ].sort((a, b) => a.title.localeCompare(b.title));

  const selected: HistoryEntryFilters = {
    subject: sp.subject && subjects.includes(sp.subject) ? sp.subject : undefined,
    examId: sp.examId && exams.some((e) => e.id === sp.examId) ? sp.examId : undefined,
    scoreMin: parseScore(sp.scoreMin),
    scoreMax: parseScore(sp.scoreMax),
    dateFrom: parseDate(sp.dateFrom),
    dateTo: parseDate(sp.dateTo),
  };

  const filteredEntries = filterHistoryEntries(entries, selected);

  return (
    <div className="bg-background">
      {/* `small` là bề rộng THẬT của trang này: khung ngoài trước đây khai
          max-w-6xl nhưng HistoryList bên trong lại tự ghim max-w-2xl, nên con
          số 6xl chưa bao giờ có tác dụng. Khai đúng nấc thay vì để hai lớp
          container mâu thuẫn nhau. */}
      <PageContainer as="main" size="small" padding="compact">
        <HistoryList
          entries={filteredEntries}
          isFiltered={entries.length > 0 && filteredEntries.length !== entries.length}
          filters={<HistoryFilters subjects={subjects} exams={exams} selected={selected} />}
        />
      </PageContainer>
    </div>
  );
}
