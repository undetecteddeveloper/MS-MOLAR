"use client";

// TicketStatusControl — đổi status ticket. changeTicketStatusAction(ticketId,
// nextStatus) là 2 tham số PHẲNG (task-13), không khớp trực tiếp khuôn
// useActionState (prevState, formData) — statusFormAction là adapter cục bộ
// bắc cầu hai hình dạng đó (frontend DD Fact Disposition Table).

import { useActionState } from "react";
import { changeTicketStatusAction } from "./actions";
import type { TicketActionState, TicketStatus } from "@/lib/support/types";
import { useT } from "@/lib/i18n/client";

const STATUSES: readonly TicketStatus[] = ["new", "in_progress", "resolved"];

async function statusFormAction(
  _prev: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const status = String(formData.get("status") ?? "") as TicketStatus;
  return changeTicketStatusAction(ticketId, status);
}

export function TicketStatusControl({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
  const t = useT();
  const [state, formAction, pending] = useActionState<TicketActionState, FormData>(
    statusFormAction,
    null
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <select
        name="status"
        defaultValue={status}
        disabled={pending}
        className="border-border bg-background rounded-md border px-2 py-1.5 text-sm disabled:opacity-50"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(
              s === "new"
                ? "support.admin.status.new"
                : s === "in_progress"
                  ? "support.admin.status.inProgress"
                  : "support.admin.status.resolved"
            )}
          </option>
        ))}
      </select>
      {/* disabled (native), mirror ModerationRow.tsx's own convention exactly
          — this admin surface's precedent uses native disabled, not aria-disabled. */}
      <button
        type="submit"
        disabled={pending}
        className="border-border hover:border-brand rounded-md border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
      >
        {pending ? t("common.working") : t("common.save")}
      </button>
      {state?.error && (
        <p role="alert" className="text-brand text-xs">
          {state.error}
        </p>
      )}
    </form>
  );
}
