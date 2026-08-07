"use client";

// PublishBar — thanh hành động màn review (UI Spec §PublishBar / Task 6.4).
// Đề chưa published: "Save changes" (lưu nháp) + "Publish" (disabled tới khi
// sạch). Đề đã published: "Save changes" (validate trước khi ghi). Luôn có
// Delete. Trạng thái saving/publishing + thông báo lỗi.

import { useT } from "@/lib/i18n/client";
import { DeleteDialog } from "./DeleteDialog";

interface PublishBarProps {
  isPublished: boolean;
  canPublish: boolean;
  saving: boolean;
  publishing: boolean;
  dirty: boolean;
  error: string | null;
  examId: string;
  examTitle: string;
  onSave: () => void;
  onPublish: () => void;
}

export function PublishBar({
  isPublished,
  canPublish,
  saving,
  publishing,
  dirty,
  error,
  examId,
  examTitle,
  onSave,
  onPublish,
}: PublishBarProps) {
  const t = useT();
  const busy = saving || publishing;
  return (
    <div className="sticky bottom-0 -mx-6 border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
      {error && (
        <p role="alert" className="mb-3 text-sm text-brand">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-4">
        <DeleteDialog examId={examId} examTitle={examTitle} />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSave}
            disabled={busy || (!dirty && isPublished)}
            className="rounded-[4px] border border-border px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-accent disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("upload.saveChanges")}
          </button>

          {!isPublished && (
            <button
              type="button"
              onClick={onPublish}
              disabled={!canPublish || busy}
              title={canPublish ? undefined : t("upload.fixIssuesFirst")}
              className="rounded-[4px] bg-brand px-6 py-2 text-xs font-medium uppercase tracking-[0.14em] text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {publishing ? t("upload.publishing") : t("upload.publish")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
