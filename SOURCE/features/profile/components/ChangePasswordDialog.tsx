"use client";

// ChangePasswordDialog — hộp thoại đổi mật khẩu (/profile S-02).
//
// Vỏ theo khuôn DeleteDialog (theme "Sân trường", 2026-09-10): scrim xanh đen
// mờ, thẻ trắng bo 18px, DÍNH ĐÁY dưới 640px (ngón cái với tới, và bàn phím ảo
// đẩy lên từ đáy), căn giữa từ 640px. Chiều ĐÓNG qua `usePresence` (§7): giữ
// hộp thoại thêm 150ms để `.motion-modal[data-closing]` thu lại, `inert`
// trong lúc đó để không bấm trúng một hộp đang biến mất.
//
// ⚠ PORTAL LÀ BẮT BUỘC, KHÔNG PHẢI TRAU CHUỐT (Design Doc C9). `position: fixed`
// neo theo viewport TRỪ KHI có tổ tiên tạo containing block (`filter`,
// `backdrop-filter`, `transform`) — khi dính, `fixed inset-0` co thành một DẢI
// NGANG, không có lỗi CSS nào được báo, trông y như "quên làm overlay".
//
// ⚠ BẪY FOCUS Ở ĐÂY LÀ HÀNH VI RIÊNG: KHÔNG modal nào khác trong repo giam
// được focus. PRD AC-050 đòi giam focus tường minh, nên nó được VIẾT ở đây —
// xem trapTab() bên dưới.
//
// Trả focus về nút mở là việc của CHA: panel biết cách tự lấy focus lúc mở,
// nhưng không biết trả về đâu lúc đóng.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
// eslint-disable-next-line no-restricted-imports -- rò chéo có sẵn trước B4 (2026-09-03): changeAvatar/updateProfile/changePassword còn nằm chung file với signIn/signUp. Xem ARCHITECTURE.md § Import chéo.
import { changePassword, type AuthState } from "@/features/auth/actions";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { MODAL_EXIT_MS, usePresence } from "@/components/shared/usePresence";
import { profileMessage, resolveActionError, type ProfileMessage } from "@/features/profile/components/errorMessages";

/** Chặn trên quay-mãi-không-dừng (AC-067). Cùng con số với SupportWidgetDialog. */
const SUBMIT_TIMEOUT_MS = 20000;

const TITLE_ID = "profile-password-dialog-title";
const ERROR_ID = "profile-password-dialog-error";
const HINT_ID = "profile-password-hint";

const CURRENT_ID = "profile-password-current";
const NEW_ID = "profile-password-new";
const CONFIRM_ID = "profile-password-confirm";

/** Ô nào bị đánh dấu sai theo từng loại lỗi. Đánh dấu cả ba ô cho MỌI lỗi là
 *  nói dối: "mật khẩu quá ngắn" không phải lỗi của ô "mật khẩu hiện tại". */
const INVALID_FIELDS: Partial<Record<MessageKey, ReadonlyArray<"current" | "new" | "confirm">>> = {
  "profile.password.errorCurrentRequired": ["current"],
  "profile.password.errorCurrentWrong": ["current"],
  "profile.password.errorMismatch": ["new", "confirm"],
  "profile.password.errorTooShort": ["new"],
  "profile.password.errorTooLong": ["new"],
  "profile.password.errorOnlySpaces": ["new"],
  "profile.password.errorTooCommon": ["new"],
  "profile.password.errorSameAsCurrent": ["new"],
};

/** Mọi phần tử nhận được Tab. Loại tabindex="-1" nên scrim và chính panel không
 *  lọt vào — cả hai đều là điểm dừng cố ý bị gỡ khỏi vòng Tab. */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface ChangePasswordDialogProps {
  open: boolean;
  /** Đóng hộp thoại. Cha chịu trách nhiệm trả focus về nút mở. */
  onClose: () => void;
  onSuccess: (key: MessageKey) => void;
  /** Chữ cho vùng role="status" dùng chung của thẻ; `null` = rảnh. */
  onStatus: (message: ProfileMessage | null) => void;
}

export function ChangePasswordDialog({
  open,
  onClose,
  onSuccess,
  onStatus,
}: ChangePasswordDialogProps) {
  const { present, closing } = usePresence(open, MODAL_EXIT_MS);
  const [error, setError] = useState<ProfileMessage | null>(null);
  const [pending, setPending] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const currentRef = useRef<HTMLInputElement>(null);
  // Khoá ĐỒNG BỘ, tách khỏi state `pending`: React gộp hai setState trong
  // cùng một tick, kể cả từ hai lần dispatch sự kiện DOM riêng biệt, nên cú
  // click thứ hai vẫn đọc thấy `pending === false`.
  const submittingRef = useRef(false);
  const attemptIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;

    function onKey(e: KeyboardEvent) {
      // Không cho Escape lúc đang gửi: request đã bay đi, đóng hộp thoại chỉ
      // giấu mất kết quả chứ không huỷ được nó.
      if (e.key === "Escape" && !submittingRef.current) closeAndReset();
    }
    window.addEventListener("keydown", onKey);
    panelRef.current?.focus();

    // Khoá cuộn nền: hộp thoại nằm ở <body>, nên nếu không khoá thì trang phía
    // sau cuộn dưới scrim và kéo panel trôi khỏi tầm mắt — tệ nhất trên điện
    // thoại đang mở bàn phím ảo, tức đúng thiết bị của form này.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closeAndReset chỉ đóng qua các setter ổn định
  }, [open]);

  function closeAndReset() {
    setError(null);
    setPending(false);
    onStatus(null);
    onClose();
  }

  /**
   * Một lượt bị từ chối (AC-068): xoá SẠCH ba ô, đưa con trỏ về ô mật khẩu hiện
   * tại. Không phải để gọn mắt — chất liệu mật khẩu không được nằm trong DOM
   * sống lâu hơn lần thử cần tới nó. Hộp thoại vẫn mở và gửi lại được ngay.
   */
  function reject(message: ProfileMessage) {
    setError(message);
    formRef.current?.reset();
    currentRef.current?.focus();
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submittingRef.current) return;

    const form = e.currentTarget;
    const formData = new FormData(form);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    // Hai lần từ chối dưới đây KHÔNG chạm mạng (AC-017 nửa client, AC-019).
    if (!currentPassword) {
      reject(profileMessage("profile.password.errorCurrentRequired"));
      return;
    }
    if (password !== confirm) {
      reject(profileMessage("profile.password.errorMismatch"));
      return;
    }

    submittingRef.current = true;
    setError(null);
    setPending(true);
    onStatus(profileMessage("common.saving"));
    const attemptId = ++attemptIdRef.current;

    try {
      const outcome = await Promise.race<AuthState | "timeout">([
        changePassword(null, formData),
        new Promise<"timeout">((resolve) => {
          setTimeout(() => resolve("timeout"), SUBMIT_TIMEOUT_MS);
        }),
      ]);

      // Một lượt mới hơn đã bắt đầu → kết quả này đã lỗi thời.
      if (attemptIdRef.current !== attemptId) return;

      if (outcome === "timeout") {
        reject(profileMessage("profile.error.network"));
        return;
      }
      // `null` = thành công. Không có màn hình "đã đổi xong" trong hộp thoại:
      // nó đóng, và SuccessToast báo hộ.
      if (outcome === null) {
        onSuccess("profile.password.changed");
        closeAndReset();
        return;
      }
      reject(resolveActionError(outcome.error ?? ""));
    } finally {
      submittingRef.current = false;
      setPending(false);
      onStatus(null);
    }
  }

  /**
   * BẪY FOCUS (AC-050, UI-D5). Tính danh sách phần tử nhận Tab theo THỨ TỰ DOM
   * ngay lúc nhấn phím, không lưu sẵn: dòng lỗi và nhãn nút đổi theo trạng
   * thái. Chỉ chặn ở hai mép; ở giữa để nguyên cho trình duyệt đi.
   */
  function trapTab(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;

    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (items.length === 0) {
      e.preventDefault();
      return;
    }

    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;

    if (e.shiftKey) {
      // Panel đang giữ focus (vừa mở) → Shift+Tab phải vòng xuống cuối, vì
      // trình duyệt sẽ đưa focus ra NGOÀI panel.
      if (active === first || active === panel || !panel.contains(active)) {
        e.preventDefault();
        last.focus();
      }
      return;
    }
    if (active === last || !panel.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  }

  if (!present) return null;
  // `typeof document` thay cho state `mounted`: hộp thoại chỉ mở sau một cú
  // click, tức luôn sau hydrate — không có lượt render server nào `open` đã true.
  if (typeof document === "undefined") return null;

  const errorText = error ? t(error.key, error.values) : null;
  const hint = profileMessage("profile.password.hint");
  const invalid = error ? (INVALID_FIELDS[error.key] ?? []) : [];
  const describedBy = (field: "current" | "new" | "confirm") => {
    const ids = [field === "new" ? HINT_ID : null, invalid.includes(field) ? ERROR_ID : null];
    const joined = ids.filter(Boolean).join(" ");
    // undefined chứ không phải chuỗi rỗng: một aria-describedby trỏ vào node
    // KHÔNG được render còn tệ hơn không có.
    return joined.length > 0 ? joined : undefined;
  };
  const closingAttr = closing ? "" : undefined;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6"
    >
      <button
        aria-hidden
        tabIndex={-1}
        onClick={() => {
          if (!submittingRef.current) closeAndReset();
        }}
        data-closing={closingAttr}
        className="motion-scrim bg-foreground/40 absolute inset-0 cursor-default"
      />
      {/* <div> thật thay vì <Card>: Card không chuyển `ref`, mà panel cần ref
          để nhận focus lúc mở và để trapTab đọc danh sách phần tử. */}
      <div
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={trapTab}
        data-closing={closingAttr}
        inert={closing || undefined}
        className={cn(
          cardVariants({ variant: "plain", padding: "none" }),
          "motion-modal focus-visible:ring-ring/40 relative w-full max-w-sm gap-0 p-5 outline-none focus-visible:ring-3 sm:p-6"
        )}
      >
        <h2 id={TITLE_ID} className="text-foreground text-lg font-semibold">
          {t("profile.password.change")}
        </h2>

        {errorText && (
          <p id={ERROR_ID} role="alert" className="text-destructive mt-2 text-sm">
            {errorText}
          </p>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <Label htmlFor={CURRENT_ID}>{t("profile.password.current")}</Label>
            <Input
              ref={currentRef}
              id={CURRENT_ID}
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              // readOnly + aria-disabled, KHÔNG phải `disabled` gốc: một control
              // bị disabled gốc trong lúc người dùng đang đứng trên nó sẽ đánh
              // rơi focus xuống <body> giữa chừng.
              readOnly={pending}
              aria-disabled={pending}
              aria-invalid={invalid.includes("current") || undefined}
              aria-describedby={describedBy("current")}
            />
          </div>

          <div>
            <Label htmlFor={NEW_ID}>{t("profile.password.new")}</Label>
            <Input
              id={NEW_ID}
              name="password"
              type="password"
              autoComplete="new-password"
              readOnly={pending}
              aria-disabled={pending}
              aria-invalid={invalid.includes("new") || undefined}
              aria-describedby={describedBy("new")}
            />
            {/* GỢI Ý, không phải luật: server vẫn là nơi quyết định, và câu này
                chỉ nói sàn độ dài — không bao giờ tiết lộ danh sách chặn. */}
            <p id={HINT_ID} className="text-muted-foreground mt-1.5 text-xs">
              {t(hint.key, hint.values)}
            </p>
          </div>

          <div>
            <Label htmlFor={CONFIRM_ID}>{t("profile.password.confirm")}</Label>
            <Input
              id={CONFIRM_ID}
              name="confirm"
              type="password"
              autoComplete="new-password"
              readOnly={pending}
              aria-disabled={pending}
              aria-invalid={invalid.includes("confirm") || undefined}
              aria-describedby={describedBy("confirm")}
            />
          </div>

          {/* Dưới 640px nút xếp dọc, Huỷ nằm DƯỚI nút chính; từ 640px hàng ngang
              căn phải — cùng khuôn hộp Xoá. Huỷ SỐNG suốt lúc đang gửi: không
              bao giờ nhốt người dùng lại trong một hộp thoại đang chờ mạng. */}
          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeAndReset}
              className={buttonVariants({ variant: "secondary" })}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              aria-disabled={pending}
              className={cn(buttonVariants(), "aria-disabled:opacity-60")}
            >
              {pending ? t("common.saving") : t("profile.password.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
