import * as React from "react";

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
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "border-input bg-background text-foreground placeholder:text-muted-foreground/80 h-11 w-full min-w-0 rounded-xl border px-4 text-base outline-none transition-[color,border-color,box-shadow]",
        "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-3",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3",
        "disabled:pointer-events-none disabled:opacity-50",
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
      className={cn(
        "border-input bg-background text-foreground placeholder:text-muted-foreground/80 min-h-28 w-full min-w-0 rounded-xl border px-4 py-3 text-base outline-none transition-[color,border-color,box-shadow]",
        "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-3",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:ring-3",
        "disabled:pointer-events-none disabled:opacity-50",
        className
      )}
      {...props}
    />
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

export { Input, Textarea, Label };
