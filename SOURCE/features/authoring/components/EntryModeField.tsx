"use client";

// EntryModeField — chọn Tự động/Thủ công. v2.2 (ADR-0007): control đã THÀNH
// THẬT — Automatic: metadata để trống được, AI đọc từ trang 1 file đề, gate
// chuyển sang publish; Manual: hành vi v2.1 (nhập tay, validate trước mọi AI
// call). Đổi mode KHÔNG BAO GIỜ xoá giá trị đã gõ — giá trị tác giả gõ luôn
// thắng AI (normalizeMeta).
//
// Theme "Sân trường" (2026-09-09): hai viên thuốc (primitive Chip) thay hộp thả
// xuống. Hai lựa chọn thì nhìn thấy cả hai cùng lúc là đúng hơn giấu một cái
// sau mũi tên; và đây là cùng ngôn ngữ với Tuần/Tháng ở Thống kê, Tất cả/Toán
// ở Lịch sử — luôn đúng một viên đậm. Dòng ghi chú dưới đổi theo lựa chọn,
// tỏ dần bằng `.motion-unfold` (không trượt cao — §7).

import { Chip } from "@/components/ui/chip";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import type { EntryMode } from "@/lib/ugc/types";

export type { EntryMode };

const NOTE_KEY: Record<EntryMode, MessageKey> = {
  automatic: "upload.automaticNote",
  manual: "upload.manualNote",
};

const MODES: { value: EntryMode; labelKey: MessageKey }[] = [
  { value: "automatic", labelKey: "upload.automatic" },
  { value: "manual", labelKey: "upload.manual" },
];

export function EntryModeField({
  value,
  onChange,
  disabled,
}: {
  value: EntryMode;
  onChange: (mode: EntryMode) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p id="entry-mode-label" className="text-foreground mb-1.5 text-sm font-medium">
        {t("upload.entryMode")}
      </p>
      <div role="group" aria-labelledby="entry-mode-label" className="flex flex-wrap gap-2">
        {MODES.map((m) => (
          <Chip
            key={m.value}
            active={value === m.value}
            onClick={() => onChange(m.value)}
            disabled={disabled}
          >
            {t(m.labelKey)}
          </Chip>
        ))}
      </div>
      <p
        key={value}
        aria-live="polite"
        className="motion-unfold text-muted-foreground mt-2 max-w-prose text-sm leading-relaxed"
      >
        {t(NOTE_KEY[value])}
      </p>
    </div>
  );
}
