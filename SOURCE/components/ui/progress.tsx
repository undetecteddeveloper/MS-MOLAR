import * as React from "react";

import { cn } from "@/lib/utils";

// Progress — thanh tiến độ mảnh. Tô XANH (`--primary`), không tô vàng: vàng
// nắng chỉ đạt 1,6:1 trên nền sáng, hụt ngưỡng 3:1 cho đồ hoạ mang thông tin
// (WCAG 1.4.11). Xanh trên track `--border` đạt 3,9:1.
//
// `role="progressbar"` + aria-valuenow để trình đọc màn hình đọc được tiến độ;
// nhãn chữ ("Câu 7 trên 40") do nơi gọi đặt cạnh, truyền `aria-labelledby`.
type ProgressProps = Omit<React.ComponentProps<"div">, "children"> & {
  /** Giá trị hiện tại, kẹp vào [0, max]. */
  value: number;
  max?: number;
  /** `md` (8px) cho màn làm bài; `sm` (4px) cho thẻ tóm tắt. */
  size?: "sm" | "md";
};

function Progress({ value, max = 100, size = "md", className, ...props }: ProgressProps) {
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(safeMax, Math.max(0, value));
  const percent = (clamped / safeMax) * 100;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      data-slot="progress"
      className={cn(
        "bg-border w-full overflow-hidden rounded-full",
        size === "md" ? "h-2" : "h-1",
        className
      )}
      {...props}
    >
      <div
        className="bg-primary h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export { Progress };
