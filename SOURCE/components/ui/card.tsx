import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Card — khối nội dung của theme "Đêm hội". Phân lớp bằng NỀN TÔ + ÁNH SÁNG
// (docs/design/ui-refactor-san-truong-design.md §4).
//
// NỀN TỐI (2026-09-14): nền trang #070f0c và nền thẻ #101e18 chỉ chênh nhau
// 1,1:1 — nền tô một mình KHÔNG còn tách được lớp như ở bản nền sáng. Nên mọi
// biến thể đều mang `.glow-card`: một gờ sáng ở mép trên + viền sáng mảnh.
// Bóng lấy từ TỪ VỰNG ÁNH SÁNG trong globals.css, không viết box-shadow ở đây.
//
//   tint    nền xanh đêm (`--surface`) — thẻ mặc định trên nền trang.
//   plain   nền sáng hơn một nấc (`--card`) — khi thẻ nằm TRÊN một khối đã tô
//           (thẻ trong thẻ), hoặc cần nổi lên khỏi nền surface của trang. Bản
//           nền sáng dùng TRẮNG cho vai trò này; nền tối đi lên một nấc thay
//           vì đi tới trắng, nhưng vẫn là cùng một token.
//   sun     nền hổ phách sẫm — MỘT khối nhấn mỗi màn hình (gợi ý luyện tiếp,
//           đang làm dở). Dùng hai lần trên một màn là vàng hết nghĩa "nhấn".
//   outline viền mảnh trên nền trang — chỉ cho trạng thái rỗng/nét đứt; đây là
//           biến thể DUY NHẤT không phát sáng, vì nó cố ý đọc như "chưa có gì".
const cardVariants = cva("flex flex-col rounded-card", {
  variants: {
    variant: {
      tint: "bg-surface text-foreground glow-card",
      plain: "bg-card text-card-foreground glow-card",
      sun: "bg-sun-soft text-foreground glow-card",
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
