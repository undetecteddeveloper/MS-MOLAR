"use client";

// TicketQueueRow — dòng thu gọn (mirror ModerationRow.tsx's card shell) +
// mở rộng lộ TicketDetailPanel. expanded là useState CỤC BỘ, KHÔNG persist
// (không URL param, không localStorage) — không có yêu cầu PRD/UI-Spec nào
// đòi trạng thái này sống qua reload (frontend DD State Transitions).

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import type { TicketWithNotes } from "@/lib/supabase/service-role";
import type { TicketIntent } from "@/lib/support/types";
import { TicketStatusBadge } from "./TicketStatusBadge";
import { NotificationFailureFlag } from "./NotificationFailureFlag";
import { TicketDetailPanel } from "./TicketDetailPanel";

const INTENT_LABEL_KEY: Record<TicketIntent, MessageKey> = {
  bug: "support.intent.bug",
  suggestion: "support.intent.suggestion",
  question: "support.intent.question",
};

export function TicketQueueRow({ ticket }: { ticket: TicketWithNotes }) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-border bg-card rounded-lg border px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-medium tracking-wide uppercase">
            {t(INTENT_LABEL_KEY[ticket.intent])}
          </span>
          <span className="truncate text-sm">{ticket.message}</span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {ticket.screenshotUrl && <span aria-hidden>📎</span>}
          {ticket.notifyFailed && <NotificationFailureFlag />}
          <TicketStatusBadge status={ticket.status} />
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {new Date(ticket.createdAt).toLocaleDateString()}
          </span>
        </div>
      </button>

      {expanded && <TicketDetailPanel ticket={ticket} />}
    </div>
  );
}
