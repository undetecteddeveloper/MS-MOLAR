import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Button — theme "Sân trường" (docs/design/ui-refactor-san-truong-design.md §2).
//
// Hình dạng mặc định là VIÊN THUỐC (`shape: pill`): nút hành động bo tròn
// tuyệt đối đặt cạnh thẻ nội dung bo 18px — chính sự đối lập hình học đó kéo
// mắt về hành động, nên không cần bôi màu rực. `shape: default` (bo 14px) chỉ
// cho nút nằm trong một nhóm phân đoạn hoặc ô lưới.
//
// Cỡ: `default` 44px là SÀN vùng chạm (Mobile-Layout-Research §4.3) — trước
// đây Button cao 32px và mọi đích chạm trong repo phải tự override. `lg` 52px
// cho hành động chính DUY NHẤT của một màn hình. `sm` 36px cho nút trong thẻ.
//
// Trạng thái: hover/active đổi NỀN (tối thêm 8%), không đổi hình, không bóng.
// Phản hồi bấm (2026-09-08): co 3% trong 150ms lúc `:active` — giao diện
// "nghe thấy" cú bấm ngay cả khi mạng chưa trả lời. `link` không co: chữ
// gạch chân co lại trông như lỗi. Tắt khi giảm chuyển động (motion-safe).
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-[color,background-color,border-color,scale] ease-out outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_10%)] active:bg-[color-mix(in_oklch,var(--primary),black_16%)]",
        secondary:
          "bg-surface text-foreground hover:bg-[color-mix(in_oklch,var(--surface),var(--foreground)_7%)] aria-expanded:bg-[color-mix(in_oklch,var(--surface),var(--foreground)_7%)]",
        outline:
          "border-border bg-background text-foreground hover:bg-surface aria-expanded:bg-surface",
        // Trắng — cho nút nằm TRÊN một khối đã tô (thẻ surface, thẻ vàng): cùng
        // vai trò với `plain` của Card và Badge.
        plain:
          "bg-card text-foreground hover:bg-[color-mix(in_oklch,var(--card),var(--foreground)_6%)] aria-expanded:bg-[color-mix(in_oklch,var(--card),var(--foreground)_6%)]",
        ghost: "text-foreground hover:bg-surface aria-expanded:bg-surface",
        // Vàng nắng — MỘT nút mỗi màn hình, và luôn kèm chữ đen (vàng không đủ
        // tương phản để tự nó mang thông tin).
        sun: "bg-sun text-foreground hover:bg-[color-mix(in_oklch,var(--sun),black_8%)]",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/15 focus-visible:ring-destructive/25",
        link: "text-primary h-auto px-0 underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-11 px-5 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        xs: "h-8 gap-1 px-3 text-xs [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-9 gap-1.5 px-4 text-sm",
        lg: "h-13 px-6 text-base [&_svg:not([class*='size-'])]:size-5",
        icon: "size-11",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-3.5",
        "icon-sm": "size-9",
        "icon-lg": "size-13 [&_svg:not([class*='size-'])]:size-5",
      },
      shape: {
        pill: "rounded-full",
        default: "rounded-lg",
      },
    },
    compoundVariants: [
      {
        variant: ["default", "secondary", "outline", "plain", "ghost", "sun", "destructive"],
        className: "motion-safe:active:scale-97",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "pill",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  shape = "pill",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, shape, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
