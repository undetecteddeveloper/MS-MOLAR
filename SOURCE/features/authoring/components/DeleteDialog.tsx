"use client";

// DeleteDialog — xác nhận xoá đề (UI Spec D8 / Task 6.3). Khuôn LeaveExamDialog:
// scrim đen sơn mài, Esc/click-scrim = huỷ, focus vào nút xoá khi mở + trả
// focus về trigger khi đóng. Gọi deleteExam; đang xoá → disable.
//
// ⚠ PHẢI đi qua createPortal ra <body> (bug prod 2026-08-17) ⚠
// `position: fixed` neo theo viewport — TRỪ KHI có tổ tiên tạo containing
// block. `filter`, `backdrop-filter`, `transform`, `will-change` đều tạo, và
// PublishBar (nơi gọi dialog này ở màn review) là `sticky bottom-0 …
// backdrop-blur`. Hệ quả: `fixed inset-0` neo vào ĐÚNG cái thanh đó — scrim
// co thành một dải ngang cao bằng thanh, hộp thoại canh giữa trong dải đó
// thay vì giữa màn hình. Không lỗi CSS nào được báo; trông như "quên overlay".
// Portal đưa dialog ra ngoài mọi tổ tiên nên fixed lại neo đúng viewport, và
// nó sửa cho MỌI call site cùng lúc (PublishBar, ExamRow, context menu) chứ
// không phải đi gỡ backdrop-blur ở từng nơi.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { deleteExam } from "@/features/authoring/actions";
import { useT } from "@/lib/i18n/client";

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
  triggerLabel,
  open: controlledOpen,
  onOpenChange,
}: DeleteDialogProps) {
  const t = useT();
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
    // Khoá cuộn nền: hộp thoại nay nằm ở <body> nên trang phía sau cuộn được
    // dưới scrim, kéo hộp thoại "trôi" khỏi tầm mắt trên mobile.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
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
          {triggerLabel ?? t("common.delete")}
        </button>
      )}

      {/* `typeof document` thay cho state `mounted`: dialog chỉ mở sau một cú
          click của người dùng, tức luôn sau hydrate, nên không có lượt render
          server nào mà `open` đã true — không sinh lệch hydrate. */}
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-exam-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <button
              aria-hidden
              tabIndex={-1}
              onClick={closeAndReturnFocus}
              className="absolute inset-0 cursor-default bg-[#1B1512]/40"
            />
            <div className="border-border bg-background relative w-full max-w-sm rounded-lg border p-6">
              <h2 id="delete-exam-title" className="text-foreground font-serif text-xl">
                {t("upload.deleteTitle")}
              </h2>
              <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                {t("upload.deleteBody", { title: examTitle })}
              </p>
              {error && (
                <p className="text-brand mt-2 text-sm" role="alert">
                  {error}
                </p>
              )}
              {/* Mobile: nút xếp dọc, Huỷ nằm DƯỚI — ngón cái với tới nút phá
                  huỷ trước là sai thứ tự an toàn. ≥sm giữ hàng ngang phải. */}
              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeAndReturnFocus}
                  className="border-border text-foreground hover:bg-accent min-h-11 rounded-[4px] border px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-colors"
                >
                  {t("common.cancel")}
                </button>
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={onConfirm}
                  disabled={deleting}
                  className="bg-brand text-brand-foreground min-h-11 rounded-[4px] px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {deleting ? t("upload.deleting") : t("common.delete")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
