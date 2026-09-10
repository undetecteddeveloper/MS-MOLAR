"use client";

// TicketStatusControl — đổi status ticket. changeTicketStatusAction(ticketId,
// nextStatus) là 2 tham số PHẲNG (task-13), không khớp trực tiếp khuôn
// useActionState (prevState, formData) — statusFormAction là adapter cục bộ
// bắc cầu hai hình dạng đó.
//
// Theme "Sân trường" (2026-09-10): ô chọn là primitive Select (cùng vỏ Input,
// 44px), nút Lưu xanh cùng cao 44px đứng cạnh từ 640px, xếp dọc dưới đó.

import { useActionState, useId } from "react";
import { changeTicketStatusAction } from "@/features/admin/ticketActions";
import type { TicketActionState, TicketStatus } from "@/lib/support/types";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/input";

const STATUSES: readonly TicketStatus[] = ["new", "in_progress", "resolved"];

const STATUS_LABEL_KEY: Record<TicketStatus, MessageKey> = {
  new: "support.admin.status.new",
  in_progress: "support.admin.status.inProgress",
  resolved: "support.admin.status.resolved",
};

async function statusFormAction(
  _prev: TicketActionState,
  formData: FormData
): Promise<TicketActionState> {
  const ticketId = String(formData.get("ticketId") ?? "");
  const status = String(formData.get("status") ?? "") as TicketStatus;
  return changeTicketStatusAction(ticketId, status);
}

export function TicketStatusControl({ ticketId, status }: { ticketId: string; status: TicketStatus }) {
  const [state, formAction, pending] = useActionState<TicketActionState, FormData>(
    statusFormAction,
    null
  );
  const selectId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <Label htmlFor={selectId} className="mb-0">
        {t("support.admin.statusLabel")}
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          id={selectId}
          name="status"
          defaultValue={status}
          disabled={pending}
          wrapperClassName="sm:w-56"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(STATUS_LABEL_KEY[s])}
            </option>
          ))}
        </Select>
        {/* disabled (native), mirror ModerationRow — bề mặt quản trị này dùng
            disabled gốc, không phải aria-disabled.
            `self-start`: trong cột dọc ở mobile, nút mặc định giãn hết bề ngang
            và đuôi phải của nó rơi dưới nút hỗ trợ nổi (đo 360×740: nút Lưu
            28–332 × 595–639, nút hỗ trợ 288–344 × 608–664 — đè 44×31px). Co
            theo chữ thì nút kết thúc ở x≈120. */}
        <button type="submit" disabled={pending} className={cn(buttonVariants(), "self-start")}>
          {pending ? t("common.working") : t("common.save")}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="text-destructive text-sm">
          {state.error}
        </p>
      )}
    </form>
  );
}
