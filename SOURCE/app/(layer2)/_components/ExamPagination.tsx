// ExamPagination — điều hướng trang cho /exams (TD-026, 2026-08-27).
//
// SERVER COMPONENT, cố ý: nó chỉ sinh ra link. Không state, không handler,
// không hook — biến nó thành client component sẽ thêm JS vào một route đã nặng
// (đo prod 2026-08-27: /exams 256 KB JS) để đổi lấy đúng con số không.
//
// Điều hướng bằng `?page=` chứ không phải nút "tải thêm": trang đề là thứ người
// dùng CHIA SẺ và ĐÁNH DẤU. Một URL phải mở lại đúng những gì người gửi đang
// nhìn thấy, và "tải thêm" không có URL nào để gửi.
//
// Mọi bộ lọc/sắp xếp đang bật đều được CHÉP LẠI vào từng link (`buildHref`) —
// thiếu một tham số nào thì bấm sang trang 2 sẽ âm thầm reset bộ lọc, một kiểu
// hỏng vừa dễ mắc vừa khó thấy vì trang 2 vẫn đầy đề.

import Link from "next/link";
import { getTranslate } from "@/lib/i18n/server";

interface ExamPaginationProps {
  page: number;
  pageCount: number;
  total: number;
  /** searchParams thô của trang, TRỪ `page` — chép lại nguyên vẹn vào mỗi link. */
  params: Record<string, string | undefined>;
}

function buildHref(params: Record<string, string | undefined>, page: number): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  // Trang 1 KHÔNG mang `?page=1`: một trang có hai URL là hai bản ghi khác nhau
  // trong lịch sử trình duyệt và trong mắt crawler, cho cùng một nội dung.
  if (page > 1) sp.set("page", String(page));
  const qs = sp.toString();
  return qs ? `/exams?${qs}` : "/exams";
}

export async function ExamPagination({ page, pageCount, total, params }: ExamPaginationProps) {
  const t = await getTranslate();

  // Một trang thì không có gì để điều hướng — và một thanh phân trang chỉ có
  // "1" là nhiễu thị giác nói rằng có nhiều hơn.
  if (pageCount <= 1) return null;

  const linkClass =
    "border-border text-foreground hover:border-ring inline-flex min-h-11 min-w-11 items-center justify-center rounded border px-3 font-sans text-xs font-medium tracking-[0.1em] uppercase transition-colors";
  // min-h-11/min-w-11 = 44px — ngưỡng vùng chạm (§4.3), vì thanh này cũng hiện
  // trên mobile nơi nó là cách DUY NHẤT xem tiếp.
  const disabledClass =
    "border-border text-muted-foreground inline-flex min-h-11 min-w-11 cursor-not-allowed items-center justify-center rounded border px-3 font-sans text-xs font-medium tracking-[0.1em] uppercase opacity-50";

  return (
    <nav aria-label={t("exams.pagination")} className="mt-8 flex flex-col items-center gap-3">
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={buildHref(params, page - 1)} rel="prev" className={linkClass}>
            {t("exams.previousPage")}
          </Link>
        ) : (
          // `aria-disabled` + span thay vì <a> vô hiệu hoá: một link không đi
          // đâu vẫn nhận được focus và vẫn được trình đọc màn hình gọi là link.
          <span aria-disabled="true" className={disabledClass}>
            {t("exams.previousPage")}
          </span>
        )}

        <span
          aria-current="page"
          className="text-muted-foreground px-2 font-sans text-xs tabular-nums"
        >
          {t("exams.pageOf", { page, pageCount })}
        </span>

        {page < pageCount ? (
          <Link href={buildHref(params, page + 1)} rel="next" className={linkClass}>
            {t("exams.nextPage")}
          </Link>
        ) : (
          <span aria-disabled="true" className={disabledClass}>
            {t("exams.nextPage")}
          </span>
        )}
      </div>

      <p className="text-muted-foreground font-sans text-xs">{t("exams.totalCount", { total })}</p>
    </nav>
  );
}
