"use client";

// NoteQuestionRow — một hàng câu ở màn viết bài giải (UI Spec `C-13`, UI-D7).
// Bốn trạng thái, mỗi trạng thái mang cả KÝ HIỆU lẫn CHỮ — không màu đơn
// thuần (AC-050): Đã ghi chú / Chưa ghi chú / Chưa đủ 15 từ / Câu hỏi đã thay
// đổi. Bấm hàng mở tấm trượt ghi chú của câu đó (`NoteSheet`, task 11); hàng
// tự nó không lưu gì, không fetch gì — state và lượt lưu là việc của
// `SolutionEditorScreen` (task 10).
//
// `NOTE_ROW_ICON`/`NOTE_ROW_LABEL_KEY` và `noteRowCellLabel()` xuất ra đây vì
// `SolutionEditorHeader` dùng LẠI đúng bảng tra này khi dựng `cells[]` cho
// `QuestionPaletteDock` (UI-D26) — một bảng tra duy nhất cho hai bề mặt, thay
// vì hai bản chép có thể lệch nhau (Refactor phase của task 09).

import { Check, ChevronRight, Minus, RefreshCw, type LucideIcon } from "lucide-react";
import { t, type MessageKey } from "@/lib/copy";
import { cn } from "@/lib/utils";

export type NoteRowState = "noted" | "missing" | "short" | "changed";

export const NOTE_ROW_ICON: Record<NoteRowState, LucideIcon> = {
  noted: Check,
  missing: Minus,
  short: Minus,
  changed: RefreshCw,
};

export const NOTE_ROW_LABEL_KEY: Record<NoteRowState, MessageKey> = {
  noted: "solutions.row.noted",
  missing: "solutions.row.missing",
  short: "solutions.row.short",
  changed: "solutions.row.changed",
};

/** Tên trợ năng đầy đủ của một ô bảng câu hỏi màn viết (UI-D26): "Câu k,
 *  <trạng thái viết thường>" — ký tự đầu của chữ trạng thái hạ xuống thường
 *  vì đây là mệnh đề sau dấu phẩy, không phải câu mở đầu như khi hàng câu
 *  hiển thị chữ đó một mình. */
export function noteRowCellLabel(state: NoteRowState, questionNumber: number): string {
  const text = t(NOTE_ROW_LABEL_KEY[state]);
  const lower = text.length === 0 ? text : text[0].toLowerCase() + text.slice(1);
  return `${t("upload.questionLabel", { number: questionNumber })}, ${lower}`;
}

interface NoteQuestionRowProps {
  questionNumber: number;
  state: NoteRowState;
  /** Trích dòng đầu ghi chú — chỉ truyền khi ghi chú đã có chữ (UI Spec: dòng
   *  trích chỉ hiện khi có nội dung; trạng thái "missing" không có gì để trích). */
  excerpt?: string;
  onOpen: () => void;
}

export function NoteQuestionRow({ questionNumber, state, excerpt, onOpen }: NoteQuestionRowProps) {
  const Icon = NOTE_ROW_ICON[state];
  const label = t(NOTE_ROW_LABEL_KEY[state]);
  const changed = state === "changed";

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={noteRowCellLabel(state, questionNumber)}
        className="flex min-h-14 w-full items-center gap-2.5 py-2 text-left"
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full",
            changed ? "bg-sun-soft" : "bg-surface"
          )}
        >
          <Icon
            aria-hidden
            className={cn(
              "size-3.5",
              state === "noted" ? "text-primary" : changed ? "text-foreground" : "text-muted-foreground"
            )}
          />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold">
              {t("upload.questionLabel", { number: questionNumber })}
            </span>
            <span className={cn("text-xs", changed ? "text-foreground" : "text-muted-foreground")}>
              {label}
            </span>
          </span>
          {excerpt && (
            <span className="text-muted-foreground block truncate text-xs">{excerpt}</span>
          )}
        </span>
        <ChevronRight aria-hidden className="text-muted-foreground size-4 shrink-0" />
      </button>
    </li>
  );
}
