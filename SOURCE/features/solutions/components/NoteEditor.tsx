"use client";

// NoteEditor — ô nhập ghi chú + bộ đếm từ + nút "Xem trước công thức" (UI
// Spec § Component: NoteEditor; AC-023, AC-026, R22).
//
// Đếm từ dùng ĐÚNG `countWords()` mà server gọi (`lib/solutions/countWords.ts`,
// task 04) — không viết lại regex riêng (AC-023: "bộ đếm ở giao diện và phép
// đếm ở server cho cùng kết quả trên cùng chuỗi").
import { Check } from "lucide-react";
import { Textarea } from "@/components/ui/input";
import { t } from "@/lib/copy";
import { countWords } from "@/lib/solutions/countWords";
import { cn } from "@/lib/utils";
import { FormulaPreview } from "@/features/solutions/components/FormulaPreview";

/** `community_solution_notes_body_length_check` (backend DD, không dưới 5.000
 *  ký tự) — con số PINNED là 8.000 (§ Note-authoring contract "note max length
 *  is 8000 characters"). KHÔNG BAO GIỜ cắt chữ phía client — chỉ báo còn bao
 *  nhiêu, server là nguồn thật (AC-026). */
const MAX_LENGTH = 8000;
/** "Gần giới hạn ký tự" — đổi bộ đếm khi còn ≤ 10% giới hạn (UI Spec § NoteEditor). */
const CHARS_LEFT_THRESHOLD = MAX_LENGTH * 0.1;
const WORD_GOAL = 15;

export interface NoteEditorProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  describedById?: string;
  autoFocus?: boolean;
}

export function NoteEditor({
  id,
  value,
  onChange,
  disabled,
  invalid,
  describedById,
  autoFocus,
}: NoteEditorProps) {
  const wordCount = countWords(value);
  const remaining = MAX_LENGTH - value.length;
  const reachedGoal = wordCount >= WORD_GOAL;
  const nearCharLimit = remaining <= CHARS_LEFT_THRESHOLD;

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("solutions.note.placeholder")}
        rows={5}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        aria-describedby={describedById}
        autoFocus={autoFocus}
      />
      <div className="text-muted-foreground flex items-center justify-between gap-3 text-xs">
        <span className={cn("flex items-center gap-1 tabular-nums", reachedGoal && "text-primary")}>
          {nearCharLimit
            ? t("solutions.note.charsLeft", { remaining })
            : t("solutions.note.counter", { count: wordCount })}
          {reachedGoal && <Check aria-hidden className="size-3.5" />}
        </span>
      </div>
      <FormulaPreview text={value} />
    </div>
  );
}
