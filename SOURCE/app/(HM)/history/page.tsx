// (HM)/history — page-level auth guard, mirrors (layer4)/upload/page.tsx:8-10.
// Guard runs strictly BEFORE any data fetch (AC-016: zero attempt rows fetched
// for a guest — backend Design Doc history-backend-design.md v1.2, § Auth
// Guard and Layout).
//
// Front-adjust (2026-08-17): bố cục nay khớp ExamFilters/ExamBrowser trên
// /exams — HistoryFilters là một rail sticky bên trái nội dung (KHÔNG còn
// nằm trong header cạnh tiêu đề, và tiêu đề trang cũng bỏ khỏi UI nhìn thấy
// được — điều hướng đã tô sáng mục History). Filter state lives in the URL
// (same convention as ExamFilters) and is applied via filterHistoryEntries()
// against the single listMyHistory() fetch — no extra round trip per filter
// change.

import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { getTranslate } from "@/lib/i18n/server";
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
  const user = await getCurrentUserProfile();
  if (!user) redirect("/?auth=signin");

  const t = await getTranslate();
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
      {/* `small` là bề rộng THẬT của trang này (danh sách hàng, không phải
          lưới thẻ như /exams) — `padding="none"`: rail lọc phải dính mép
          trái để sticky đúng chỗ, cột nội dung tự có padding riêng, cùng lối
          thoát PageContainer chừa sẵn mà exams/page.tsx đang dùng. */}
      <PageContainer as="main" size="small" padding="none">
        {/* Trang này CỐ Ý không có tiêu đề nhìn thấy được (điều hướng đã tô
            sáng mục History) — sr-only giữ mốc cho trình đọc màn hình, cùng
            quy ước exams/page.tsx. */}
        <h1 className="sr-only">{t("history.title")}</h1>
        <div className="relative flex items-start max-md:flex-col max-md:items-stretch">
          <HistoryFilters subjects={subjects} exams={exams} selected={selected} />

          <div
            className="preload-fade min-w-0 flex-1 px-4 py-5"
            style={{ "--preload-order": 2 } as React.CSSProperties}
          >
            <HistoryList
              entries={filteredEntries}
              isFiltered={entries.length > 0 && filteredEntries.length !== entries.length}
              examineeName={user.displayName}
            />
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
