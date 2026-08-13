"use client";

// SupportWidgetDialog — máy trạng thái Compose -> Submitting -> (Compose,
// lỗi) | Success (AC-040: KHÔNG BAO GIỜ Compose -> Success thẳng). Khuôn dựng
// theo ReportExam.tsx (scrim đen sơn mài, Esc/scrim = đóng, focus trap tối
// thiểu) — kế thừa PATTERN, không import code.
//
// State inline (useState), KHÔNG tách hook riêng (Minimal Surface Alternatives
// Element 2, frontend DD): chỉ một nơi tiêu thụ, tách sớm là đầu tư cho một
// tương lai giả định.

import { useEffect, useRef, useState } from "react";
import { submitSupportTicket } from "@/lib/support/actions";
import type { SubmitTicketResult, TicketIntent } from "@/lib/support/types";
import type { ScreenshotCheck } from "@/lib/support/validateScreenshot";
import type { MessageKey } from "@/lib/i18n/translate";
import { useT } from "@/lib/i18n/client";
import { IntentSelector } from "@/components/support/IntentSelector";
import { MessageField } from "@/components/support/MessageField";
import { ScreenshotAttachment } from "@/components/support/ScreenshotAttachment";

type Phase = "compose" | "submitting" | "success";
type ScreenshotErrorReason = Exclude<ScreenshotCheck, { ok: true }>["reason"];
type ServerError = Extract<SubmitTicketResult, { error: string }>["error"];
// Element 1 (Fact Disposition, frontend DD): mở rộng union LOCAL, không nới
// SubmitTicketResult của backend — "timeout" chỉ tồn tại phía client.
type ClientSubmitError = ServerError | "timeout" | "validation";

const SUBMIT_TIMEOUT_MS = 20000;

// Lỗi cấp-dialog (không gắn field cụ thể nào) — validation/screenshot_rejected
// đã có chỗ hiển thị riêng trong field tương ứng, không lặp lại ở đây.
const DIALOG_ERROR_KEY: Partial<Record<ClientSubmitError, MessageKey>> = {
  rate_limited: "support.error.rateLimited",
  timeout: "support.error.network",
  server: "support.error.generic",
  unauthenticated: "support.error.generic",
  invalid: "support.error.generic", // phòng hờ — client đã chặn trước khi tới server
};

interface SupportWidgetDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SupportWidgetDialog({ open, onClose }: SupportWidgetDialogProps) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("compose");
  const [intent, setIntent] = useState<TicketIntent | null>(null);
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotError, setScreenshotError] = useState<ScreenshotErrorReason | null>(null);
  const [submitError, setSubmitError] = useState<ClientSubmitError | null>(null);
  const [result, setResult] = useState<Extract<SubmitTicketResult, { ok: true }> | null>(null);
  // Tăng dần mỗi lần submit — timeout của một attempt CŨ tới sau khi phase đã
  // rời "submitting" (vì response thật đã tới trước) thì bị bỏ qua.
  const attemptIdRef = useRef(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Khoá ĐỒNG BỘ, riêng với `phase` state: React 18+ tự động gộp (batch) các
  // setState xảy ra trong cùng một tick đồng bộ, kể cả khi chúng đến từ các
  // lần dispatch sự kiện DOM tách biệt (vd hai click liên tiếp không có await
  // xen giữa) — nghĩa là `phase` có thể CHƯA kịp phản ánh "submitting" ở lần
  // click thứ hai dù lần thứ nhất đã gọi setPhase("submitting"). Ref cập nhật
  // ngay lập tức, không đợi commit, nên chặn đúng double-click/Enter lặp mà
  // guard dựa thuần vào `phase` bỏ lọt.
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") resetAndClose();
    }
    window.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetAndClose đóng qua state setters ổn định, không cần liệt kê
  }, [open]);

  function resetAndClose() {
    setPhase("compose");
    setIntent(null);
    setMessage("");
    setScreenshot(null);
    setScreenshotError(null);
    setSubmitError(null);
    setResult(null);
    onClose();
  }

  async function handleSubmit() {
    if (submittingRef.current) return; // no-op guard — chặn double-click/Enter lặp, đồng bộ

    if (intent === null || message.trim().length === 0) {
      setSubmitError("validation");
      return;
    }
    if (screenshotError !== null) return; // ảnh đang lỗi client-side — chưa gửi được

    submittingRef.current = true;
    setSubmitError(null);
    setPhase("submitting");
    const attemptId = ++attemptIdRef.current;

    try {
      const formData = new FormData();
      formData.set("intent", intent);
      formData.set("message", message);
      appendIfAvailable(formData, "pageUrl", () => window.location.href);
      appendIfAvailable(formData, "userAgent", () => navigator.userAgent);
      appendIfAvailable(formData, "screenWidth", () => String(window.innerWidth));
      appendIfAvailable(formData, "screenHeight", () => String(window.innerHeight));
      if (screenshot) formData.set("screenshot", screenshot);

      const timeoutPromise = new Promise<{ error: "timeout" }>((resolve) => {
        setTimeout(() => resolve({ error: "timeout" }), SUBMIT_TIMEOUT_MS);
      });

      const outcome = await Promise.race([submitSupportTicket(formData), timeoutPromise]);

      // Attempt mới hơn đã bắt đầu (không xảy ra trong UI này vì nút đã
      // aria-disabled suốt "submitting", nhưng giữ làm bất biến phòng thủ).
      if (attemptIdRef.current !== attemptId) return;

      if ("error" in outcome) {
        if (outcome.error === "screenshot_rejected") {
          setScreenshot(null); // ảnh bị server từ chối — xoá, phần còn lại giữ nguyên
        }
        setSubmitError(outcome.error);
        setPhase("compose");
        return;
      }

      setResult(outcome);
      setPhase("success");
    } finally {
      submittingRef.current = false;
    }
  }

  if (!open) return null;

  const intentFieldError =
    submitError === "validation" && intent === null ? t("support.validation.intentRequired") : null;
  const messageFieldError =
    submitError === "validation" && message.trim().length === 0
      ? t("support.validation.messageRequired")
      : null;
  const screenshotFieldError: ScreenshotErrorReason | null =
    screenshotError ?? (submitError === "screenshot_rejected" ? "invalid_type" : null);
  const dialogErrorKey = submitError && submitError !== "validation" ? DIALOG_ERROR_KEY[submitError] : null;
  const disabled = phase === "submitting";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
    >
      <button
        aria-hidden
        tabIndex={-1}
        onClick={resetAndClose}
        className="absolute inset-0 cursor-default bg-[#1B1512]/40"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="border-border bg-background relative w-full max-w-sm rounded-lg border p-6 outline-none"
      >
        {phase === "success" && result ? (
          <div role="status" aria-live="polite">
            <p aria-hidden className="text-2xl">
              ✓
            </p>
            <h2 id="support-dialog-title" className="text-foreground font-serif text-xl">
              {t("support.ack.title")}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              {t("support.ack.message")}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("support.ack.reference", { ref: result.shortRef })}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={resetAndClose}
                className="bg-brand text-brand-foreground rounded-full px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-opacity hover:opacity-90"
              >
                {t("support.ack.close")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 id="support-dialog-title" className="text-foreground font-serif text-xl">
              {t("support.dialog.title")}
            </h2>

            {dialogErrorKey && (
              <p role="alert" className="text-brand mt-2 text-sm">
                {t(dialogErrorKey)}
              </p>
            )}

            <div className="mt-4">
              <IntentSelector
                value={intent}
                onChange={setIntent}
                error={intentFieldError}
                disabled={disabled}
              />
            </div>
            <MessageField
              value={message}
              onChange={setMessage}
              error={messageFieldError}
              disabled={disabled}
            />
            <ScreenshotAttachment
              file={screenshot}
              error={screenshotFieldError}
              onSelect={(file, error) => {
                setScreenshot(file);
                setScreenshotError(error);
              }}
              disabled={disabled}
            />

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={resetAndClose}
                className="border-border text-foreground hover:bg-accent rounded-[4px] border px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                aria-disabled={disabled}
                onClick={() => {
                  if (!disabled) handleSubmit();
                }}
                className="bg-brand text-brand-foreground rounded-full px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-opacity hover:opacity-90 aria-disabled:opacity-60"
              >
                {phase === "submitting" ? t("support.submitting") : t("support.submit")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Ghi field metadata vào FormData nếu đọc được — một API bị chặn (hiếm) chỉ
 * làm field đó VẮNG MẶT trong FormData, không chặn các field khác/không chặn
 * submit (AC-010: khoảng trống metadata không bao giờ chặn báo cáo).
 */
function appendIfAvailable(fd: FormData, key: string, get: () => string): void {
  try {
    const v = get();
    if (v) fd.set(key, v);
  } catch {
    // Capture không khả dụng — field đơn giản vắng mặt, đúng ý AC-010.
  }
}
