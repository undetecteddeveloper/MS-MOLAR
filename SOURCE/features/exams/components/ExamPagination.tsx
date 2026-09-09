// ExamPagination — điều hướng trang cho /exams (TD-026), và từ 2026-09-07 cho
// cả /history (`basePath` + nhãn riêng; phép cắt trang ở lib/pagination).
//
// SERVER COMPONENT, cố ý: chỉ sinh link — không state, không handler. Điều
// hướng bằng `?page=` chứ không "tải thêm": trang đề là thứ người dùng CHIA SẺ
// và ĐÁNH DẤU, một URL phải mở lại đúng những gì người gửi đang nhìn thấy.
//
// Mọi bộ lọc/sắp xếp đang bật đều được CHÉP LẠI vào từng link (`buildHref`) —
// thiếu một tham số nào thì bấm sang trang 2 sẽ âm thầm reset bộ lọc.

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "@/lib/copy";

interface ExamPaginationProps {
  page: number;
  pageCount: number;
  total: number;
  /** searchParams thô của trang, TRỪ `page` — chép lại nguyên vẹn vào mỗi link. */
  params: Record<string, string | undefined>;
  /** Đường dẫn gốc của danh sách — mặc định Kho đề; Lịch sử truyền `/history`. */
  basePath?: string;
  /** Nhãn trợ năng của thanh điều hướng — mặc định theo Kho đề. */
  ariaLabel?: string;
  /** Dòng tổng dưới thanh ("12 đề", "47 lượt làm") — ĐÃ dịch; mặc định theo Kho đề. */
  totalLabel?: string;
}

function buildHref(
  basePath: string,
  params: Record<string, string | undefined>,
  page: number
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  // Trang 1 KHÔNG mang `?page=1`: một trang có hai URL là hai bản ghi khác nhau
  // trong lịch sử trình duyệt và trong mắt crawler.
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

// 44px (min-h-11) — ngưỡng vùng chạm: thanh này cũng hiện trên mobile, nơi nó
// là cách DUY NHẤT xem tiếp.
const LINK_CLASS =
  "bg-surface text-foreground hover:bg-[color-mix(in_oklch,var(--surface),var(--foreground)_7%)] focus-visible:ring-ring/40 inline-flex min-h-11 items-center gap-1 rounded-full px-4 text-sm font-semibold transition-[color,background-color,scale] ease-out motion-safe:active:scale-97 focus-visible:ring-3 focus-visible:outline-none";
const DISABLED_CLASS =
  "bg-surface text-muted-foreground inline-flex min-h-11 cursor-not-allowed items-center gap-1 rounded-full px-4 text-sm font-semibold opacity-50";

export async function ExamPagination({
  page,
  pageCount,
  total,
  params,
  basePath = "/exams",
  ariaLabel,
  totalLabel,
}: ExamPaginationProps) {
  // Một trang thì không có gì để điều hướng.
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label={ariaLabel ?? t("exams.pagination")}
      className="mt-8 flex flex-col items-center gap-3"
    >
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={buildHref(basePath, params, page - 1)} rel="prev" className={LINK_CLASS}>
            <ChevronLeft aria-hidden className="size-4" />
            {t("exams.previousPage")}
          </Link>
        ) : (
          // `aria-disabled` + span thay vì <a> vô hiệu hoá: một link không đi
          // đâu vẫn nhận focus và vẫn được trình đọc màn hình gọi là link.
          <span aria-disabled="true" className={DISABLED_CLASS}>
            <ChevronLeft aria-hidden className="size-4" />
            {t("exams.previousPage")}
          </span>
        )}

        <span aria-current="page" className="text-muted-foreground px-2 text-sm tabular-nums">
          {t("exams.pageOf", { page, pageCount })}
        </span>

        {page < pageCount ? (
          <Link href={buildHref(basePath, params, page + 1)} rel="next" className={LINK_CLASS}>
            {t("exams.nextPage")}
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        ) : (
          <span aria-disabled="true" className={DISABLED_CLASS}>
            {t("exams.nextPage")}
            <ChevronRight aria-hidden className="size-4" />
          </span>
        )}
      </div>

      <p className="text-muted-foreground text-sm">
        {totalLabel ?? t("exams.totalCount", { total })}
      </p>
    </nav>
  );
}
