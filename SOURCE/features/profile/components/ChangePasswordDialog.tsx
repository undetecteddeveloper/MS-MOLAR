"use client";

// ChangePasswordDialog — hộp thoại đổi mật khẩu (/profile S-02).
//
// CHÉP THEO MẪU, không import code (SupportWidgetDialog.tsx:5-6 ghi rằng repo
// này nhân bản khuôn modal theo lối đó):
//   - vỏ a11y từ components/support/SupportWidgetDialog.tsx — role="dialog",
//     aria-modal, aria-labelledby trỏ vào <h2> của chính panel, scrim là button
//     aria-hidden/tabIndex={-1}, Escape qua listener trên window, panel nhận
//     focus lúc mở qua ref + tabIndex={-1};
//   - portal + khoá cuộn nền từ app/(layer4)/_components/DeleteDialog.tsx:111-161.
//
// ⚠ PORTAL LÀ BẮT BUỘC, KHÔNG PHẢI TRAU CHUỐT (Design Doc C9). `position: fixed`
// neo theo viewport TRỪ KHI có tổ tiên tạo containing block, mà `backdrop-blur`
// tạo ra một cái — và SiteHeader lẫn BottomNav đều dùng backdrop-blur. Khi dính,
// `fixed inset-0` co thành một DẢI NGANG, không có lỗi CSS nào được báo, trông
// y như "quên làm overlay". DeleteDialog mang sẵn 16 dòng chú thích về đúng lần
// bug production đó.
//
// ⚠ BẪY FOCUS Ở ĐÂY LÀ HÀNH VI MỚI, KHÔNG PHẢI THỨ KẾ THỪA ĐƯỢC.
// KHÔNG modal nào trong repo này giam được focus: ở SupportWidgetDialog,
// DeleteDialog, LeaveExamDialog và ReportExam, Tab đi thẳng ra trang phía sau
// scrim. Chú thích đầu SupportWidgetDialog.tsx:6 tự gọi bẫy của nó là "tối
// thiểu", và mô tả đó là chính xác. PRD AC-050 đòi giam focus tường minh, nên
// nó được VIẾT ở đây chứ không được mượn — xem trapTab() bên dưới.
//
// Trả focus về nút mở là việc của CHA (SupportWidget.tsx:33-36 đặt ra lệ này):
// panel biết cách tự lấy focus lúc mở, nhưng không biết trả về đâu lúc đóng.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { changePassword, type AuthState } from "@/features/auth/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { profileMessage, resolveActionError, type ProfileMessage } from "@/features/profile/components/errorMessages";
import {
  actionRowCls,
  fieldHintCls,
  fieldInputCls,
  outlineButtonCls,
  pillButtonCls,
} from "@/features/profile/components/styles";

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
  const t = useT();
  const [error, setError] = useState<ProfileMessage | null>(null);
  const [pending, setPending] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const currentRef = useRef<HTMLInputElement>(null);
  // Khoá ĐỒNG BỘ, tách khỏi state `pending` (SupportWidgetDialog.tsx:59-66):
  // React gộp hai setState trong cùng một tick, kể cả từ hai lần dispatch sự
  // kiện DOM riêng biệt, nên cú click thứ hai vẫn đọc thấy `pending === false`.
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
    // sau cuộn dưới scrim và kéo panel trôi khỏi tầm mắt — đúng triệu chứng
    // DeleteDialog.tsx:63-66 ghi lại, và nó tệ nhất trên điện thoại đang mở bàn
    // phím ảo, tức đúng thiết bị của form này.
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
   * sống lâu hơn lần thử cần tới nó. Hộp thoại vẫn mở và gửi lại được ngay
   * (AC-018d).
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
      // `null` = thành công, khớp giao ước của updateProfile. Không có màn hình
      // "đã đổi xong" trong hộp thoại: nó đóng, và SuccessToast báo hộ.
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
   * BẪY FOCUS — hành vi mới trong repo này (AC-050, UI-D5).
   *
   * Tính danh sách phần tử nhận Tab theo THỨ TỰ DOM ngay lúc nhấn phím, không
   * lưu sẵn: dòng lỗi và nhãn nút đổi theo trạng thái, nên một danh sách chụp
   * lúc mở sẽ lệch ngay sau lần từ chối đầu tiên.
   *
   * Chỉ chặn ở hai mép. Ở giữa để nguyên cho trình duyệt đi — tự tính "phần tử
   * kế tiếp" là dựng lại thuật toán thứ tự Tab, và bản dựng lại đó sẽ sai ở
   * đúng những chỗ khó thấy nhất.
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

  if (!open) return null;
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
    // KHÔNG được render còn tệ hơn không có, vì nó âm thầm nuốt mô tả trên mọi
    // công nghệ hỗ trợ.
    return joined.length > 0 ? joined : undefined;
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
    >
      <button
        aria-hidden
        tabIndex={-1}
        onClick={() => {
          if (!submittingRef.current) closeAndReset();
        }}
        className="absolute inset-0 cursor-default bg-[#1B1512]/40"
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        onKeyDown={trapTab}
        className="border-border bg-background relative w-full max-w-sm rounded-lg border p-6 outline-none"
      >
        <h2 id={TITLE_ID} className="text-foreground font-serif text-xl">
          {t("profile.password.change")}
        </h2>

        {errorText && (
          <p id={ERROR_ID} role="alert" className="text-brand mt-2 text-sm">
            {errorText}
          </p>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          <div>
            <label htmlFor={CURRENT_ID} className="eyebrow block">
              {t("profile.password.current")}
            </label>
            <input
              ref={currentRef}
              id={CURRENT_ID}
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              // readOnly + aria-disabled, KHÔNG phải `disabled` gốc: một control
              // bị disabled gốc trong lúc người dùng đang đứng trên nó sẽ đánh
              // rơi focus xuống <body> giữa chừng và mang luôn lý do bận của nó
              // ra khỏi cây a11y.
              readOnly={pending}
              aria-disabled={pending}
              aria-invalid={invalid.includes("current") || undefined}
              aria-describedby={describedBy("current")}
              className={fieldInputCls(invalid.includes("current"))}
            />
          </div>

          <div>
            <label htmlFor={NEW_ID} className="eyebrow block">
              {t("profile.password.new")}
            </label>
            <input
              id={NEW_ID}
              name="password"
              type="password"
              autoComplete="new-password"
              readOnly={pending}
              aria-disabled={pending}
              aria-invalid={invalid.includes("new") || undefined}
              aria-describedby={describedBy("new")}
              className={fieldInputCls(invalid.includes("new"))}
            />
            {/* GỢI Ý, không phải luật: server vẫn là nơi quyết định, và câu này
                chỉ nói sàn độ dài — không bao giờ tiết lộ danh sách chặn. */}
            <p id={HINT_ID} className={fieldHintCls}>
              {t(hint.key, hint.values)}
            </p>
          </div>

          <div>
            <label htmlFor={CONFIRM_ID} className="eyebrow block">
              {t("profile.password.confirm")}
            </label>
            <input
              id={CONFIRM_ID}
              name="confirm"
              type="password"
              autoComplete="new-password"
              readOnly={pending}
              aria-disabled={pending}
              aria-invalid={invalid.includes("confirm") || undefined}
              aria-describedby={describedBy("confirm")}
              className={fieldInputCls(invalid.includes("confirm"))}
            />
          </div>

          <div className={actionRowCls}>
            {/* Huỷ SỐNG suốt lúc đang gửi — không bao giờ nhốt người dùng lại
                trong một hộp thoại đang chờ mạng. */}
            <button type="button" onClick={closeAndReset} className={outlineButtonCls}>
              {t("common.cancel")}
            </button>
            <button type="submit" aria-disabled={pending} className={pillButtonCls}>
              {pending ? t("common.saving") : t("profile.password.submit")}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
