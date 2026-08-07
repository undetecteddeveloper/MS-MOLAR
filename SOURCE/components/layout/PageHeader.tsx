// PageHeader — khối mở đầu chuẩn của mọi trang, dựng theo trật tự layout của
// Supabase Studio (docs/market/UI-Design-Research.md §2):
//
//     [breadcrumbs]        ← luôn trên cùng
//     [eyebrow]
//     [tiêu đề]  [actions] ← hành động chính nằm cùng hàng tiêu đề
//     [mô tả]
//     [subnav]             ← điều hướng phụ ngay bên dưới, có hairline chia
//
// Trước đây mỗi trang tự dựng cụm này bằng tay (`<h1 className="font-serif
// text-2xl">` + `<p className="mt-1 text-sm">`), nên cỡ chữ và khoảng cách
// lệch nhau giữa các trang. Gom về một chỗ để thứ bậc là thuộc tính của hệ
// thống chứ không phải của từng file.

import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  /** Nhãn nhỏ in hoa phía trên tiêu đề (phân loại trang). */
  eyebrow?: string;
  description?: string;
  breadcrumbs?: Crumb[];
  /** Nút/hành động chính, căn phải cùng hàng tiêu đề. */
  actions?: React.ReactNode;
  /** Điều hướng phụ (tab giữa các trang con) — hiện ngay dưới, có hairline. */
  subnav?: React.ReactNode;
  /** `display` = thang chữ hiển thị đặc kiểu Supabase hero (72px, leading 1.0).
   *  Dành cho trang đích/mở đầu; trang tác vụ dùng `default`. */
  size?: "default" | "display";
  className?: string;
};

export function PageHeader({
  title,
  eyebrow,
  description,
  breadcrumbs,
  actions,
  subnav,
  size = "default",
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-2", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} className="mb-1 text-xs" />
      )}

      {eyebrow && <p className="eyebrow">{eyebrow}</p>}

      {/* items-start (không phải items-center): khi tiêu đề xuống 2–3 dòng,
          căn giữa sẽ đẩy nút hành động trôi xuống lửng lơ giữa khối chữ. */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <h1
          className={cn(
            "text-foreground min-w-0 font-serif",
            size === "display" ? "text-display font-semibold" : "text-2xl"
          )}
        >
          {title}
        </h1>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {description && (
        // max-w-prose: giới hạn nhịp đọc ~65 ký tự/dòng ngay cả trong scaffold
        // `full` 72rem — dòng mô tả trải hết 1152px là không đọc nổi.
        <p className="text-muted-foreground max-w-prose text-sm">{description}</p>
      )}

      {subnav && (
        <div className="border-border mt-2 flex items-center gap-1 border-b pb-0">{subnav}</div>
      )}
    </header>
  );
}
