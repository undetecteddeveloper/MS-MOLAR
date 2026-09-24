// SolutionEntryCard — cửa vào DUY NHẤT từ ngoài tính năng "Bài giải cộng
// đồng", chèn trên trang kết quả giữa thẻ vàng "Tiếp theo" và hàng ba nút
// (AC-007, task 08). Server component: dữ liệu (`getResultCardSummary`) đến
// CÙNG trang, không thêm round-trip client (AC-012) — đúng MỘT lệnh gọi mỗi
// lượt render, không cache/đọc lại phía client.
//
// Nhãn nút chính đi qua MỘT bảng tra duy nhất (không rẽ nhánh rải rác) — bốn
// nhãn đúng nguyên văn Reference Contract Value #1 / PRD AC-010.
//
// `Card as="section" variant="tint"` — KHÔNG BAO GIỜ "sun" (UI-D5: trang kết
// quả đã dùng "sun" cho thẻ "Tiếp theo"). Hai nút KHÔNG icon, `whitespace-
// normal` + `min-h-11` (UI-D2: nhãn dài nhất "Bài giải của bạn đang bị ẩn"
// không vừa một dòng ở bất kỳ bề rộng nào — xuống dòng thay vì cắt chữ).
import Link from "next/link";

import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  getResultCardSummary,
  type ResultCardSummary,
  type SolutionStatus,
} from "@/features/solutions/queries";
import { ModerationReasonBanner } from "./ModerationReasonBanner";

interface SolutionEntryCardProps {
  examId: string;
  attemptId: string;
}

/** Bảng tra nhãn nút chính — MỘT chỗ duy nhất, không rẽ nhánh rải rác
 *  (task 08 Refactor step). `"none"` phủ cả "chưa có bài" lẫn "bài đã bị xoá
 *  hẳn, chưa xem lý do" (frontend DD § Data Contracts: `myStatus` đọc là
 *  `null` trong cùng phản hồi mang `unseenDeletionReason`). */
const PRIMARY_LABEL_KEY = {
  none: "solutions.entry.write",
  draft: "solutions.entry.continue",
  published: "solutions.entry.edit",
  hidden: "solutions.entry.hidden",
} as const satisfies Record<"none" | SolutionStatus, Parameters<typeof t>[0]>;

function primaryLabel(status: SolutionStatus | null): string {
  return t(PRIMARY_LABEL_KEY[status ?? "none"]);
}

/** Hình dạng "rỗng an toàn" (N=0) — dùng khi truy vấn THẬT thành công nhưng
 *  trả N=0, VÀ khi truy vấn ném lỗi (frontend DD § UI Error State Design,
 *  hàng SolutionEntryCard/cột Error: "card renders the N=0-shaped fallback,
 *  never a red banner"). Đây KHÁC nhánh "0 dòng" (`getResultCardSummary`
 *  trả `null`) — nhánh đó không render thẻ nào cả. */
const EMPTY_SAFE_SUMMARY: ResultCardSummary = {
  publishedCount: 0,
  myStatus: null,
  changedQuestionCount: 0,
  unseenDeletionReason: null,
};

async function readSummary(examId: string): Promise<ResultCardSummary | null> {
  try {
    return await getResultCardSummary(examId);
  } catch {
    return EMPTY_SAFE_SUMMARY;
  }
}

const ENTRY_BUTTON_CLASS = "h-auto min-h-11 flex-1 px-3 py-2 text-center leading-tight whitespace-normal";

export async function SolutionEntryCard({ examId, attemptId }: SolutionEntryCardProps) {
  const summary = await readSummary(examId);

  // 0 dòng THẬT (đề chưa published/tác giả bị ban/người gọi chưa nộp bài) —
  // không thẻ, không placeholder, không dòng nhắc nào (frontend DD § Data
  // Contracts "ResultCardSummary", "Zero rows"; task 08 Completion Criteria).
  if (summary === null) return null;

  const { publishedCount, myStatus, changedQuestionCount, unseenDeletionReason } = summary;
  const writeHref = `/exams/${examId}/attempt/${attemptId}/solution`;
  const listHref = `/exams/${examId}/solutions`;

  const countLine =
    publishedCount > 0
      ? t("solutions.entry.count", { count: publishedCount })
      : t("solutions.entry.empty");
  const secondaryLabel =
    publishedCount > 0
      ? t("solutions.entry.viewCount", { count: publishedCount })
      : t("solutions.entry.view");

  return (
    <Card as="section" variant="tint" aria-labelledby="solution-entry-title" className="gap-3">
      <div className="flex flex-col gap-1.5">
        <p className="eyebrow">{t("solutions.eyebrow")}</p>
        <h2 id="solution-entry-title" className="text-lg font-semibold">
          {countLine}
        </h2>
        <p className="text-muted-foreground text-sm">{t("solutions.entry.body")}</p>
        {changedQuestionCount > 0 && (
          <p className="text-sm">
            {t("solutions.entry.changed", { count: changedQuestionCount })}
          </p>
        )}
      </div>

      {unseenDeletionReason && <ModerationReasonBanner reason={unseenDeletionReason} />}

      <div className="flex items-stretch gap-2">
        <Link href={writeHref} className={cn(buttonVariants(), ENTRY_BUTTON_CLASS)}>
          {primaryLabel(myStatus)}
        </Link>
        <Link
          href={listHref}
          className={cn(buttonVariants({ variant: "secondary" }), ENTRY_BUTTON_CLASS)}
        >
          {secondaryLabel}
        </Link>
      </div>
    </Card>
  );
}
