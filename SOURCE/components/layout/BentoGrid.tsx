// BentoGrid — lưới bất đối xứng kiểu "hộp bento" (docs/market/
// UI-Design-Research.md §2: CSS Grid cho khung tổng, Flexbox cho căn chỉnh bên
// trong ô, sụp về MỘT cột ở viewport hẹp).
//
// Điểm mấu chốt về trợ năng: thứ tự DOM là thứ tự đọc. Ô nào quan trọng hơn thì
// đặt TRƯỚC trong JSX rồi cho nó span rộng ra — tuyệt đối không dùng
// `order-*`/`grid-row-start` để kéo một ô lên trên về mặt thị giác, vì làm vậy
// thứ tự đọc bằng bàn phím và trình đọc màn hình sẽ lệch khỏi thứ tự nhìn thấy
// (WCAG 1.3.2 Meaningful Sequence + 2.4.3 Focus Order).

import { cn } from "@/lib/utils";

/** Khung lưới. 12 cột ở desktop → 1 cột dưới `sm` (tài liệu: dưới ~600px các
 *  khối xếp chồng dọc, giữ nguyên thứ bậc thông tin).
 *  `as`: đổi thẻ bọc khi lưới cũng mang ngữ nghĩa — vd `dl` cho một bảng thuộc
 *  tính. Bố cục không được phép làm mất ngữ nghĩa của nội dung. */
// React.HTMLAttributes<HTMLElement> chứ không phải ComponentProps<"div">: khi
// `as` đổi sang dl/ul thì kiểu của `ref` đi kèm ComponentProps<"div"> (tức
// HTMLDivElement) không còn khớp phần tử thật (HTMLDListElement…). Dùng thuộc
// tính không gắn với một phần tử cụ thể là cách diễn đạt đúng cho component
// đa hình.
export function BentoGrid({
  as: Tag = "div",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "dl" | "ul" | "section" }) {
  return <Tag className={cn("grid grid-cols-1 gap-4 sm:grid-cols-12", className)} {...props} />;
}

/** Bề rộng ô theo số cột (trên lưới 12). `half` = 6 cột, `third` = 4, v.v.
 *  Giữ tên theo tỉ lệ thay vì con số để chỗ gọi đọc ra ý đồ bố cục. */
const SPAN = {
  full: "sm:col-span-12",
  half: "sm:col-span-6",
  third: "sm:col-span-4",
  twoThirds: "sm:col-span-8",
  quarter: "sm:col-span-3",
  threeQuarters: "sm:col-span-9",
} as const;

export type BentoSpan = keyof typeof SPAN;

export function BentoCell({
  as: Tag = "div",
  span = "half",
  className,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "li" | "section"; span?: BentoSpan }) {
  return (
    <Tag
      className={cn(
        // Chiều sâu bằng VIỀN + màu bề mặt, không bằng đổ bóng — quy tắc
        // "Minimal Elevation" của tài liệu và cũng là quy tắc sẵn có của theme.
        // rounded-[--radius-card]: giữ họ hình sắc cạnh của thẻ, tách bạch với
        // nút viên thuốc (--radius-pill).
        "border-border bg-card flex min-w-0 flex-col rounded-[var(--radius-card)] border p-5",
        SPAN[span],
        className
      )}
      {...props}
    />
  );
}
