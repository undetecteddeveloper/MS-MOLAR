"use client";

// InternalNotesPanel — danh sách ghi chú nội bộ + form thêm mới.
// addTicketNoteAction(ticketId, noteText) là 2 tham số PHẲNG (task-13);
// noteFormAction là adapter cục bộ bắc cầu sang khuôn useActionState
// (prevState, formData), cùng mẫu với statusFormAction.

import { useActionState } from "react";
import { addTicketNoteAction } from "@/features/admin/ticketActions";
import type { TicketActionState } from "@/lib/support/types";
import { useT } from "@/lib/i18n/client";

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
  const t = useT();
  const [state, formAction, pending] = useActionState<TicketActionState, FormData>(
    noteFormAction,
    null
  );

  return (
    <form action={formAction} className="mt-3 flex flex-col gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <textarea
        name="noteText"
        rows={2}
        placeholder={t("support.admin.notePlaceholder")}
        className="border-border bg-background rounded-md border p-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="border-border hover:border-brand rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {pending ? t("common.working") : t("support.admin.noteSubmit")}
        </button>
        {state?.error && (
          <p role="alert" className="text-brand text-xs">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}

export function InternalNotesPanel({ ticketId, notes }: { ticketId: string; notes: InternalNote[] }) {
  const t = useT();
  return (
    <div className="border-border mt-4 border-t pt-4">
      {notes.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("support.admin.notesEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((note) => (
            <li key={note.id} className="bg-card rounded-md p-2 text-sm">
              <p className="whitespace-pre-wrap">{note.noteText}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {note.adminId ?? "—"} · {new Date(note.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
      <InternalNoteForm ticketId={ticketId} />
    </div>
  );
}
