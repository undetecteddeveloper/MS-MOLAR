import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Badge — nhãn nhỏ (môn, lớp, trạng thái). Chữ THƯỜNG 12px đậm vừa, bo tròn.
//
// Màu là kênh phụ: trạng thái đúng/sai/chờ luôn có CHỮ nói rõ, badge chỉ tô
// thêm. `plain` (`--card`) dành cho badge nằm trên thẻ đã tô surface: bản nền
// sáng nó là TRẮNG trên xanh nhạt, nền tối (2026-09-14) là một nấc SÁNG HƠN
// trên xanh đêm — cùng một quan hệ, tách rõ mà không cần viền.
//
// `surface` (mặc định) thêm `glow-rim`: badge surface đứng trên NỀN TRANG, mà
// hai màu đó chỉ chênh 1,1:1 — thiếu gờ sáng thì badge tan vào trang.
const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&>svg]:size-3",
  {
    variants: {
      variant: {
        plain: "bg-card text-foreground",
        surface: "bg-surface text-foreground glow-rim",
        sun: "bg-sun-soft text-foreground",
        success: "bg-surface text-success",
        wrong: "bg-destructive/10 text-destructive",
        muted: "bg-surface text-muted-foreground",
        outline: "border-border text-foreground border bg-transparent",
      },
    },
    defaultVariants: { variant: "surface" },
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
