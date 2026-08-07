"use client";

// MetadataFields — nhóm input metadata đề (UI Spec §MetadataFields, D10 /
// Task 6.2 + v2.2 M6/M7). Controlled hoàn toàn bởi container (UploadForm S-01
// hoặc ReviewScreen S-03 — không tự giữ state, không mất khi lỗi).
// fieldErrors gộp từ 2 nguồn: validate client + fieldErrors server (cùng key).
//
// v2.2 (ADR-0007):
//   - `optionalMode` (S-01 Automatic): bỏ dấu * / aria-required — field để
//     trống được, AI đọc từ file đề; gate chuyển sang publish.
//   - Subject là <select> từ SUBJECTS (O-9 — vocabulary chuẩn hoá, value
//     canonical, nhãn tiếng Việt).
//   - `aiFilled` (S-03): field do AI điền chưa được tác giả chạm mang caption
//     "from your file" (muted, aria-describedby — KHÔNG phải màu trạng thái;
//     session-derived theo O-7/TBD-07, mất khi reload là chủ đích).
// Restyle theo prototype UI_Layer4_main: nhãn eyebrow, viền focus vàng đồng
// (--ring); đỏ dành riêng cho lỗi.

import { useT } from "@/lib/i18n/client";
import { LIMITS } from "@/lib/ugc/limits";
import { SUBJECTS, SUBJECT_LABELS } from "@/lib/ugc/subjects";
import type { MetaFieldName } from "@/lib/ugc/types";

export type ExamMetaFormValue = {
  title: string;
  subject: string;
  grade: string;
  durationMinutes: string;
  school: string;
  schoolYear: string;
  semester: string;
};

interface MetadataFieldsProps {
  value: ExamMetaFormValue;
  onChange: (patch: Partial<ExamMetaFormValue>) => void;
  fieldErrors?: Record<string, string>;
  disabled?: boolean;
  /** v2.2: chế độ Automatic S-01 — field required thành optional (AC-037). */
  optionalMode?: boolean;
  /** v2.2: field AI điền chưa chạm — marker "from your file" (AC-034). */
  aiFilled?: ReadonlySet<MetaFieldName>;
}

const labelCls = "eyebrow block";
const errCls = "mt-1 animate-in fade-in text-xs text-brand duration-200";
const aiCls = "eyebrow mt-1 block text-muted-foreground";

function fieldInputCls(hasError: boolean) {
  return [
    "mt-1.5 w-full rounded-[4px] border bg-transparent px-3 py-2.5 text-sm text-foreground outline-none transition-colors duration-200 disabled:opacity-60",
    hasError ? "border-brand" : "border-border focus:border-ring",
  ].join(" ");
}

export function MetadataFields({
  value,
  onChange,
  fieldErrors,
  disabled,
  optionalMode,
  aiFilled,
}: MetadataFieldsProps) {
  const t = useT();
  const req = optionalMode ? null : <span className="text-brand">*</span>;
  const ariaReq = !optionalMode;

  /** Caption "from your file" + aria-describedby cho field AI điền (M7). */
  function aiMark(field: MetaFieldName) {
    if (!aiFilled?.has(field)) return { caption: null, describedBy: undefined };
    const id = `meta-${field}-ai`;
    return {
      caption: (
        <span id={id} className={aiCls}>
          {t("upload.fromYourFile")}
        </span>
      ),
      describedBy: id,
    };
  }

  const titleAi = aiMark("title");
  const subjectAi = aiMark("subject");
  const gradeAi = aiMark("grade");
  const schoolAi = aiMark("school");
  const semesterAi = aiMark("semester");
  const yearAi = aiMark("schoolYear");
  const durationAi = aiMark("durationMinutes");

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="meta-title" className={labelCls}>
          {t("upload.fieldTitle")} {req}
        </label>
        <input
          id="meta-title"
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
          maxLength={LIMITS.MAX_TITLE}
          disabled={disabled}
          className={fieldInputCls(!!fieldErrors?.title)}
          aria-invalid={!!fieldErrors?.title}
          aria-required={ariaReq}
          aria-describedby={titleAi.describedBy}
        />
        {titleAi.caption}
        {fieldErrors?.title && <p className={errCls}>{fieldErrors.title}</p>}
      </div>

      <div>
        <label htmlFor="meta-subject" className={labelCls}>
          {t("upload.fieldSubject")} {req}
        </label>
        <select
          id="meta-subject"
          value={value.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          disabled={disabled}
          className={fieldInputCls(!!fieldErrors?.subject)}
          aria-invalid={!!fieldErrors?.subject}
          aria-required={ariaReq}
          aria-describedby={subjectAi.describedBy}
        >
          <option value="">
            {optionalMode ? t("upload.fromFile") : t("upload.selectSubject")}
          </option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {SUBJECT_LABELS[s]} ({s})
            </option>
          ))}
        </select>
        {subjectAi.caption}
        {fieldErrors?.subject && <p className={errCls}>{fieldErrors.subject}</p>}
      </div>

      <div>
        <label htmlFor="meta-grade" className={labelCls}>
          {t("upload.fieldGrade")} {req}
        </label>
        <input
          id="meta-grade"
          type="number"
          inputMode="numeric"
          min={LIMITS.MIN_GRADE}
          max={LIMITS.MAX_GRADE}
          value={value.grade}
          onChange={(e) => onChange({ grade: e.target.value })}
          disabled={disabled}
          className={fieldInputCls(!!fieldErrors?.grade)}
          aria-invalid={!!fieldErrors?.grade}
          aria-required={ariaReq}
          aria-describedby={gradeAi.describedBy}
        />
        {gradeAi.caption}
        {fieldErrors?.grade && <p className={errCls}>{fieldErrors.grade}</p>}
      </div>

      <div>
        <label htmlFor="meta-school" className={labelCls}>
          {t("common.school")}
        </label>
        <input
          id="meta-school"
          value={value.school}
          onChange={(e) => onChange({ school: e.target.value })}
          maxLength={LIMITS.MAX_SCHOOL}
          disabled={disabled}
          className={fieldInputCls(!!fieldErrors?.school)}
          aria-invalid={!!fieldErrors?.school}
          aria-describedby={schoolAi.describedBy}
        />
        {schoolAi.caption}
        {fieldErrors?.school && <p className={errCls}>{fieldErrors.school}</p>}
      </div>

      <div>
        <label htmlFor="meta-semester" className={labelCls}>
          {t("common.semester")}
        </label>
        <select
          id="meta-semester"
          value={value.semester}
          onChange={(e) => onChange({ semester: e.target.value })}
          disabled={disabled}
          className={fieldInputCls(!!fieldErrors?.semester)}
          aria-invalid={!!fieldErrors?.semester}
          aria-describedby={semesterAi.describedBy}
        >
          <option value="">{t("common.none")}</option>
          <option value="HK1">HK1</option>
          <option value="HK2">HK2</option>
        </select>
        {semesterAi.caption}
        {fieldErrors?.semester && <p className={errCls}>{fieldErrors.semester}</p>}
      </div>

      <div>
        <label htmlFor="meta-year" className={labelCls}>
          {t("upload.schoolYear")}
        </label>
        <input
          id="meta-year"
          type="number"
          inputMode="numeric"
          min={LIMITS.MIN_YEAR}
          max={LIMITS.MAX_YEAR}
          value={value.schoolYear}
          onChange={(e) => onChange({ schoolYear: e.target.value })}
          disabled={disabled}
          className={fieldInputCls(!!fieldErrors?.schoolYear)}
          aria-invalid={!!fieldErrors?.schoolYear}
          aria-describedby={yearAi.describedBy}
        />
        {yearAi.caption}
        {fieldErrors?.schoolYear && <p className={errCls}>{fieldErrors.schoolYear}</p>}
      </div>

      <div className="sm:col-span-2">
        <label htmlFor="meta-duration" className={labelCls}>
          {t("upload.examDuration")} {req}
        </label>
        <div className="mt-1.5 flex items-center gap-3">
          <input
            id="meta-duration"
            type="number"
            inputMode="numeric"
            min={LIMITS.MIN_DURATION}
            max={LIMITS.MAX_DURATION}
            value={value.durationMinutes}
            onChange={(e) => onChange({ durationMinutes: e.target.value })}
            disabled={disabled}
            className={[
              "w-28 rounded-[4px] border bg-transparent px-3 py-2.5 text-sm text-foreground outline-none transition-colors duration-200 disabled:opacity-60",
              fieldErrors?.durationMinutes ? "border-brand" : "border-border focus:border-ring",
            ].join(" ")}
            aria-invalid={!!fieldErrors?.durationMinutes}
            aria-required={ariaReq}
            aria-describedby={durationAi.describedBy}
          />
          <span className="text-sm text-muted-foreground">{t("upload.minutes")}</span>
        </div>
        {durationAi.caption}
        {fieldErrors?.durationMinutes && (
          <p className={errCls}>{fieldErrors.durationMinutes}</p>
        )}
      </div>
    </div>
  );
}
