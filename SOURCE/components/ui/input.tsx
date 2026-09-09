import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

// Input — ô nhập chuẩn của theme "Sân trường" (docs/design/ui-refactor-san-truong-design.md §2).
//
// Cao 44px (sàn vùng chạm), bo `rounded-xl`, viền `--input` (#6f8d78 — đạt
// 3,6:1 trên trắng, WCAG 1.4.11; viền trang trí `--border` KHÔNG đủ tương phản
// cho ranh giới một ô nhập). Tiêu điểm: viền chuyển xanh + vòng ring mờ.
//
// Thuần <input>, không qua base-ui: không có hành vi nào cần primitive, và
// mọi form của repo đều dùng Server Action với `name=` — một <input> thật là
// đúng thứ FormData cần.
//
// `fieldClass` là MỘT bộ lớp cho cả ba loại ô (input / textarea / select): ba
// ô đứng cạnh nhau trong một form phải cùng cao, cùng viền, cùng bo góc, và
// cách duy nhất để chúng không lệch nhau theo thời gian là chỉ có một chỗ khai.
const fieldClass = cn(
  "border-input bg-background text-foreground placeholder:text-muted-foreground/80 w-full min-w-0 rounded-xl border text-base outline-none transition-[color,border-color,box-shadow]",
  "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-3",
  "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3",
  "disabled:pointer-events-none disabled:opacity-50"
);

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldClass,
        "h-11 px-4",
        // Ô chọn file: bỏ viền nút mặc định của trình duyệt.
        "file:text-foreground file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium",
        className
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldClass, "min-h-28 px-4 py-3", className)}
      {...props}
    />
  );
}

/** Ô chọn — cùng vỏ với Input, mũi tên vẽ bằng icon vì mũi tên mặc định của
 *  trình duyệt không theo màu/cỡ nào của theme. `wrapperClassName` cho bề rộng
 *  (ô chọn nằm trong lưới hoặc hàng flex); `className` cho chính <select>. */
function Select({
  className,
  wrapperClassName,
  ...props
}: React.ComponentProps<"select"> & { wrapperClassName?: string }) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <select
        data-slot="select"
        className={cn(fieldClass, "h-11 appearance-none truncate pr-10 pl-4", className)}
        {...props}
      />
      <ChevronDown
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2"
      />
    </div>
  );
}

/** Nhãn của ô nhập — 14px, đậm vừa, đặt TRÊN ô (không dùng placeholder làm
 *  nhãn: placeholder biến mất khi gõ, người dùng quên mình đang điền gì). */
function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn("text-foreground mb-1.5 block text-sm font-medium", className)}
      {...props}
    />
  );
}

export { Input, Textarea, Select, Label };
