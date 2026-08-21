// Breadcrumbs — dải định vị trên cùng mỗi trang con, theo quy tắc layout của
// Supabase Studio (docs/market/UI-Design-Research.md §2: "thanh Breadcrumbs
// luôn nằm trên cùng; điều hướng phụ nằm ngay bên dưới").
//
// Lý do cần: các route sâu như
// /exams/[id]/attempt/[attemptId]/result/detail trước đây không cho người dùng
// một mốc nào để biết mình đang đứng ở đâu hay lùi về đâu — nút back của trình
// duyệt là lối ra duy nhất.
//
// KHÔNG phải client component: nhãn được truyền vào dạng chuỗi đã dịch sẵn
// (server page gọi `getTranslate()` rồi truyền xuống), nên không cần kéo theo
// runtime i18n phía client chỉ để hiện vài chữ tĩnh.

import Link from "next/link";
import { cn } from "@/lib/utils";

export type Crumb = {
  /** Nhãn ĐÃ DỊCH. Component này cố ý không tự tra từ điển. */
  label: string;
  /** Bỏ trống ở mốc cuối (trang hiện tại) — mốc cuối không phải là liên kết. */
  href?: string;
};

export function Breadcrumbs({
  items,
  className,
  ...props
}: Omit<React.ComponentProps<"nav">, "children"> & { items: Crumb[] }) {
  if (items.length === 0) return null;

  return (
    // aria-label bắt buộc: trang có nhiều <nav> (navbar chính + breadcrumb),
    // thiếu nhãn thì trình đọc màn hình đọc cả hai đều là "navigation".
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)} {...props}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex min-w-0 items-center">
              {i > 0 && (
                // Dấu phân cách là trang trí thuần tuý — ẩn khỏi cây trợ năng,
                // nếu không trình đọc sẽ xướng "slash" giữa mỗi mốc.
                <span aria-hidden className="text-muted-foreground/60 mr-1 select-none">
                  /
                </span>
              )}
              {isLast || !item.href ? (
                // aria-current="page" là thứ nói cho trợ năng biết đây là vị
                // trí hiện tại; chỉ tô màu đậm hơn thì người dùng trình đọc
                // không nhận được thông tin đó (WCAG 1.4.1 — màu không được là
                // kênh truyền đạt duy nhất).
                <span
                  aria-current="page"
                  className="text-foreground max-w-[16rem] truncate font-medium"
                >
                  {item.label}
                </span>
              ) : (
                // `py-1` nâng vùng bấm lên ≥24px: chữ 12px chỉ cao ~16px, hụt
                // ngưỡng WCAG 2.5.8 Target Size (Minimum).
                <Link
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring max-w-[16rem] truncate rounded-sm py-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
