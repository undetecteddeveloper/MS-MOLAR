"use client";

// MetadataFields — nhóm input metadata đề (UI Spec §MetadataFields, D10 /
// Task 6.2 + v2.2 M6/M7). Controlled hoàn toàn bởi container (UploadForm S-01
// hoặc ReviewScreen S-03 — không tự giữ state, không mất khi lỗi).
// fieldErrors gộp từ 2 nguồn: validate client + fieldErrors server (cùng key).
//
// v2.2 (ADR-0007):
//   - `optionalMode` (S-01 Automatic): field để trống được, AI đọc từ file đề;
//     gate chuyển sang publish.
//   - Subject là <select> từ SUBJECTS (O-9 — vocabulary chuẩn hoá, value
//     canonical, nhãn tiếng Việt).
//   - `aiFilled` (S-03): field do AI điền chưa được tác giả chạm mang caption
//     "lấy từ file của bạn" (muted, aria-describedby — KHÔNG phải màu trạng
//     thái; session-derived theo O-7/TBD-07, mất khi reload là chủ đích).
//
// Theme "Sân trường" (2026-09-09): primitive Input/Select/Label, lỗi màu đỏ
// (`--destructive`; bản trước dùng màu brand, nay là xanh lá). Bỏ dấu sao:
// bắt buộc là mặc định của một form, ô KHÔNG bắt buộc mới cần nói ra — nhãn
// ghi "(không bắt buộc)". Ở chế độ Automatic mọi ô đều để trống được nên không
// ô nào mang chú thích đó (đầu khối đã nói "hệ thống tự điền").

import { Input, Label, Select } from "@/components/ui/input";
import { t } from "@/lib/copy";
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
  /** v2.2: field AI điền chưa chạm — marker "lấy từ file của bạn" (AC-034). */
  aiFilled?: ReadonlySet<MetaFieldName>;
}

const ERR_CLASS = "motion-unfold text-destructive mt-1.5 text-sm";
const AI_CLASS = "text-muted-foreground mt-1.5 block text-xs font-semibold";

export function MetadataFields({
  value,
  onChange,
  fieldErrors,
  disabled,
  optionalMode,
  aiFilled,
}: MetadataFieldsProps) {
  const ariaReq = !optionalMode;
  // Chú thích "(không bắt buộc)" chỉ có nghĩa khi CÓ ô bắt buộc để so.
  const optional = optionalMode ? null : (
    <span className="text-muted-foreground font-normal"> ({t("upload.optional")})</span>
  );

  /** Caption "lấy từ file của bạn" + aria-describedby cho field AI điền (M7). */
  function aiMark(field: MetaFieldName) {
    if (!aiFilled?.has(field)) return { caption: null, describedBy: undefined };
    const id = `meta-${field}-ai`;
    return {
      caption: (
        <span id={id} className={AI_CLASS}>
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label htmlFor="meta-title">{t("upload.fieldTitle")}</Label>
        <Input
          id="meta-title"
          value={value.title}
          onChange={(e) => onChange({ title: e.target.value })}
          maxLength={LIMITS.MAX_TITLE}
          disabled={disabled}
          aria-invalid={!!fieldErrors?.title}
          aria-required={ariaReq}
          aria-describedby={titleAi.describedBy}
        />
        {titleAi.caption}
        {fieldErrors?.title && <p className={ERR_CLASS}>{fieldErrors.title}</p>}
      </div>

      <div>
        <Label htmlFor="meta-subject">{t("upload.fieldSubject")}</Label>
        <Select
          id="meta-subject"
          value={value.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
          disabled={disabled}
          aria-invalid={!!fieldErrors?.subject}
          aria-required={ariaReq}
          aria-describedby={subjectAi.describedBy}
        >
          <option value="">
            {optionalMode ? t("upload.fromFile") : t("upload.selectSubject")}
          </option>
          {SUBJECTS.map((s) => (
            <option key={s} value={s}>
              {SUBJECT_LABELS[s]}
            </option>
          ))}
        </Select>
        {subjectAi.caption}
        {fieldErrors?.subject && <p className={ERR_CLASS}>{fieldErrors.subject}</p>}
      </div>

      <div>
        <Label htmlFor="meta-grade">{t("upload.fieldGrade")}</Label>
        <Input
          id="meta-grade"
          type="number"
          inputMode="numeric"
          min={LIMITS.MIN_GRADE}
          max={LIMITS.MAX_GRADE}
          value={value.grade}
          onChange={(e) => onChange({ grade: e.target.value })}
          disabled={disabled}
          aria-invalid={!!fieldErrors?.grade}
          aria-required={ariaReq}
          aria-describedby={gradeAi.describedBy}
        />
        {gradeAi.caption}
        {fieldErrors?.grade && <p className={ERR_CLASS}>{fieldErrors.grade}</p>}
      </div>

      <div>
        <Label htmlFor="meta-school">
          {t("common.school")}
          {optional}
        </Label>
        <Input
          id="meta-school"
          value={value.school}
          onChange={(e) => onChange({ school: e.target.value })}
          maxLength={LIMITS.MAX_SCHOOL}
          disabled={disabled}
          aria-invalid={!!fieldErrors?.school}
          aria-describedby={schoolAi.describedBy}
        />
        {schoolAi.caption}
        {fieldErrors?.school && <p className={ERR_CLASS}>{fieldErrors.school}</p>}
      </div>

      <div>
        <Label htmlFor="meta-semester">
          {t("common.semester")}
          {optional}
        </Label>
        <Select
          id="meta-semester"
          value={value.semester}
          onChange={(e) => onChange({ semester: e.target.value })}
          disabled={disabled}
          aria-invalid={!!fieldErrors?.semester}
          aria-describedby={semesterAi.describedBy}
        >
          <option value="">{t("common.none")}</option>
          <option value="HK1">HK1</option>
          <option value="HK2">HK2</option>
        </Select>
        {semesterAi.caption}
        {fieldErrors?.semester && <p className={ERR_CLASS}>{fieldErrors.semester}</p>}
      </div>

      <div>
        <Label htmlFor="meta-year">
          {t("upload.schoolYear")}
          {optional}
        </Label>
        <Input
          id="meta-year"
          type="number"
          inputMode="numeric"
          min={LIMITS.MIN_YEAR}
          max={LIMITS.MAX_YEAR}
          value={value.schoolYear}
          onChange={(e) => onChange({ schoolYear: e.target.value })}
          disabled={disabled}
          aria-invalid={!!fieldErrors?.schoolYear}
          aria-describedby={yearAi.describedBy}
        />
        {yearAi.caption}
        {fieldErrors?.schoolYear && <p className={ERR_CLASS}>{fieldErrors.schoolYear}</p>}
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="meta-duration">{t("upload.examDuration")}</Label>
        <div className="flex items-center gap-3">
          <Input
            id="meta-duration"
            type="number"
            inputMode="numeric"
            min={LIMITS.MIN_DURATION}
            max={LIMITS.MAX_DURATION}
            value={value.durationMinutes}
            onChange={(e) => onChange({ durationMinutes: e.target.value })}
            disabled={disabled}
            className="w-28"
            aria-invalid={!!fieldErrors?.durationMinutes}
            aria-required={ariaReq}
            aria-describedby={durationAi.describedBy}
          />
          <span className="text-muted-foreground text-sm">{t("upload.minutes")}</span>
        </div>
        {durationAi.caption}
        {fieldErrors?.durationMinutes && <p className={ERR_CLASS}>{fieldErrors.durationMinutes}</p>}
      </div>
    </div>
  );
}
