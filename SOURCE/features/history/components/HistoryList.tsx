// HistoryList — cột nội dung của /history. Server Component.
//
// Theme "Sân trường" (2026-09-07): danh sách TRẢI TỰ NHIÊN theo trang — không
// còn khung cuộn riêng cao 30rem của bản trước (D3): một vùng cuộn lồng trong
// trang cuộn là hai thanh cuộn tranh một ngón tay trên điện thoại, và dưới
// danh sách không còn nội dung nào để mà "giữ chỗ". Trang cắt bằng `?page=`
// (lib/history/paginate.ts), nơi gọi đặt ExamPagination ngay dưới.
//
// Hai trạng thái rỗng phân biệt nhau bằng HÀNH ĐỘNG đi kèm, không chỉ bằng
// câu chữ: chưa từng làm bài → nút xanh tới Kho đề (AC-002); lọc về không →
// nút "Xoá lọc" về /history trần — việc cần làm là bỏ lọc, không phải đi tìm
// đề. Cả hai là thẻ viền nét đứt căn giữa, cùng khuôn với Kho đề và Thống kê.
//
// Bất biến giữ nguyên: không tự sắp xếp hay lọc lại `entries` — thứ tự là việc
// của listMyHistory(), lọc là của filterHistoryEntries(), cắt trang là của
// paginateHistory(); cả ba đã chạy ở nơi gọi.

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { MyHistoryEntry } from "@/features/history/queries";
import { HistoryRow } from "@/features/history/components/HistoryRow";

export async function HistoryList({
  entries,
  isFiltered = false,
  examineeName,
}: {
  entries: MyHistoryEntry[];
  isFiltered?: boolean;
  examineeName: string;
}) {
  if (entries.length === 0) {
    return (
      <Card variant="outline" className="items-center gap-1 border-dashed px-6 py-12 text-center">
        <h2 className="text-lg font-semibold">
          {isFiltered ? t("history.noMatches") : t("history.noResults")}
        </h2>
        <p className="text-muted-foreground max-w-prose text-sm leading-relaxed">
          {isFiltered ? t("history.noMatchesHint") : t("history.noResultsHint")}
        </p>
        {isFiltered ? (
          <Link
            href="/history"
            className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-3")}
          >
            {t("common.clear")}
          </Link>
        ) : (
          <Link href="/exams" className={cn(buttonVariants(), "mt-3")}>
            {t("common.browseExams")}
          </Link>
        )}
      </Card>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => (
        <HistoryRow key={entry.attemptId} entry={entry} examineeName={examineeName} />
      ))}
    </ul>
  );
}
