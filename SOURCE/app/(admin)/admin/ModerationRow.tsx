// Admin — một dòng đề bị báo cáo + nút gỡ/khôi phục (Security review #7).
"use client";

import { useActionState } from "react";
import { moderateExamAction, type ModerationState } from "./actions";
import type { ModeratableExam } from "@/lib/supabase/service-role";

export function ModerationRow({ exam }: { exam: ModeratableExam }) {
  const [state, formAction, pending] = useActionState<ModerationState, FormData>(
    moderateExamAction,
    null
  );
  const isRemoved = exam.status === "removed";

  return (
    <form
      action={formAction}
      className="border-border bg-card flex flex-col gap-3 rounded-lg border px-4 py-3"
    >
      <input type="hidden" name="examId" value={exam.id} />
      <input type="hidden" name="action" value={isRemoved ? "restore" : "remove"} />

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium">{exam.title}</span>
          <span className="text-muted-foreground text-xs">
            {exam.reportCount} report{exam.reportCount === 1 ? "" : "s"}
            {exam.authorDisplayName ? ` · by ${exam.authorDisplayName}` : ""} · status:{" "}
            {exam.status}
          </span>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="border-border hover:border-brand shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50"
        >
          {pending ? "Working…" : isRemoved ? "Restore" : "Remove"}
        </button>
      </div>

      {/* Lý do là tuỳ chọn nhưng được ghi vào exam_moderation_log — "vì sao gỡ"
          là thứ cần nhất khi phải giải thích lại sau vài tháng. */}
      <input
        name="reason"
        placeholder={isRemoved ? "Reason for restoring (optional)" : "Reason for removal (optional)"}
        className="border-border bg-background rounded-md border px-3 py-2 text-sm"
      />

      <details className="text-muted-foreground text-xs">
        <summary className="cursor-pointer">Reported reasons</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
          {exam.reasons.map((reason, i) => (
            <li key={i} className="break-words">
              {reason}
            </li>
          ))}
        </ul>
      </details>

      {state?.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state?.info && <p className="text-muted-foreground text-sm">{state.info}</p>}
    </form>
  );
}
