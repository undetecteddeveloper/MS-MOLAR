"use client";

// ReportDialog (C-26, O-04) — hộp thoại báo cáo dùng chung cho bài giải
// (task 36, `variant="solution"`) và bình luận (task 37, `variant="comment"`).
// Dựng trên `useModalLayer` (task 07, `OverlaySheet.tsx`) — cùng bộ luật
// portal/scrim/`inert`/khoá cuộn/bẫy Tab/trả tiêu điểm mà `ConfirmDialog`
// dùng — và mô phỏng HÌNH DẠNG của `ReportExam.tsx` (bố cục, thứ tự kiểm tra,
// luật "lý do không mất khi lỗi") mà KHÔNG import mã của nó: `ReportExam.tsx`
// phải xin `eslint-disable-next-line no-restricted-imports` để gọi
// `reportExam` từ `features/authoring`; component này không import bất kỳ gì
// từ `features/exams`/`features/authoring` (B4).
//
// Trạng thái "đã báo cáo" KHÔNG sống trong file này: cha (`SolutionMenu` /
// `CommentItem`, task 37) giữ flag `reported` seed từ `iReported` (frontend DD
// § Client State Design "Seeded-from-server state") và tự đóng dialog qua
// `open=false` sau khi gọi `onReported()`. Dialog chỉ biết bốn việc: gõ lý do,
// chặn rỗng TRƯỚC khi gọi `onSubmit` (không có RPC nào cho ca rỗng), hiện lỗi
// rate-limit/generic mà KHÔNG xoá lý do đã gõ, và báo `onReported()` khi
// `{ ok: true }` — với MỌI giá trị `alreadyReported` (một báo cáo lặp không
// phải lỗi, § Error Handling "Business logic (duplicate)").

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalLayer } from "@/components/shared/OverlaySheet";
import { MODAL_EXIT_MS, usePresence } from "@/components/shared/usePresence";
import { buttonVariants } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { LIMITS } from "@/lib/ugc/limits";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { ReportResult } from "@/features/solutions/actions";

export interface ReportDialogProps {
  open: boolean;
  /** Chọn tiêu đề — "Báo cáo bài giải" hay "Báo cáo bình luận" (`report.solutionTitle`/`report.commentTitle`). */
  variant: "solution" | "comment";
  /** `reportSolution`/`reportComment` đã gắn sẵn id của đối tượng — dialog
   *  không biết (và không cần biết) đang báo cáo cái gì. */
  onSubmit: (reason: string) => Promise<ReportResult>;
  /** Huỷ / Escape / chạm scrim — đóng dialog, không gửi gì. */
  onCancel: () => void;
  /** `{ ok: true }` (mọi giá trị `alreadyReported`) — cha tự đặt `open=false`
   *  và lật flag `reported` của mình sang `true`. */
  onReported: () => void;
}

export function ReportDialog({ open, variant, onSubmit, onCancel, onReported }: ReportDialogProps) {
  const { present, closing } = usePresence(open, MODAL_EXIT_MS);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Khoá ĐỒNG BỘ bên cạnh state `submitting` (mẫu ConfirmDialog): hai cú bấm
  // trong cùng một tick đều còn đọc thấy `submitting === false`.
  const busyRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const errorId = useId();

  function cancel() {
    if (!busyRef.current) onCancel();
  }

  async function submit() {
    if (busyRef.current) return;
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setError(t("report.errorEmpty"));
      return;
    }
    busyRef.current = true;
    setSubmitting(true);
    setError(null);
    const result = await onSubmit(trimmed);
    busyRef.current = false;
    setSubmitting(false);

    if (result.ok) {
      onReported();
      return;
    }
    if (result.error.code === "rateLimited") {
      setError(t("profile.error.rateLimited", { seconds: result.error.seconds }));
      return;
    }
    // "empty" là backstop phòng thủ của chính action (validate lại trên
    // server) — không nhánh nào ở trên gọi `onSubmit` với lý do rỗng, nhưng
    // nếu nó vẫn về thì render đúng chữ rỗng, không phải chữ chung chung.
    setError(t(result.error.code === "empty" ? "report.errorEmpty" : "report.errorGeneric"));
  }

  useModalLayer({ active: open, rootRef, panelRef, initialFocusRef: textareaRef, onEscape: cancel });

  if (!present) return null;
  // Cùng gác hydrate với `ConfirmDialog`: dialog này chỉ mở sau một thao tác
  // của người dùng (bấm "Báo cáo bài giải"/"Báo cáo"), không có lượt render
  // server nào `open` đã true.
  if (typeof document === "undefined") return null;

  const closingAttr = closing ? "" : undefined;
  const busyAttrs = { "aria-disabled": submitting || undefined } as const;

  return createPortal(
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6"
    >
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={cancel}
        data-closing={closingAttr}
        inert={closing || undefined}
        className="motion-scrim bg-foreground/40 absolute inset-0 cursor-default"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-closing={closingAttr}
        inert={closing || undefined}
        className={cn(
          cardVariants({ variant: "plain", padding: "none" }),
          "motion-modal relative w-full max-w-sm gap-3 p-5"
        )}
      >
        <h2 id={titleId} className="text-foreground text-lg font-semibold">
          {t(variant === "comment" ? "report.commentTitle" : "report.solutionTitle")}
        </h2>
        <Textarea
          ref={textareaRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={LIMITS.MAX_REPORT_REASON}
          rows={4}
          aria-labelledby={titleId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="min-h-0 resize-none text-sm"
          placeholder={t("report.placeholder")}
        />
        {error && (
          <p id={errorId} role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={cancel}
            {...busyAttrs}
            className={cn(buttonVariants({ variant: "secondary" }), "aria-disabled:opacity-60")}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            aria-busy={submitting || undefined}
            {...busyAttrs}
            className={cn(buttonVariants({ variant: "default" }), "aria-disabled:opacity-60")}
          >
            {submitting ? t("report.submitting") : t("report.submit")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
