import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Chip — viên thuốc lọc 40px của theme "Sân trường": hàng chip ở Kho đề, chip
// khoảng thời gian ở Thống kê. Đang chọn = nền xanh đen + chữ trắng, đối lập rõ
// với chip nghỉ nền surface — trạng thái đọc được bằng độ đậm lẫn màu (design
// doc §4.3), không cần tới vàng.
//
// Bộ lớp này từng nằm cục bộ trong ExamFilters (ba hằng CHIP/CHIP_IDLE/CHIP_ON);
// gom về đây khi Thống kê cần cùng một chip cho Tuần/Tháng/Toàn thời gian — hai
// bản chép của cùng một viên thuốc là thứ chỉ có thể lệch nhau theo thời gian.
//
// `aria-pressed` đặt theo `active`: chip là nút BẬT/TẮT một điều kiện, không phải
// tab điều khiển panel. `chipVariants` xuất riêng cho chỗ chip không phải nút
// bật/tắt (nút mở bảng lọc mang aria-expanded, nút đảo chiều sắp xếp) để giữ
// đúng bộ lớp mà không gán nhầm ngữ nghĩa.
const chipVariants = cva(
  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      active: {
        true: "bg-foreground text-background",
        false:
          "bg-surface text-foreground hover:bg-[color-mix(in_oklch,var(--surface),var(--foreground)_7%)]",
      },
    },
    defaultVariants: { active: false },
  }
);

type ChipProps = Omit<React.ComponentProps<"button">, "type"> & VariantProps<typeof chipVariants>;

function Chip({ active = false, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      data-slot="chip"
      aria-pressed={active === true}
      className={cn(chipVariants({ active }), className)}
      {...props}
    />
  );
}

export { Chip, chipVariants };
