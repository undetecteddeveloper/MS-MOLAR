"use client";

// InternalNotesPanel — danh sách ghi chú nội bộ + form thêm mới.
// addTicketNoteAction(ticketId, noteText) là 2 tham số PHẲNG (task-13);
// noteFormAction là adapter cục bộ bắc cầu sang khuôn useActionState
// (prevState, formData), cùng mẫu với statusFormAction.
//
// Theme "Sân trường" (2026-09-10): tiêu đề nhỏ + mỗi ghi chú một thẻ TRẮNG con;
// ô nhập là primitive Textarea, nút Lưu ghi chú 36px. Ngày giờ qua bộ định
// dạng chung ghim Asia/Ho_Chi_Minh (bản trước `toLocaleString()` theo giờ
// máy). Meta tách bằng khoảng cách, không dấu chấm giữa (§5).

import { useActionState, useId } from "react";
import { addTicketNoteAction } from "@/features/admin/ticketActions";
import type { TicketActionState } from "@/lib/support/types";
import { t } from "@/lib/copy";
import { formatDateTime } from "@/lib/format/datetime";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label, Textarea } from "@/components/ui/input";

interface InternalNote {
  id: string;
  noteText: string;
  adminId: string | null;
  createdAt: string;
}

async function noteFormAction(_prev: TicketActionState, formData: FormData): Promise<TicketActionState> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const noteText = String(formData.get("noteText") ?? "");
  return addTicketNoteAction(ticketId, noteText);
}

function InternalNoteForm({ ticketId }: { ticketId: string }) {
  const [state, formAction, pending] = useActionState<TicketActionState, FormData>(
    noteFormAction,
    null
  );
  const textareaId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      {/* Nhãn sr-only: tiêu đề "Ghi chú nội bộ" ngay trên đã nói ô này để làm
          gì cho người nhìn; trình đọc màn hình vẫn cần một nhãn gắn với ô. */}
      <Label htmlFor={textareaId} className="sr-only">
        {t("support.admin.noteLabel")}
      </Label>
      <Textarea
        id={textareaId}
        name="noteText"
        rows={2}
        placeholder={t("support.admin.notePlaceholder")}
        className="min-h-20"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className={buttonVariants({ variant: "plain", size: "sm" })}
        >
          {pending ? t("common.working") : t("support.admin.noteSubmit")}
        </button>
        {state?.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

export function InternalNotesPanel({ ticketId, notes }: { ticketId: string; notes: InternalNote[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{t("support.admin.notesTitle")}</h3>
      {notes.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("support.admin.notesEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <Card key={note.id} as="li" variant="plain" padding="compact" className="gap-1">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{note.noteText}</p>
              <p className="text-muted-foreground flex flex-wrap gap-x-3 text-xs tabular-nums">
                <span className="break-all">{note.adminId ?? "—"}</span>
                <span>{formatDateTime(note.createdAt)}</span>
              </p>
            </Card>
          ))}
        </ul>
      )}
      <InternalNoteForm ticketId={ticketId} />
    </div>
  );
}
