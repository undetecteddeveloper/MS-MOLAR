"use client";

// DeleteDialog — xác nhận xoá đề (UI Spec D8 / Task 6.3). Khuôn LeaveExamDialog:
// scrim đen sơn mài, Esc/click-scrim = huỷ, focus vào nút xoá khi mở + trả
// focus về trigger khi đóng. Gọi deleteExam; đang xoá → disable.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteExam } from "@/app/(layer4)/actions";

interface DeleteDialogProps {
  examId: string;
  examTitle: string;
  /** Sau khi xoá xong điều hướng về đâu (mặc định /me/exams). */
  redirectTo?: string;
  /** Kiểu trigger: link nhỏ (trong hàng) hay nút. Bỏ qua khi open được điều khiển từ ngoài (vd: context menu). */
  triggerClassName?: string;
  triggerLabel?: string;
  /** Mở/đóng có kiểm soát từ ngoài (vd: mục "Xóa" trong context menu) — khi truyền, nút trigger riêng không render. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeleteDialog({
  examId,
  examTitle,
  redirectTo = "/me/exams",
  triggerClassName,
  triggerLabel = "Delete",
  open: controlledOpen,
  onOpenChange,
}: DeleteDialogProps) {
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    confirmRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  function closeAndReturnFocus() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  async function onConfirm() {
    setDeleting(true);
    setError(null);
    const result = await deleteExam(examId);
    if (result.error) {
      setDeleting(false);
      setError(result.error.message);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <>
      {!isControlled && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          className={
            triggerClassName ??
            "text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-brand hover:underline"
          }
        >
          {triggerLabel}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-exam-title"
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
        >
          <button
            aria-hidden
            tabIndex={-1}
            onClick={closeAndReturnFocus}
            className="absolute inset-0 cursor-default bg-[#1B1512]/40"
          />
          <div className="relative w-full max-w-sm rounded-lg border border-border bg-background p-6">
            <h2
              id="delete-exam-title"
              className="font-serif text-xl text-foreground"
            >
              Delete this exam?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              “{examTitle}” and its questions and files will be permanently
              removed. This can&apos;t be undone.
            </p>
            {error && (
              <p className="mt-2 text-sm text-brand" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeAndReturnFocus}
                className="rounded-[4px] border border-border px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-foreground transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={onConfirm}
                disabled={deleting}
                className="rounded-[4px] bg-brand px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-brand-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
