"use client";

// UploadForm — container S-01 (UI Spec §UploadForm / Task 6.2 + v2.2 M6). MỘT
// nơi giữ state: metadata + 2 file. KHÔNG BAO GIỜ clear khi lỗi (giữ nguyên để
// sửa). Gọi extractAndAssemble (server): thành công → action tự redirect
// /me/exams/[id] (?src=auto ở chế độ Automatic); thất bại → hiện lỗi, giữ form.
//
// v2.2 (ADR-0007) — Entry Mode THÀNH THẬT:
//   - Automatic (mặc định): khối metadata gấp lại "filled in automatically",
//     field optional (AC-037) — chỉ validate 2 file; AI đọc metadata từ trang
//     1 file đề; gate chuyển sang publish. Đã gõ gì thì giá trị đó THẮNG AI.
//   - Manual: hành vi v2.1 — validate required client-side trước submit
//     (AC-036), server validateExamMeta vẫn là nguồn sự thật cuối.
//   - Đổi mode không xoá giá trị; khối metadata tự mở khi có giá trị đã gõ
//     hoặc có lỗi (không bao giờ giấu field đang lỗi — a11y UI Spec §v2.2).
// KHÔNG bao gồm navbar — do (layer4)/layout.tsx cung cấp.

import { useState, useTransition } from "react";
import { extractAndAssemble } from "@/app/(layer4)/actions";
import { useT } from "@/lib/i18n/client";
import type { Translate } from "@/lib/i18n/translate";
import { LIMITS } from "@/lib/ugc/limits";
import type { UgcActionError } from "@/lib/ugc/types";
import {
  MetadataFields,
  type ExamMetaFormValue,
} from "./MetadataFields";
import { FileUploadFields } from "./FileUploadFields";
import { ImportInstructions } from "./ImportInstructions";
import { EntryModeField, type EntryMode } from "./EntryModeField";
import { ExtractionProgress } from "./ExtractionProgress";

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
  if (!m.grade.trim() || !Number.isInteger(grade) || grade < LIMITS.MIN_GRADE || grade > LIMITS.MAX_GRADE) {
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
  const t = useT();
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

    if (Object.keys(requiredErrors).length > 0 || nextFileErrors.question || nextFileErrors.answer) {
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl text-foreground">{t("upload.title")}</h1>
        <div className="mt-2 h-px w-12 bg-ring" />
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("upload.intro")}</p>
      </div>

      <ImportInstructions />

      {error && (
        <div
          role="alert"
          className="rounded-[4px] border border-brand bg-brand/8 px-4 py-3 text-sm text-brand"
        >
          {error.message}
          {error.errors && error.errors.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {error.errors.map((e, i) => (
                <li key={i}>{e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <EntryModeField value={entryMode} onChange={setEntryMode} disabled={pending} />

      {isAutomatic ? (
        // Khối metadata gấp/mở (cùng idiom ImportInstructions: grid-rows 0fr↔1fr).
        <div className="rounded-[4px] border border-border">
          <button
            type="button"
            onClick={() => setMetaOpen((v) => !v)}
            aria-expanded={metaExpanded}
            className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left text-sm font-medium text-foreground"
          >
            <span>
              {t("upload.examDetails")}{" "}
              <span className="font-normal text-muted-foreground">
                {t("upload.filledAutomatically")}
              </span>
            </span>
            <span
              aria-hidden
              className={[
                "text-ring transition-transform duration-300",
                metaExpanded ? "rotate-180" : "",
              ].join(" ")}
            >
              ▾
            </span>
          </button>
          <div
            className={[
              "grid transition-[grid-template-rows] duration-300 ease-out",
              metaExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            ].join(" ")}
          >
            <div className="overflow-hidden">
              <div className="px-4 pb-4">
                <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                  {t("upload.leaveEmptyHint")}
                </p>
                <MetadataFields
                  value={meta}
                  onChange={(patch) => setMeta((m) => ({ ...m, ...patch }))}
                  fieldErrors={fieldErrors}
                  disabled={pending}
                  optionalMode
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <MetadataFields
          value={meta}
          onChange={(patch) => setMeta((m) => ({ ...m, ...patch }))}
          fieldErrors={fieldErrors}
          disabled={pending}
        />
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

      {pending && <ExtractionProgress metaStep={isAutomatic} />}

      {/* Canh GIỮA ở mọi bề rộng — trước đây desktop canh trái riêng (đọc
          nhịp theo lề trái của form), nhưng vì 2 dropzone phía trên đứng
          thành CẶP đối xứng (grid 2 cột đều nhau), một nút canh trái bên
          dưới đọc như lệch tâm so với cặp đó chứ không phải "điểm kết thúc
          rõ ràng" như dự tính — engineer xác nhận lệch (2026-08-09). Canh
          giữa để nút luôn là điểm hội tụ của cả 2 khung phía trên, ở mọi
          breakpoint. */}
      <div className="flex justify-center pt-2">
        <button
          type="button"
          onClick={onSubmit}
          disabled={pending}
          className="min-h-11 rounded-[4px] bg-brand px-7 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-brand-foreground transition-[background-color,transform] duration-200 hover:bg-[#8F2523] active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60"
        >
          {pending ? t("common.processing") : t("upload.start")}
        </button>
      </div>
    </div>
  );
}
