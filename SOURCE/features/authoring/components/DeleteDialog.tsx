"use client";

// DeleteDialog — xác nhận xoá đề (UI Spec D8 / Task 6.3). Khuôn LeaveExamDialog:
// scrim xanh đen mờ, thẻ trắng bo 18px, dính đáy dưới 640px (ngón cái với
// tới), căn giữa từ 640px. Esc/click-scrim = huỷ, focus vào nút xoá khi mở +
// trả focus về trigger khi đóng. Gọi deleteExam; đang xoá → disable. "Huỷ" là
// nút phụ (surface); "Xoá" mang màu đỏ vì nó xoá thật.
//
// Chiều ĐÓNG (2026-09-09, §7): `usePresence` giữ hộp thoại thêm 150ms sau khi
// `open` về false để `.motion-modal[data-closing]` thu lại; trong lúc đó
// `inert` để không bấm trúng một hộp đang biến mất. Mở lại giữa chừng thì pha
// quay về "open" ngay lượt render đó — transition chạy ngược, không nháy.
//
// ⚠ PHẢI đi qua createPortal ra <body> (bug prod 2026-08-17) ⚠
// `position: fixed` neo theo viewport — TRỪ KHI có tổ tiên tạo containing
// block. `filter`, `backdrop-filter`, `transform`, `will-change` đều tạo, và
// PublishBar từng là `sticky … backdrop-blur` với hộp thoại này nằm trong nó.
// Hệ quả: `fixed inset-0` neo vào ĐÚNG cái thanh đó — scrim co thành một dải
// ngang cao bằng thanh. Không lỗi CSS nào được báo; trông như "quên overlay".
// Portal đưa dialog ra ngoài mọi tổ tiên nên fixed lại neo đúng viewport, và
// nó bảo vệ MỌI call site cùng lúc chứ không phụ thuộc vào việc tổ tiên hôm
// nay có blur hay không.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { deleteExam } from "@/features/authoring/actions";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MODAL_EXIT_MS, usePresence } from "@/components/shared/usePresence";

interface DeleteDialogProps {
  examId: string;
  examTitle: string;
  /** Sau khi xoá xong điều hướng về đâu (mặc định /me/exams). */
  redirectTo?: string;
  /** Nút mở: viên thuốc đỏ nhạt 36px (trong hàng đề) hay dòng chữ đỏ (chân
   *  trang rà soát). Bỏ qua khi `open` được điều khiển từ ngoài. */
  triggerVariant?: "pill" | "link";
  triggerLabel?: string;
  /** Mở/đóng có kiểm soát từ ngoài — khi truyền, nút trigger riêng không render. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function DeleteDialog({
  examId,
  examTitle,
  redirectTo = "/me/exams",
  triggerVariant = "pill",
  triggerLabel,
  open: controlledOpen,
  onOpenChange,
}: DeleteDialogProps) {
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const { present, closing } = usePresence(open, MODAL_EXIT_MS);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    confirmRef.current?.focus();
    // Khoá cuộn nền: hộp thoại nằm ở <body> nên trang phía sau cuộn được
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

  const closingAttr = closing ? "" : undefined;

  return (
    <>
      {!isControlled && (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          className={
            triggerVariant === "link"
              ? cn(buttonVariants({ variant: "link", size: "sm" }), "text-destructive px-0")
              : buttonVariants({ variant: "destructive", size: "sm" })
          }
        >
          {triggerLabel ?? t("common.delete")}
        </button>
      )}

      {/* `typeof document` thay cho state `mounted`: dialog chỉ mở sau một cú
          click của người dùng, tức luôn sau hydrate, nên không có lượt render
          server nào mà `open` đã true — không sinh lệch hydrate. */}
      {present &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-exam-title"
            className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6"
          >
            <button
              aria-hidden
              tabIndex={-1}
              onClick={closeAndReturnFocus}
              data-closing={closingAttr}
              className="motion-scrim bg-foreground/40 absolute inset-0 cursor-default"
            />
            <Card
              variant="plain"
              data-closing={closingAttr}
              inert={closing || undefined}
              className="motion-modal relative w-full max-w-sm gap-3 p-5"
            >
              <h2 id="delete-exam-title" className="text-foreground text-lg font-semibold">
                {t("upload.deleteTitle")}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t("upload.deleteBody", { title: examTitle })}
              </p>
              {error && (
                <p className="text-destructive text-sm" role="alert">
                  {error}
                </p>
              )}
              {/* Mobile: nút xếp dọc, Huỷ nằm DƯỚI — ngón cái với tới nút phá
                  huỷ trước là sai thứ tự an toàn. ≥sm giữ hàng ngang phải. */}
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeAndReturnFocus}
                  className={buttonVariants({ variant: "secondary" })}
                >
                  {t("common.cancel")}
                </button>
                <button
                  ref={confirmRef}
                  type="button"
                  onClick={onConfirm}
                  disabled={deleting}
                  className={buttonVariants({ variant: "destructive" })}
                >
                  {deleting ? t("upload.deleting") : t("common.delete")}
                </button>
              </div>
            </Card>
          </div>,
          document.body
        )}
    </>
  );
}
