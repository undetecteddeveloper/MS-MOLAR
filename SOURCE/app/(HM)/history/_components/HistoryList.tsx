// HistoryList — /history content column (S-01, Task 13). Server Component.
// Front-adjust (2026-08-17): tiêu đề trang bỏ khỏi UI nhìn thấy được (điều
// hướng đã tô sáng mục History) và bộ lọc chuyển ra rail bên cạnh nội dung —
// xem HistoryFilters.tsx + history/page.tsx (bố cục nay khớp ExamFilters/
// ExamBrowser trên /exams, chỉ khác danh mục lọc bên trong). Bounded-height,
// internally-scrolling row container (D3) instead of an unbounded list; the
// dashed-border empty state distinguishes "genuinely no history yet" (CTA to
// /exams, AC-002) from "filtered down to zero" (no CTA — the fix is clearing
// filters, not browsing exams).
//
// Invariant: never re-sorts or re-filters `entries` itself — that is
// listMyHistory()'s (ordering) and filterHistoryEntries()'s (filtering)
// responsibility, both already applied by the caller.
import Link from "next/link";
import { getTranslate } from "@/lib/i18n/server";
import type { MyHistoryEntry } from "@/app/(HM)/queries";
import { HistoryRow } from "./HistoryRow";

export async function HistoryList({
  entries,
  isFiltered = false,
}: {
  entries: MyHistoryEntry[];
  isFiltered?: boolean;
}) {
  const t = await getTranslate();
  return (
    <div className="w-full">
      {entries.length === 0 ? (
        <div className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
          {isFiltered ? (
            <>
              <p className="text-foreground font-serif text-lg">{t("history.noMatches")}</p>
              <p className="text-muted-foreground text-sm">{t("history.noMatchesHint")}</p>
            </>
          ) : (
            <>
              <p className="text-foreground font-serif text-lg">{t("history.noResults")}</p>
              <p className="text-muted-foreground text-sm">{t("history.noResultsHint")}</p>
              <Link
                href="/exams"
                className="bg-brand text-brand-foreground mt-2 rounded-full px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-opacity hover:opacity-90"
              >
                {t("common.browseExams")}
              </Link>
            </>
          )}
        </div>
      ) : (
        // Trần chiều cao khác nhau theo bề rộng, CỐ Ý:
        //  - Desktop (≥768px): giữ 30rem — khung có trần là quyết định thiết kế
        //    sẵn có (D3), trang còn nội dung khác bên dưới.
        //  - Mobile: 30rem cố định để lại một mảng trống lớn giữa dòng cuối và
        //    thanh điều hướng đáy, trong khi danh sách BÊN TRONG vẫn đang cuộn
        //    vì bị cắt — vừa xấu vừa lãng phí, ở đúng nơi màn hình chật nhất.
        //    `100dvh - 15rem` trừ đi phần chiều cao đã bị chiếm: navbar 60px +
        //    đệm trang + khối tiêu đề + đệm đáy cho BottomNav. `dvh` chứ không
        //    `vh`: thanh địa chỉ trình duyệt ẩn/hiện khi cuộn làm `vh` sai số
        //    (§3.2 tài liệu mobile).
        <ul className="flex max-h-[calc(100dvh-15rem)] flex-col gap-3 overflow-y-auto pr-2 md:max-h-[30rem]">
          {entries.map((entry) => (
            <HistoryRow key={entry.attemptId} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}
