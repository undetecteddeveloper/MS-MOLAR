"use client";

// ReportExam — kênh báo cáo đề đã đăng (UGC v2.0, AC-025/026 / Task 5.2). Chỉ
// render cho người đã đăng nhập trên đề đã đăng (trang cha quyết định).
//
// Theme "Sân trường" (2026-09-06): nút mở là một dòng chữ dịu kèm icon cờ —
// hành động phụ, không tranh mắt với nút Làm bài. Hộp thoại: scrim xanh đen
// mờ, thẻ trắng bo 18px không viền không bóng; nằm sát đáy trên điện thoại
// (ngón cái với tới), căn giữa từ 640px. Trạng thái đã báo cáo có dấu tích +
// câu chữ, không chỉ đổi màu (§4.3). Câu chữ qua lib/copy — bản trước còn để
// lọt chuỗi tiếng Anh cứng trong mã.
//
// Cơ chế giữ nguyên: Esc / bấm scrim = đóng, tiêu điểm vào ô nhập khi mở,
// reportExam() Server Action, kết quả "duplicate" coi như đã báo cáo.

import { useEffect, useRef, useState } from "react";
import { Check, Flag } from "lucide-react";
// eslint-disable-next-line no-restricted-imports -- rò chéo có sẵn trước B4 (2026-09-03): reportExam sống cạnh moderateExam ở authoring/actions. Xem ARCHITECTURE.md § Import chéo.
import { reportExam } from "@/features/authoring/actions";
import { LIMITS } from "@/lib/ugc/limits";
import { t } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";

interface ReportExamProps {
  examId: string;
  /** Đã report trước đó (từ hasReported) → hiện trạng thái tĩnh luôn. */
  initiallyReported: boolean;
}

export function ReportExam({ examId, initiallyReported }: ReportExamProps) {
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
      <p
        className="text-muted-foreground inline-flex min-h-11 items-center gap-1.5 text-sm"
        aria-live="polite"
      >
        <Check aria-hidden className="text-success size-4" />
        {t("report.reported")}
      </p>
    );
  }

  async function onSubmit() {
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setError(t("report.errorEmpty"));
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
      setError(t("report.errorEmpty"));
    } else {
      setError(t("report.errorGeneric"));
    }
  }

  return (
    <>
      {/* `-ml-5` bù phần đệm của nút để icon cờ thẳng mép trái với nội dung. */}
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground -ml-5 self-start"
      >
        <Flag aria-hidden />
        {t("report.title")}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-exam-title"
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6"
        >
          <button
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="bg-foreground/40 absolute inset-0 cursor-default"
          />
          <div className="bg-background rounded-card relative flex w-full max-w-sm flex-col gap-3 p-5">
            <h2 id="report-exam-title" className="text-foreground text-lg font-semibold">
              {t("report.title")}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">{t("report.intro")}</p>
            <Textarea
              ref={textareaRef}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={LIMITS.MAX_REPORT_REASON}
              rows={4}
              aria-labelledby="report-exam-title"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "report-exam-error" : undefined}
              className="min-h-0 resize-none text-sm"
              placeholder={t("report.placeholder")}
            />
            {error && (
              <p id="report-exam-error" className="text-destructive text-sm" role="alert">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button type="button" onClick={onSubmit} disabled={submitting}>
                {submitting ? t("report.submitting") : t("report.submit")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
