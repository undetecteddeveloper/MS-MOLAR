// PageContainer — hệ bề rộng trang kiểu Supabase Studio (small | default |
// full), theo docs/market/UI-Design-Research.md §2 "Kiến Trúc Bố Cục".
//
// Vấn đề nó giải: trước đây mỗi trang tự viết `mx-auto w-full max-w-3xl px-6
// py-10`, và các nấc 2xl/3xl/4xl/6xl được chọn rời rạc theo từng lần code —
// hai trang cùng cấp nội dung lại rộng khác nhau, padding cũng lệch. Sau thay
// đổi này, bề rộng là một QUYẾT ĐỊNH THIẾT KẾ có tên gọi chứ không phải con số
// gõ tay, và `--scaffold-*` trong globals.css là nơi duy nhất định nghĩa nó.
//
// Nguyên tắc chọn nấc:
//   small   luồng một-tác-vụ, đọc là chính — kết quả bài làm, form đánh giá.
//           Hẹp để dòng văn không quá dài (nhịp đọc), giống "interstitial" của
//           Primer nhưng không cực đoan tới mức bỏ điều hướng.
//   default trang nội dung tiêu chuẩn — upload, đề của tôi, admin.
//   full    lưới dữ liệu dày — danh sách đề, dashboard bento. Khớp đúng
//           max-w-6xl của SiteHeader nên mép nội dung thẳng hàng mép navbar.

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const containerVariants = cva("mx-auto w-full", {
  variants: {
    size: {
      small: "max-w-[var(--scaffold-small)]",
      default: "max-w-[var(--scaffold-default)]",
      full: "max-w-[var(--scaffold-full)]",
    },
    // Nhịp padding chung. `none` dành cho trang tự quản lý padding bên trong
    // (vd /exams: cột filter dính mép trái, lưới card tự có padding riêng) —
    // có lối thoát tường minh thì không ai phải lách bằng cách bỏ container.
    padding: {
      default: "px-6 py-10",
      compact: "px-4 py-5",
      none: "",
    },
  },
  defaultVariants: { size: "default", padding: "default" },
});

type PageContainerProps = React.ComponentProps<"div"> &
  VariantProps<typeof containerVariants> & {
    /** Đổi thẻ bọc — mặc định `div`. Dùng `main` cho vùng nội dung chính của
     *  trang; các route group đã có sẵn `#main-content` nên phần lớn trang chỉ
     *  cần `div`. */
    as?: "div" | "main" | "section";
  };

export function PageContainer({
  as: Tag = "div",
  size,
  padding,
  className,
  ...props
}: PageContainerProps) {
  return <Tag className={cn(containerVariants({ size, padding }), className)} {...props} />;
}

export { containerVariants };
