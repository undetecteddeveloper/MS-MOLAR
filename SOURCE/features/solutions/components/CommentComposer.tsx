"use client";

// CommentComposer — ô soạn bình luận + ô "Ẩn danh" + nút gửi (UI Spec §
// Component: CommentComposer; AC-069, S18, S4, UI-D12).
//
// COMPONENT ĐIỀU KHIỂN THUẦN: `value`/`isAnonymous`/`sending`/`error` sống ở
// `CommentSheet` (không phải ở đây), cùng lý do `NoteSheet` giữ `draft` thay
// vì để `NoteEditor` tự quản — hộp thoại đóng-khi-chưa-lưu (`ConfirmDialog`
// "Lưu") cần gửi ĐÚNG bản nháp đang gõ mà không đi qua một ref bắt buộc.
//
// `lockedAnonymous` (S4/UI-D12): ô luôn hiện CHECKED + `aria-disabled="true"`
// (KHÔNG `disabled` gốc — UI-D12), và `onChange` bỏ qua mọi thao tác khi bị
// khoá — giá trị gửi đi luôn `true` bất kể người dùng bấm gì vào ô đã khoá.
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { t } from "@/lib/copy";

export interface CommentComposerProps {
  value: string;
  onChange: (value: string) => void;
  isAnonymous: boolean;
  onAnonymousChange: (checked: boolean) => void;
  /** Viết từ bài giải ẩn danh của chính mình (S4) — ô luôn khoá bật, không
   *  bao giờ suy từ tên hiển thị của người xem (header ẩn danh không mang tên). */
  lockedAnonymous: boolean;
  sending: boolean;
  /** Dòng `role="alert"` — cùng ô hiển thị cho generic/rateLimited/empty/tooLong. */
  error: string | null;
  onSend: () => void;
}

export function CommentComposer({
  value,
  onChange,
  isAnonymous,
  onAnonymousChange,
  lockedAnonymous,
  sending,
  error,
  onSend,
}: CommentComposerProps) {
  const textareaId = useId();
  const errorId = useId();
  const lockedDescId = useId();

  const checked = lockedAnonymous || isAnonymous;

  return (
    <div className="sticky bottom-0 flex flex-col gap-2 bg-background pt-2">
      <Textarea
        id={textareaId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("solutions.comments.placeholder")}
        disabled={sending}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? errorId : undefined}
      />

      {error && (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={checked}
            aria-disabled={lockedAnonymous || undefined}
            aria-describedby={lockedAnonymous ? lockedDescId : undefined}
            onChange={() => {
              if (lockedAnonymous || sending) return;
              onAnonymousChange(!isAnonymous);
            }}
          />
          {t("solutions.comments.anonymousLabel")}
        </label>

        <Button
          type="button"
          aria-busy={sending || undefined}
          aria-disabled={sending || undefined}
          onClick={() => {
            if (!sending) onSend();
          }}
        >
          {sending ? t("common.sending") : t("solutions.comments.send")}
        </Button>
      </div>

      {lockedAnonymous && (
        <p id={lockedDescId} className="text-muted-foreground text-xs">
          {t("solutions.comments.anonymousLocked")}
        </p>
      )}
    </div>
  );
}
