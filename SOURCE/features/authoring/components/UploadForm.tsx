"use client";

// UploadForm — container S-01 (UI Spec §UploadForm / Task 6.2 + v2.2 M6). MỘT
// nơi giữ state: metadata + 2 file. KHÔNG BAO GIỜ clear khi lỗi (giữ nguyên để
// sửa). Gọi extractAndAssemble (server): thành công → action tự redirect
// /me/exams/[id] (?src=auto ở chế độ Automatic); thất bại → hiện lỗi, giữ form.
//
// v2.2 (ADR-0007) — Entry Mode THÀNH THẬT:
//   - Automatic (mặc định): khối metadata gấp lại "hệ thống tự điền", field
//     optional (AC-037) — chỉ validate 2 file; AI đọc metadata từ trang 1 file
//     đề; gate chuyển sang publish. Đã gõ gì thì giá trị đó THẮNG AI.
//   - Manual: hành vi v2.1 — validate required client-side trước submit
//     (AC-036), server validateExamMeta vẫn là nguồn sự thật cuối.
//   - Đổi mode không xoá giá trị; khối metadata tự mở khi có giá trị đã gõ
//     hoặc có lỗi (không bao giờ giấu field đang lỗi — a11y UI Spec §v2.2).
//
// Theme "Sân trường" (2026-09-09): tiêu đề trang do page.tsx dựng (PageHeader);
// hướng dẫn và khối thông tin đề là thẻ surface; chế độ nhập là hai chip; lỗi
// màu đỏ (bản trước tô màu brand — nay là xanh lá). Nút Bắt đầu là hành động
// chính DUY NHẤT của màn nên cao 52px (§2), trải hết bề ngang dưới 640px, căn
// trái từ đó theo quy tắc căn trái toàn site (§3) — bản 2026-08-09 căn giữa vì
// cặp ô thả file đối xứng, nhưng nay mọi khối trên nó đều là thẻ căn trái nên
// một nút lệch tâm mới là thứ đọc như lỗi. Khối "đang đọc file" THẾ CHỖ nút
// khi đang chạy: không có gì phía trên bị đẩy xuống dưới ngón tay.
// KHÔNG bao gồm navbar — do (authoring)/layout.tsx cung cấp.

import { useState, useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { extractAndAssemble } from "@/features/authoring/actions";
import { t } from "@/lib/copy";
import type { Translate } from "@/lib/copy";
import { LIMITS } from "@/lib/ugc/limits";
import type { UgcActionError } from "@/lib/ugc/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  MetadataFields,
  type ExamMetaFormValue,
} from "@/features/authoring/components/MetadataFields";
import { FileUploadFields } from "@/features/authoring/components/FileUploadFields";
import { ImportInstructions } from "@/features/authoring/components/ImportInstructions";
import { EntryModeField, type EntryMode } from "@/features/authoring/components/EntryModeField";
import { ExtractionProgress } from "@/features/authoring/components/ExtractionProgress";

const EMPTY_META: ExamMetaFormValue = {
  title: "",
  subject: "",
  grade: "",
  durationMinutes: "",
  school: "",
  schoolYear: "",
  semester: "",
};

/** Validate required field phía client — CHỈ chế độ Manual (AC-036). Nhận `t`
 * làm tham số vì đây là hàm thuần ngoài component: hook chỉ gọi được bên trong. */
function validateRequired(m: ExamMetaFormValue, t: Translate): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!m.title.trim()) errors.title = t("upload.errTitleRequired");
  if (!m.subject.trim()) errors.subject = t("upload.errSubjectRequired");
  const grade = Number(m.grade);
  if (
    !m.grade.trim() ||
    !Number.isInteger(grade) ||
    grade < LIMITS.MIN_GRADE ||
    grade > LIMITS.MAX_GRADE
  ) {
    errors.grade = t("upload.errGradeRange", { min: LIMITS.MIN_GRADE, max: LIMITS.MAX_GRADE });
  }
  const duration = Number(m.durationMinutes);
  if (
    !m.durationMinutes.trim() ||
    !Number.isInteger(duration) ||
    duration < LIMITS.MIN_DURATION ||
    duration > LIMITS.MAX_DURATION
  ) {
    errors.durationMinutes = t("upload.errDurationRequired");
  }
  return errors;
}

export function UploadForm() {
  const [meta, setMeta] = useState<ExamMetaFormValue>(EMPTY_META);
  const [entryMode, setEntryMode] = useState<EntryMode>("automatic");
  const [metaOpen, setMetaOpen] = useState(false);
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [answerFile, setAnswerFile] = useState<File | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string> | null>(null);
  const [fileErrors, setFileErrors] = useState<{ question?: string; answer?: string }>({});
  const [error, setError] = useState<UgcActionError | null>(null);
  const [pending, startTransition] = useTransition();

  // Server fieldErrors (sau submit) đè lên client errors (trước submit) — cùng
  // key name (title/subject/grade/durationMinutes/school/schoolYear/semester).
  const fieldErrors = error?.fieldErrors ?? clientErrors ?? undefined;

  const isAutomatic = entryMode === "automatic";
  const hasTypedMeta = Object.values(meta).some((v) => v.trim() !== "");
  const hasMetaErrors = !!fieldErrors && Object.keys(fieldErrors).length > 0;
  // Không bao giờ giấu field có giá trị/lỗi sau disclosure gấp (UI Spec §v2.2).
  const metaExpanded = !isAutomatic || metaOpen || hasTypedMeta || hasMetaErrors;

  function onSubmit() {
    if (pending) return;

    // Automatic: metadata optional (AC-037) — chỉ chặn thiếu file.
    const requiredErrors = isAutomatic ? {} : validateRequired(meta, t);
    const nextFileErrors: { question?: string; answer?: string } = {};
    if (!questionFile) nextFileErrors.question = t("upload.errQuestionFileRequired");
    if (!answerFile) nextFileErrors.answer = t("upload.errAnswerFileRequired");

    if (
      Object.keys(requiredErrors).length > 0 ||
      nextFileErrors.question ||
      nextFileErrors.answer
    ) {
      setClientErrors(Object.keys(requiredErrors).length > 0 ? requiredErrors : null);
      setFileErrors(nextFileErrors);
      return;
    }

    setClientErrors(null);
    setFileErrors({});
    setError(null);

    const fd = new FormData();
    fd.set("entryMode", entryMode);
    fd.set("title", meta.title);
    fd.set("subject", meta.subject);
    fd.set("grade", meta.grade);
    fd.set("durationMinutes", meta.durationMinutes);
    fd.set("school", meta.school);
    fd.set("schoolYear", meta.schoolYear);
    fd.set("semester", meta.semester);
    fd.set("questionFile", questionFile as File);
    fd.set("answerFile", answerFile as File);

    startTransition(async () => {
      // Thành công → action gọi redirect() (ném NEXT_REDIRECT, Next xử lý).
      // Chỉ nhận về giá trị khi THẤT BẠI.
      const result = await extractAndAssemble(fd);
      if (result?.error) setError(result.error);
    });
  }

  const metaFields = (
    <MetadataFields
      value={meta}
      onChange={(patch) => setMeta((m) => ({ ...m, ...patch }))}
      fieldErrors={fieldErrors}
      disabled={pending}
      optionalMode={isAutomatic}
    />
  );

  return (
    // `pb-14` dưới 640px: nút Bắt đầu trải hết bề ngang, và ở cuối trang nút
    // hỗ trợ (fixed, góc phải, 56px trên BottomNav) đè lên 56px bên phải của
    // nó — đo 2026-09-09 ở 360px: nút 604–656, nút hỗ trợ 608–664. Đệm thêm
    // đúng chiều cao nút hỗ trợ để Bắt đầu cuộn lên được khỏi vùng đó. Từ
    // 640px nút tự co bề rộng, căn trái, không còn chạm góc phải.
    <div className="flex flex-col gap-5 pb-14 sm:pb-0">
      <ImportInstructions />

      {error && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive rounded-card px-4 py-3 text-sm"
        >
          <p className="font-semibold">{error.message}</p>
          {error.errors && error.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5 leading-relaxed">
              {error.errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <EntryModeField value={entryMode} onChange={setEntryMode} disabled={pending} />

      {isAutomatic ? (
        // Khối metadata gấp/mở — cùng khuôn ImportInstructions: không animate
        // chiều cao (§7), nội dung tỏ dần bằng .motion-unfold.
        <Card padding="none">
          <button
            type="button"
            onClick={() => setMetaOpen((v) => !v)}
            aria-expanded={metaExpanded}
            aria-controls="exam-details-body"
            className="focus-visible:ring-ring/40 rounded-card flex min-h-12 w-full items-center justify-between gap-4 px-4 py-3 text-left focus-visible:ring-3 focus-visible:outline-none sm:px-5"
          >
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-semibold">{t("upload.examDetails")}</span>
              <span className="text-muted-foreground text-sm">
                {t("upload.filledAutomatically")}
              </span>
            </span>
            <ChevronDown
              aria-hidden
              className={cn(
                "text-muted-foreground size-5 shrink-0 transition-[rotate] ease-out",
                metaExpanded && "rotate-180"
              )}
            />
          </button>
          {metaExpanded && (
            <div id="exam-details-body" className="motion-unfold px-4 pb-4 sm:px-5 sm:pb-5">
              <p className="text-muted-foreground mb-4 max-w-prose text-sm leading-relaxed">
                {t("upload.leaveEmptyHint")}
              </p>
              {metaFields}
            </div>
          )}
        </Card>
      ) : (
        <Card as="section" aria-labelledby="exam-details-heading">
          <h2 id="exam-details-heading" className="text-base font-semibold">
            {t("upload.examDetails")}
          </h2>
          {metaFields}
        </Card>
      )}

      <FileUploadFields
        questionFile={questionFile}
        answerFile={answerFile}
        onSelectQuestion={(f) => {
          setQuestionFile(f);
          if (f) setFileErrors((fe) => ({ ...fe, question: undefined }));
        }}
        onSelectAnswer={(f) => {
          setAnswerFile(f);
          if (f) setFileErrors((fe) => ({ ...fe, answer: undefined }));
        }}
        disabled={pending}
        questionError={fileErrors.question}
        answerError={fileErrors.answer}
      />

      {pending ? (
        <ExtractionProgress metaStep={isAutomatic} />
      ) : (
        <div className="pt-1">
          <Button type="button" size="lg" onClick={onSubmit} className="w-full sm:w-auto">
            {t("upload.start")}
          </Button>
        </div>
      )}
    </div>
  );
}
