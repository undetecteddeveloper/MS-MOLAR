// UGC Exam Upload v2.0 — validate input S-01 (Task 4.1, AC-003/005/006).
//
// THUẦN (không I/O) để unit-test được: metadata form + thuộc tính file.
// Reject TRƯỚC mọi lời gọi AI (Design Doc §extractAndAssemble Validation).
// Số trang PDF kiểm ở action qua lib/ugc/pdf.ts (cần mupdf, không thuần).

import { makeUgcError } from "./errorCopy";
import { LIMITS, type AllowedMime } from "./limits";
import { normalizeSubject } from "./subjects";
import type { ExamMeta, UgcError } from "./types";

export type ExamMetaFieldErrors = Partial<
  Record<
    "title" | "subject" | "grade" | "durationMinutes" | "school" | "schoolYear" | "semester",
    string
  >
>;

/** Giá trị thô từ FormData (string | null). */
export type RawExamMetaInput = {
  title: string | null;
  subject: string | null;
  grade: string | null;
  durationMinutes: string | null;
  school: string | null;
  schoolYear: string | null;
  semester: string | null;
};

function parseIntStrict(v: string): number | null {
  if (!/^-?\d+$/.test(v.trim())) return null;
  return Number.parseInt(v, 10);
}

/** Validate + parse metadata đề. fieldErrors rỗng ⇔ meta có giá trị. */
export function validateExamMeta(raw: RawExamMetaInput): {
  meta: ExamMeta | null;
  fieldErrors: ExamMetaFieldErrors;
} {
  const fieldErrors: ExamMetaFieldErrors = {};

  const title = raw.title?.trim() ?? "";
  if (title.length === 0) fieldErrors.title = "Title is required.";
  else if (title.length > LIMITS.MAX_TITLE)
    fieldErrors.title = `Title must be at most ${LIMITS.MAX_TITLE} characters.`;

  // TD-016: đường Manual TỪNG ghi thẳng chuỗi thô vào exams.subject, rồi
  // cascade xuống questions.subject/topic — nguồn của 12 dòng mang "Toán" thay
  // vì canonical "Math". S-01 render <select> từ SUBJECTS nên UI không tạo ra
  // được giá trị lạ nữa, nhưng đây là SERVER ACTION: FormData đến từ client và
  // không được tin. Mọi đường ghi subject khác (parseTypedMeta, saveExam,
  // normalizeMeta) đã canonical hoá từ trước; đây là đường cuối còn hở.
  //
  // Quy đổi TRƯỚC rồi mới đòi canonical (không phải isSubject thẳng): alias
  // "Toán"/"Vật lí"/… sửa được thì sửa, chỉ từ chối cái không map nổi — cùng
  // hàm mà đường Automatic dùng, nên hai đường không thể lệch kết luận.
  const subjectRaw = raw.subject?.trim() ?? "";
  let subject = "";
  if (subjectRaw.length === 0) {
    fieldErrors.subject = "Subject is required.";
  } else {
    const canonical = normalizeSubject(subjectRaw);
    if (canonical === null) fieldErrors.subject = "Pick a subject from the list.";
    else subject = canonical;
  }

  const grade = raw.grade ? parseIntStrict(raw.grade) : null;
  if (grade === null || grade < LIMITS.MIN_GRADE || grade > LIMITS.MAX_GRADE)
    fieldErrors.grade = `Grade must be between ${LIMITS.MIN_GRADE} and ${LIMITS.MAX_GRADE}.`;

  const durationMinutes = raw.durationMinutes ? parseIntStrict(raw.durationMinutes) : null;
  if (
    durationMinutes === null ||
    durationMinutes < LIMITS.MIN_DURATION ||
    durationMinutes > LIMITS.MAX_DURATION
  )
    fieldErrors.durationMinutes = `Duration must be between ${LIMITS.MIN_DURATION} and ${LIMITS.MAX_DURATION} minutes.`;

  const school = raw.school?.trim() || undefined;
  if (school && school.length > LIMITS.MAX_SCHOOL)
    fieldErrors.school = `School must be at most ${LIMITS.MAX_SCHOOL} characters.`;

  let schoolYear: number | undefined;
  if (raw.schoolYear?.trim()) {
    const y = parseIntStrict(raw.schoolYear);
    if (y === null || y < LIMITS.MIN_YEAR || y > LIMITS.MAX_YEAR) {
      fieldErrors.schoolYear = `Year must be between ${LIMITS.MIN_YEAR} and ${LIMITS.MAX_YEAR}.`;
    } else {
      schoolYear = y;
    }
  }

  let semester: "HK1" | "HK2" | undefined;
  if (raw.semester?.trim()) {
    if (raw.semester !== "HK1" && raw.semester !== "HK2") {
      fieldErrors.semester = "Semester must be HK1 or HK2.";
    } else {
      semester = raw.semester;
    }
  }

  if (Object.keys(fieldErrors).length > 0) return { meta: null, fieldErrors };
  return {
    meta: {
      title,
      subject,
      grade: grade as number,
      durationMinutes: durationMinutes as number,
      school,
      schoolYear,
      semester,
    },
    fieldErrors: {},
  };
}

export type UploadFileCheck = { ok: true } | { ok: false; message: string; errors?: UgcError[] };

/** Check loại + kích thước file (thuần — nhận thuộc tính, không nhận File). */
export function checkUploadFile(file: { type: string; size: number }): UploadFileCheck {
  if (!(LIMITS.ALLOWED_MIME as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      message: "Unsupported file type. Allowed: PNG, JPEG, WebP, or PDF.",
    };
  }
  if (file.size > LIMITS.MAX_FILE_BYTES) {
    return {
      ok: false,
      message: `That file is too large (max ${Math.round(LIMITS.MAX_FILE_BYTES / (1024 * 1024))} MB).`,
      errors: [makeUgcError("FILE_TOO_LARGE", null)],
    };
  }
  return { ok: true };
}

/** Type guard cho mediaType sau khi checkUploadFile pass. */
export function isAllowedMime(type: string): type is AllowedMime {
  return (LIMITS.ALLOWED_MIME as readonly string[]).includes(type);
}
