"use client";

// SettingSwitch — một hàng cài đặt bật/tắt: nhãn, dòng phụ, và công tắc
// `<button role="switch">` có chữ "Bật"/"Tắt" cạnh rãnh (UI Spec C-12, UI-D11).
//
// Tự dựng thay vì Switch của @base-ui/react: repo chưa dùng primitive đó ở đâu,
// nên chưa có quy ước test hay chuyển động nào để kế thừa. `role="switch"` +
// `aria-checked` đọc đúng nghĩa "bật/tắt một thiết lập" hơn `aria-pressed`.
//
// KHÔNG HOẠT ẢNH: núm đổi chỗ tức thì. Từ vựng chuyển động của globals.css
// không có lớp nào cho việc này, và không được viết transition tại nơi gọi.
//
// Chỉ đọc = `aria-disabled`, KHÔNG `disabled` gốc: công tắc vẫn nhận Tab để
// trình đọc màn hình đọc được lý do khoá; giữ nguyên độ tương phản (không mờ).
// Đang lưu = `aria-busy` và vẫn bấm được — cú bấm kế tiếp là ý muốn mới nhất,
// hàng đợi lưu ở cha quyết định gửi gì.

import { useId } from "react";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";

interface SettingSwitchProps {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
  description: string;
  /** Id của dòng phụ — công tắc trỏ tới nó qua `aria-describedby`. */
  descriptionId: string;
  disabled?: boolean;
  busy?: boolean;
  /** Id của băng lý do khoá (vd `ModerationReasonBanner`, AC-083) — nơi gọi
   *  của Bài giải cộng đồng truyền khi hàng đang chỉ đọc. Cộng thêm vào
   *  `aria-describedby` sau `descriptionId`, không thay thế nó, để dòng phụ
   *  của chính công tắc vẫn được đọc (frontend DD § Main Components
   *  "Interface addition (v1.3)"). */
  lockReasonId?: string;
}

export function SettingSwitch({
  checked,
  onCheckedChange,
  label,
  description,
  descriptionId,
  disabled = false,
  busy = false,
  lockReasonId,
}: SettingSwitchProps) {
  const labelId = useId();

  return (
    <div className="flex min-h-11 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={labelId} className="text-foreground text-sm font-medium">
          {label}
        </span>
        <p id={descriptionId} className="text-muted-foreground text-xs">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={[descriptionId, lockReasonId].filter(Boolean).join(" ")}
        aria-disabled={disabled || undefined}
        aria-busy={busy || undefined}
        onClick={() => {
          if (!disabled) onCheckedChange(!checked);
        }}
        className="focus-visible:ring-ring/40 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-1 outline-none focus-visible:ring-3"
      >
        <span
          aria-hidden
          className={cn(
            "inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-px",
            checked
              ? "bg-primary justify-end border-transparent"
              : "bg-surface border-input justify-start"
          )}
        >
          <span
            className={cn(
              "size-5 rounded-full",
              checked ? "bg-primary-foreground" : "bg-muted-foreground"
            )}
          />
        </span>
        <span className="text-xs tabular-nums">
          {checked ? t("solutions.switch.on") : t("solutions.switch.off")}
        </span>
      </button>
    </div>
  );
}
