"use client";
import { useT } from "@/lib/i18n/client";

// ReportExam — kênh báo cáo đề published (UGC v2.0, AC-025/026 / Task 5.2).
// Nút "{t("report.title")}" mở dialog (khuôn LeaveExamDialog: scrim đen sơn mài,
// Esc/click scrim = đóng, focus trap tối thiểu). Đã report (từ hasReported hoặc
// sau khi gửi/trùng) → trạng thái tĩnh "✓ You reported this exam".
// Chỉ render cho user đã đăng nhập trên đề published (parent quyết định).

import { useEffect, useRef, useState } from "react";
import { reportExam } from "@/app/(layer4)/actions";
import { LIMITS } from "@/lib/ugc/limits";

interface ReportExamProps {
  examId: string;
  /** Đã report trước đó (từ hasReported) → hiện trạng thái tĩnh luôn. */
  initiallyReported: boolean;
}

export function ReportExam({ examId, initiallyReported }: ReportExamProps) {
  const t = useT();
  const [reported, setReported] = useState(initiallyReported);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    // Focus vào textarea khi mở (focus trap tối thiểu).
    textareaRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (reported) {
    return (
      <p className="text-muted-foreground text-sm" aria-live="polite">
        ✓ You reported this exam
      </p>
    );
  }

  async function onSubmit() {
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setError("Please describe the problem.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await reportExam(examId, trimmed);
    setSubmitting(false);
    if (!result.error) {
      setReported(true); // đã ghi nhận
      setOpen(false);
    } else if (result.error === "duplicate") {
      setReported(true); // đã report từ trước — trạng thái cuối
      setOpen(false);
    } else if (result.error === "empty") {
      setError("Please describe the problem.");
    } else {
      setError("Couldn't submit the report right now. Please try again.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-brand text-sm underline-offset-4 transition-colors hover:underline"
      >
        {t("report.title")}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-exam-title"
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
        >
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-[#1B1512]/40"
          />
          <div className="border-border bg-background relative w-full max-w-sm rounded-lg border p-6">
            <h2 id="report-exam-title" className="text-foreground font-serif text-xl">
              {t("report.title")}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
              Tell us what&apos;s wrong with this exam (incorrect answers, inappropriate content,
              etc.).
            </p>
            <textarea
              ref={textareaRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={LIMITS.MAX_REPORT_REASON}
              rows={4}
              className="border-border bg-card text-foreground focus:border-brand mt-4 w-full resize-none rounded-[4px] border p-3 text-sm outline-none"
              placeholder={t("report.placeholder")}
            />
            {error && (
              <p className="text-brand mt-2 text-sm" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="border-border text-foreground hover:bg-accent rounded-[4px] border px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting}
                className="bg-brand text-brand-foreground rounded-full px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {submitting ? t("report.submitting") : t("report.submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
