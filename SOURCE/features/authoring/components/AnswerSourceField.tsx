"use client";

// AnswerSourceField — chặng 2 của trang Tải đề lên: đáp án NẰM TRONG FILE ĐỀ hay
// ở FILE RIÊNG (2026-09-13, engineer: đề sưu tầm thường in sẵn đáp án ở cuối;
// bắt tách ra file riêng là bắt làm thêm một việc). Hai viên thuốc (primitive
// Chip) như EntryModeField — luôn đúng một viên đậm — và dòng ghi chú đổi theo
// lựa chọn, tỏ dần bằng `.motion-unfold`. Ô thả file đáp án do UploadForm dựng
// ngay dưới khi chọn "File riêng"; component này chỉ giữ lựa chọn.

import { Chip } from "@/components/ui/chip";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import type { AnswerSource } from "@/lib/ugc/types";

export type { AnswerSource };

const NOTE_KEY: Record<AnswerSource, MessageKey> = {
  "in-exam": "upload.answerInExamNote",
  separate: "upload.answerSeparateNote",
};

const SOURCES: { value: AnswerSource; labelKey: MessageKey }[] = [
  { value: "in-exam", labelKey: "upload.answerInExam" },
  { value: "separate", labelKey: "upload.answerSeparate" },
];

export function AnswerSourceField({
  value,
  onChange,
  disabled,
}: {
  value: AnswerSource;
  onChange: (source: AnswerSource) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <div role="group" aria-label={t("upload.stepAnswers")} className="flex flex-wrap gap-2">
        {SOURCES.map((s) => (
          <Chip
            key={s.value}
            active={value === s.value}
            onClick={() => onChange(s.value)}
            disabled={disabled}
          >
            {t(s.labelKey)}
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
