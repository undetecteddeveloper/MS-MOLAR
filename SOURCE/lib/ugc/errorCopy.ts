// UGC Exam Upload v2.1 — map UgcErrorCode → copy cho ExtractionErrorPanel
// (Design Doc §Error-code → review-panel copy + §v2.1). Message bake sẵn vào
// UgcError để UI chỉ việc hiển thị. v2.1: nhãn câu nhận biết PHẦN — caller
// truyền partNumber CHỈ với đề nhiều phần (đề 1 phần giữ nguyên "Câu N").

import type { Translate } from "../i18n/translate";
import { LIMITS } from "./limits";
import type { MetaFieldName, UgcError, UgcErrorCode, UgcErrorParams } from "./types";

export type { UgcErrorParams };

/** Nhãn hiển thị của field metadata trong copy lỗi META_*. */
const META_FIELD_LABELS: Record<MetaFieldName, string> = {
  title: "the title",
  subject: "the subject",
  grade: "the grade",
  durationMinutes: "the duration",
  school: "the school",
  schoolYear: "the school year",
  semester: "the semester",
};

/** Khoảng hợp lệ để copy META_INVALID nêu đích danh giới hạn. */
const META_FIELD_RANGES: Partial<Record<MetaFieldName, string>> = {
  grade: `${LIMITS.MIN_GRADE}–${LIMITS.MAX_GRADE}`,
  durationMinutes: `${LIMITS.MIN_DURATION}–${LIMITS.MAX_DURATION} minutes`,
  schoolYear: `${LIMITS.MIN_YEAR}–${LIMITS.MAX_YEAR}`,
};

/** Nhãn định danh câu: "Phần 2 Câu 3" (đề nhiều phần) hoặc "Câu 3". */
function label(n: number | null, part: number | undefined): string {
  return part != null ? `Phần ${part} Câu ${n}` : `Câu ${n}`;
}

/** Điểm cho người đọc: bỏ đuôi nhị phân, bỏ số 0 thừa ("8.5", không "8.50",
 *  cũng không "9.999999999999998"). Hai chữ số thập phân là đủ — bậc nhỏ nhất
 *  của biểu điểm là 0.1 và tác giả không gõ được gì mịn hơn 0.01. */
function formatPoints(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function message(
  code: UgcErrorCode,
  n: number | null,
  p: UgcErrorParams,
): string {
  const q = label(n, p.partNumber);
  switch (code) {
    case "NO_QUESTIONS_FOUND":
      return "No questions were recognized in the question file. Re-upload a clearer file.";
    case "TOO_MANY_QUESTIONS":
      return `Too many questions — an exam can have at most ${LIMITS.MAX_QUESTIONS}.`;
    case "WRONG_CHOICE_COUNT":
      return `${q} — ${p.choiceCount ?? 0} choices were read; an MCQ needs ${LIMITS.MIN_CHOICES}–${LIMITS.MAX_CHOICES} options labelled from A in order. Edit below or re-upload.`;
    case "EMPTY_STEM":
      return `${q} — the question text is empty; add it below.`;
    case "EMPTY_CHOICE":
      return `${q} — choice ${p.choiceLabel ?? "?"} is empty.`;
    case "ANSWER_COUNT_MISMATCH":
      return `The answer file has ${p.answerCount ?? 0} answers but the question file has ${p.questionCount ?? 0} questions (${p.unmatchedCount ?? 0} unmatched).`;
    case "ANSWER_MISSING":
      return `${q} — no answer found in your answer file. Add it to the file or set it below.`;
    case "IMAGE_CROP_FAILED":
      return `${q} — the image couldn't be cropped. Re-upload the file or remove the image.`;
    case "EXTRACTION_FAILED":
      return "Couldn't read your files right now. Please try again.";
    case "FILE_TOO_LARGE":
      return `That file is too large (max ${Math.round(LIMITS.MAX_FILE_BYTES / (1024 * 1024))} MB).`;
    case "TOO_MANY_PAGES":
      return `That file has too many pages (max ${LIMITS.MAX_PDF_PAGES}).`;
    case "STEM_TOO_LONG":
      return `${q} — the question text is too long (max ${p.max ?? LIMITS.MAX_STEM} characters${p.subjectScoped ? " for the selected subject" : ""}).`;
    case "CHOICE_TOO_LONG":
      return `${q} — choice ${p.choiceLabel ?? "?"} is too long (max ${LIMITS.MAX_CHOICE} characters).`;
    case "ESSAY_ANSWER_TOO_LONG":
      return `${q} — the model answer is too long (max ${p.max ?? LIMITS.MAX_ESSAY_ANSWER} characters${p.subjectScoped ? " for the selected subject" : ""}).`;
    case "WRONG_SUB_ITEM_COUNT":
      return `${q} — ${p.subItemCount ?? 0} sub-items were read; a true/false question needs ${LIMITS.MIN_SUB_ITEMS}–${LIMITS.MAX_SUB_ITEMS} items (a–d). Edit below or re-upload.`;
    case "SHORT_ANSWER_TOO_LONG":
      return `${q} — the expected answer is too long (max ${LIMITS.MAX_SHORT_ANSWER} characters).`;
    // A1 — ngữ liệu dùng chung. Nhãn đếm theo thứ tự xuất hiện ("Passage 2"):
    // ngữ liệu không thuộc về câu nào nên không mượn được nhãn "Câu N".
    case "EMPTY_PASSAGE":
      return `Passage ${p.passageIndex ?? 1} — the shared reading text is empty; add it below.`;
    case "PASSAGE_TOO_LONG":
      return `Passage ${p.passageIndex ?? 1} — the shared reading text is too long (max ${p.max ?? LIMITS.MAX_PASSAGE} characters).`;
    case "PASSAGE_MISSING":
      return `${q} — this question refers to a shared reading text that isn't in the exam. Re-upload, or detach it below.`;
    // v2.2 (ADR-0007) — lỗi metadata: sort TRÊN lỗi từng câu, link tới khối
    // metadata (không tới card câu).
    case "META_INCOMPLETE":
      return `Exam details — ${p.field ? META_FIELD_LABELS[p.field] : "a required field"} is missing. Add it above before publishing.`;
    case "META_INVALID": {
      const range = p.field ? META_FIELD_RANGES[p.field] : undefined;
      return `Exam details — ${p.field ? META_FIELD_LABELS[p.field] : "a field"} is out of range${range ? ` (${range})` : ""}. Correct it above.`;
    }
    case "META_EXTRACTION_FAILED":
      return "Exam details — we couldn't read the exam details from your file. Fill them in above.";
    // B1 — biểu điểm. Lỗi tổng phải NÓI RA con số hiện tại: "chưa đủ 10" bắt
    // tác giả tự cộng 40 ô để biết mình thiếu bao nhiêu.
    case "POINTS_MISSING":
      return `${q} — no points set for this question. Enter them below before publishing.`;
    case "POINTS_TOTAL_MISMATCH":
      return `Exam points — the questions add up to ${formatPoints(p.total ?? 0)}/${p.expected ?? LIMITS.EXAM_TOTAL_POINTS}. Adjust them so the exam totals ${p.expected ?? LIMITS.EXAM_TOTAL_POINTS}.`;
  }
}

/** Tạo UgcError với message đã bake. partNumber lấy từ params (null nếu không
 * truyền — lỗi toàn file hoặc đề 1 phần). */
export function makeUgcError(
  code: UgcErrorCode,
  questionNumber: number | null,
  params: UgcErrorParams = {},
): UgcError {
  return {
    code,
    questionNumber,
    partNumber: params.partNumber ?? null,
    message: message(code, questionNumber, params),
    params,
    ...(params.field !== undefined && { field: params.field }),
  };
}

// --- Bản dịch lúc render ---------------------------------------------------
//
// `message` ở trên bake sẵn tiếng Anh lúc TẠO error, nên nó đóng băng ngôn ngữ
// tại thời điểm sai sót chứ không theo lựa chọn của người đọc. UI vì vậy dựng
// lại câu từ `code` + `params` bằng `t` — cùng một error hiển thị đúng thứ
// tiếng đang bật, kể cả khi người dùng đổi ngôn ngữ giữa chừng.

/** Khoá i18n của nhãn field metadata trong copy lỗi META_*. */
const META_FIELD_KEYS = {
  title: "ugcError.fieldTitle",
  subject: "ugcError.fieldSubject",
  grade: "ugcError.fieldGrade",
  durationMinutes: "ugcError.fieldDuration",
  school: "ugcError.fieldSchool",
  schoolYear: "ugcError.fieldSchoolYear",
  semester: "ugcError.fieldSemester",
} as const satisfies Record<MetaFieldName, string>;

/** Nhãn định danh câu theo ngôn ngữ: "Phần 2 Câu 3" / "Part 2 Question 3". */
function labelOf(t: Translate, n: number | null, part: number | undefined): string {
  if (n == null) return "";
  return part != null
    ? t("upload.partQuestionLabel", { part, number: n })
    : t("upload.questionLabel", { number: n });
}

/** Dựng câu lỗi theo ngôn ngữ hiện hành. Dùng ở MỌI chỗ hiển thị UgcError. */
export function formatUgcError(t: Translate, e: UgcError): string {
  const p = e.params ?? {};
  const q = labelOf(t, e.questionNumber, p.partNumber ?? undefined);
  const fieldLabel = p.field ? t(META_FIELD_KEYS[p.field]) : null;

  switch (e.code) {
    case "NO_QUESTIONS_FOUND":
      return t("ugcError.noQuestionsFound");
    case "TOO_MANY_QUESTIONS":
      return t("ugcError.tooManyQuestions", { max: LIMITS.MAX_QUESTIONS });
    case "WRONG_CHOICE_COUNT":
      return t("ugcError.wrongChoiceCount", {
        q,
        count: p.choiceCount ?? 0,
        min: LIMITS.MIN_CHOICES,
        max: LIMITS.MAX_CHOICES,
      });
    case "EMPTY_STEM":
      return t("ugcError.emptyStem", { q });
    case "EMPTY_CHOICE":
      return t("ugcError.emptyChoice", { q, choice: p.choiceLabel ?? "?" });
    case "ANSWER_COUNT_MISMATCH":
      return t("ugcError.answerCountMismatch", {
        answers: p.answerCount ?? 0,
        questions: p.questionCount ?? 0,
        unmatched: p.unmatchedCount ?? 0,
      });
    case "ANSWER_MISSING":
      return t("ugcError.answerMissing", { q });
    case "IMAGE_CROP_FAILED":
      return t("ugcError.imageCropFailed", { q });
    case "EXTRACTION_FAILED":
      return t("ugcError.extractionFailed");
    case "FILE_TOO_LARGE":
      return t("ugcError.fileTooLarge", {
        mb: Math.round(LIMITS.MAX_FILE_BYTES / (1024 * 1024)),
      });
    case "TOO_MANY_PAGES":
      return t("ugcError.tooManyPages", { max: LIMITS.MAX_PDF_PAGES });
    case "STEM_TOO_LONG": {
      const max = p.max ?? LIMITS.MAX_STEM;
      return p.subjectScoped
        ? t("ugcError.stemTooLongForSubject", { q, max })
        : t("ugcError.stemTooLong", { q, max });
    }
    case "CHOICE_TOO_LONG":
      return t("ugcError.choiceTooLong", {
        q,
        choice: p.choiceLabel ?? "?",
        max: LIMITS.MAX_CHOICE,
      });
    case "ESSAY_ANSWER_TOO_LONG": {
      const max = p.max ?? LIMITS.MAX_ESSAY_ANSWER;
      return p.subjectScoped
        ? t("ugcError.essayAnswerTooLongForSubject", { q, max })
        : t("ugcError.essayAnswerTooLong", { q, max });
    }
    case "WRONG_SUB_ITEM_COUNT":
      return t("ugcError.wrongSubItemCount", {
        q,
        count: p.subItemCount ?? 0,
        min: LIMITS.MIN_SUB_ITEMS,
        max: LIMITS.MAX_SUB_ITEMS,
      });
    case "SHORT_ANSWER_TOO_LONG":
      return t("ugcError.shortAnswerTooLong", { q, max: LIMITS.MAX_SHORT_ANSWER });
    case "EMPTY_PASSAGE":
      return t("ugcError.emptyPassage", { index: p.passageIndex ?? 1 });
    case "PASSAGE_TOO_LONG":
      return t("ugcError.passageTooLong", {
        index: p.passageIndex ?? 1,
        max: p.max ?? LIMITS.MAX_PASSAGE,
      });
    case "PASSAGE_MISSING":
      return t("ugcError.passageMissing", { q });
    case "META_INCOMPLETE":
      return t("ugcError.metaIncomplete", { field: fieldLabel ?? t("ugcError.fieldRequired") });
    case "META_INVALID": {
      // Khoảng hợp lệ dựng tại chỗ chứ không dùng META_FIELD_RANGES: khoảng
      // thời lượng có kèm chữ "minutes", phải theo ngôn ngữ đang bật.
      const range =
        p.field === "grade"
          ? `${LIMITS.MIN_GRADE}–${LIMITS.MAX_GRADE}`
          : p.field === "durationMinutes"
            ? t("ugcError.durationRange", {
                min: LIMITS.MIN_DURATION,
                max: LIMITS.MAX_DURATION,
              })
            : p.field === "schoolYear"
              ? `${LIMITS.MIN_YEAR}–${LIMITS.MAX_YEAR}`
              : undefined;
      const label = fieldLabel ?? t("ugcError.fieldGeneric");
      return range
        ? t("ugcError.metaInvalidRange", { field: label, range })
        : t("ugcError.metaInvalid", { field: label });
    }
    case "META_EXTRACTION_FAILED":
      return t("ugcError.metaExtractionFailed");
    case "POINTS_MISSING":
      return t("ugcError.pointsMissing", { q });
    case "POINTS_TOTAL_MISMATCH":
      return t("ugcError.pointsTotalMismatch", {
        total: formatPoints(p.total ?? 0),
        expected: p.expected ?? LIMITS.EXAM_TOTAL_POINTS,
      });
  }
}
