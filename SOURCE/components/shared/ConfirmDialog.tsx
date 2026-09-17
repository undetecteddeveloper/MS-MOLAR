"use client";

// ConfirmDialog — hộp thoại xác nhận dùng chung của Bài giải cộng đồng (UI Spec
// C-32). Hai kiểu:
//   confirm      [Huỷ] [Hành động] — "Gỡ về nháp", "Xoá" bình luận, "Xoá hẳn"
//                của admin. Escape/scrim = Huỷ.
//   dirty-close  [Ở lại] [Bỏ] [Lưu] — đóng tấm trượt khi còn thay đổi chưa lưu
//                (AC-104). Escape/scrim = Ở lại.
//
// Vỏ theo khuôn DeleteDialog: portal ra <body> (sau tấm trượt trong DOM nên
// nằm trên nó dù cùng z-50), dính đáy dưới 640px, căn giữa từ 640px; nút xếp
// dọc trên điện thoại với lựa chọn an toàn nằm DƯỚI cùng. Tiêu điểm vào nút
// chính khi mở. Escape, bẫy Tab, `inert` và khoá cuộn đi qua `useModalLayer` —
// cùng một chồng lớp với OverlaySheet, nên Escape ở đây không xin đóng luôn tấm
// trượt phía sau.
//
// Đang xử lý: nút chính "Đang xử lý…" + `aria-busy`, và hộp thoại KHÔNG đóng
// bằng bất kỳ đường nào cho tới khi `onConfirm` xong (UI Spec C-32). Đóng hay
// giữ mở sau kết quả là việc của cha qua `open`: xoá bình luận hỏng thì cha đóng
// hộp thoại và hiện lỗi dưới hàng bình luận (DD-U3); "Gỡ về nháp" hỏng thì cha
// giữ mở và truyền `error`.

import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useModalLayer } from "@/components/shared/OverlaySheet";
import { MODAL_EXIT_MS, usePresence } from "@/components/shared/usePresence";
import { buttonVariants } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";

interface ConfirmDialogCommonProps {
  open: boolean;
  title: string;
  /** Dòng hệ quả — hộp thoại trỏ `aria-describedby` tới nó. */
  body: ReactNode;
  /** Hành động chính ("Lưu" ở dirty-close). Hộp thoại ở trạng thái đang xử lý
   *  cho tới khi promise xong. */
  onConfirm: () => Promise<void>;
  /** "Huỷ" / "Ở lại" — cũng là Escape và chạm scrim. */
  onCancel: () => void;
  /** Dòng lỗi `role="alert"` bên trong hộp thoại; hộp thoại vẫn mở. */
  error?: string | null;
}

interface ConfirmVariantProps {
  variant: "confirm";
  /** Chữ của nút hành động: "Gỡ về nháp", "Xoá", "Xoá hẳn". */
  confirmLabel: string;
  /** Nút hành động mang màu xoá — chỉ khi hành động xoá thật. */
  destructive?: boolean;
  onDiscard?: never;
}

interface DirtyCloseVariantProps {
  variant: "dirty-close";
  /** "Bỏ" — đóng tấm trượt, bỏ thay đổi. */
  onDiscard: () => void;
  confirmLabel?: never;
  destructive?: never;
}

export type ConfirmDialogProps = ConfirmDialogCommonProps &
  (ConfirmVariantProps | DirtyCloseVariantProps);

export function ConfirmDialog(props: ConfirmDialogProps) {
  const { open, title, body, onConfirm, onCancel, error } = props;
  const { present, closing } = usePresence(open, MODAL_EXIT_MS);
  const [busy, setBusy] = useState(false);
  // Khoá ĐỒNG BỘ bên cạnh state `busy`: hai cú bấm trong cùng một tick đều còn
  // đọc thấy `busy === false` (cùng lý do với ChangePasswordDialog).
  const busyRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();

  function cancel() {
    if (!busyRef.current) onCancel();
  }

  function discard() {
    if (!busyRef.current && props.variant === "dirty-close") props.onDiscard();
  }

  async function confirm() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await onConfirm();
    } catch (error) {
      // Nút gọi `void confirm()`: không bắt ở đây là unhandled rejection. Hộp
      // thoại KHÔNG tự hiện gì — cha báo lỗi qua `error` hoặc đóng nó (DD-U3);
      // ở đây chỉ mở khoá nút để thử lại. Chỉ log `digest`, không log `error`:
      // thông điệp lỗi từ Server Action có thể vọng lại nội dung người dùng
      // (cùng lý do với EssayRegradeControl).
      console.error("[ConfirmDialog] onConfirm rejected", {
        digest:
          typeof error === "object" && error !== null && "digest" in error
            ? error.digest
            : undefined,
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  useModalLayer({
    active: open,
    rootRef,
    panelRef,
    initialFocusRef: primaryRef,
    onEscape: cancel,
  });

  if (!present) return null;
  // `typeof document` thay cho gác hydrate: hộp thoại này chỉ mở sau một thao
  // tác của người dùng, không có lượt render server nào `open` đã true.
  if (typeof document === "undefined") return null;

  const closingAttr = closing ? "" : undefined;
  const dirtyClose = props.variant === "dirty-close";
  const secondary = cn(buttonVariants({ variant: "secondary" }), "aria-disabled:opacity-60");
  const busyAttrs = { "aria-disabled": busy || undefined } as const;

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
      {/* <div> + cardVariants thay cho <Card>: Card không chuyển `ref`, mà bẫy
          Tab cần ref của panel. */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        data-closing={closingAttr}
        inert={closing || undefined}
        className={cn(
          cardVariants({ variant: "plain", padding: "none" }),
          "motion-modal relative w-full max-w-sm gap-3 p-5"
        )}
      >
        <h2 id={titleId} className="text-foreground text-lg font-semibold">
          {title}
        </h2>
        <div id={bodyId} className="text-muted-foreground text-sm leading-relaxed">
          {body}
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button type="button" onClick={cancel} className={secondary} {...busyAttrs}>
            {dirtyClose ? t("solutions.dirty.stay") : t("common.cancel")}
          </button>
          {dirtyClose && (
            <button type="button" onClick={discard} className={secondary} {...busyAttrs}>
              {t("solutions.dirty.discard")}
            </button>
          )}
          <button
            ref={primaryRef}
            type="button"
            onClick={() => void confirm()}
            aria-busy={busy || undefined}
            {...busyAttrs}
            className={cn(
              buttonVariants({ variant: props.destructive ? "destructive" : "default" }),
              "aria-disabled:opacity-60"
            )}
          >
            {busy
              ? t("common.working")
              : dirtyClose
                ? t("solutions.dirty.save")
                : props.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
