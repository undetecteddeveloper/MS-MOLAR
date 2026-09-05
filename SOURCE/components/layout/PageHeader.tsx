// PageHeader — khối mở đầu chuẩn của mọi trang:
//
//     [breadcrumbs]        ← luôn trên cùng
//     [eyebrow]
//     [tiêu đề]  [actions] ← hành động chính nằm cùng hàng tiêu đề
//     [mô tả]
//     [subnav]             ← điều hướng phụ ngay bên dưới, có kẻ chia
//
// Gom về một chỗ để thứ bậc chữ là thuộc tính của hệ thống chứ không của từng
// file. Theme "Sân trường": tiêu đề Lexend 700, 26px (28px từ sm), không in hoa
// nhãn nhỏ.

import { Breadcrumbs, type Crumb } from "./Breadcrumbs";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  /** Nhãn nhỏ phía trên tiêu đề (phân loại trang) — chữ thường. */
  eyebrow?: string;
  description?: string;
  breadcrumbs?: Crumb[];
  /** Nút/hành động chính, căn phải cùng hàng tiêu đề. */
  actions?: React.ReactNode;
  /** Điều hướng phụ (tab giữa các trang con) — hiện ngay dưới, có kẻ chia. */
  subnav?: React.ReactNode;
  /** `display` = thang chữ hiển thị (clamp 30–52px) cho trang đích; trang tác
   *  vụ dùng `default`. */
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

      {/* items-start: khi tiêu đề xuống 2–3 dòng, căn giữa sẽ đẩy nút hành
          động trôi lửng lơ giữa khối chữ. */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <h1
          className={cn(
            "text-foreground min-w-0 font-bold",
            size === "display" ? "text-display" : "text-[1.625rem] leading-tight sm:text-3xl"
          )}
        >
          {title}
        </h1>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {description && (
        // max-w-prose: giới hạn ~65 ký tự/dòng ngay cả trong scaffold `full`.
        <p className="text-muted-foreground max-w-prose text-base leading-relaxed">{description}</p>
      )}

      {subnav && (
        <div className="border-border mt-2 flex items-center gap-1 border-b pb-0">{subnav}</div>
      )}
    </header>
  );
}
