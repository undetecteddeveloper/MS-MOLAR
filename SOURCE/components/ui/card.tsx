import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Card — khối nội dung của theme "Sân trường". Phân lớp bằng NỀN TÔ, không
// viền, không bóng (docs/design/ui-refactor-san-truong-design.md §4).
//
//   tint    nền xanh nhạt (`--surface`) — thẻ mặc định trên nền trắng.
//   plain   nền trắng — khi thẻ nằm TRÊN một khối đã tô (thẻ trong thẻ), hoặc
//           cần nổi lên khỏi nền surface của trang.
//   sun     nền vàng nhẹ — MỘT khối nhấn mỗi màn hình (gợi ý luyện tiếp, đang
//           làm dở). Dùng hai lần trên một màn là vàng hết nghĩa "nhấn".
//   outline viền mảnh trên nền trắng — chỉ cho trạng thái rỗng/nét đứt.
const cardVariants = cva("flex flex-col rounded-card", {
  variants: {
    variant: {
      tint: "bg-surface text-foreground",
      plain: "bg-card text-card-foreground",
      sun: "bg-sun-soft text-foreground",
      outline: "border-border bg-background text-foreground border",
    },
    padding: {
      default: "gap-3 p-4 sm:p-5",
      compact: "gap-2 p-3 sm:p-4",
      none: "",
    },
  },
  defaultVariants: { variant: "tint", padding: "default" },
});

// `ref` bỏ khỏi props: thẻ là polymorphic (`as`), một ref kiểu HTMLDivElement
// không gán được cho <li>. Chỗ nào cần ref thì bọc thêm một lớp.
type CardProps = React.HTMLAttributes<HTMLElement> &
  VariantProps<typeof cardVariants> & {
    /** `li` cho thẻ trong danh sách, `section`/`article` cho khối có tiêu đề riêng. */
    as?: "div" | "li" | "section" | "article";
  };

function Card({ as: Tag = "div", variant, padding, className, ...props }: CardProps) {
  return (
    <Tag data-slot="card" className={cn(cardVariants({ variant, padding }), className)} {...props} />
  );
}

export { Card, cardVariants };
