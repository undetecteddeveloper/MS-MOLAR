// UGC Exam Upload v2.1 — assembler THUẦN, AUTHORITATIVE (ADR-0004 + ADR-0005).
//
// Join câu hỏi với đáp án THEO DANH TÍNH COMPOSITE (part, number) — v2.1 sửa
// tận gốc bug ghi đè: đề chuẩn quốc gia 2025 đánh số câu LẠI TỪ 1 theo từng
// PHẦN, nên khoá join phẳng theo number làm "Câu 1" của Phần II/III đè lên
// Phần I. Đề cũ không chia phần = trường hợp suy biến part=1 (không code path
// riêng). mcq lấy correct_answer từ FILE ĐÁP ÁN (không bao giờ do AI suy
// luận); true_false lấy Đ/S từng ý; short_answer/essay lấy essay_answer; gắn
// hình theo cùng khoá composite; topic := subject của đề. Validate toàn bộ và
// trả về MỌI lỗi (không fail-fast) để ExtractionErrorPanel liệt kê đủ.
//
// Tách 2 tầng (Task 4.1):
//   - assembleExamLenient: join KHÔNG chặn — luôn dựng được AssembledExam kể cả
//     khi thiếu đáp án (correctAnswer/subAnswers/essayAnswer để undefined).
//     Dùng để persist bản nháp trạng thái 'failed' cho tác giả sửa trong S-03.
//   - validateAssembledExam: validate thuần trên AssembledExam — dùng chung bởi
//     assembleExam, publishExam (gate publish, AC-013/016) và màn review S-03.
//
// BẢO ĐẢM: giá trị persist LUÔN là kết quả assemble này — raw AI output không
// bao giờ được persist.

import { makeUgcError } from "./errorCopy";
import { LIMITS, maxEssayAnswerFor, maxStemFor } from "./limits";
import { parseTfVerdictSequence } from "./tfVerdict";
import type {
  AssembledExam,
  AssembledQuestion,
  ChoiceId,
  ExamMeta,
  ExtractedAnswer,
  ExtractedPart,
  ExtractedPassage,
  ExtractedQuestion,
  Result,
  SubAnswers,
  SubItemId,
  UgcError,
} from "./types";

const CHOICE_IDS: readonly ChoiceId[] = ["A", "B", "C", "D"];
const SUB_ITEM_IDS: readonly SubItemId[] = ["a", "b", "c", "d"];

/** Khoá join composite (ADR-0005) — dùng chung cho map đáp án VÀ map hình. */
export function qKey(part: number, number: number): string {
  return `${part}:${number}`;
}

/**
 * Vớt lại đáp án Đúng/Sai mà extractor đã xếp NHẦM LOẠI (2026-09-02).
 *
 * Câu true_false của đề TIẾNG ANH có bảng đáp án viết "Câu 21: T" / "3. F".
 * Model không thấy T/F trong hình dạng `true_false` nào nó biết, nên nó hạ
 * xuống dạng gần nhất — thường là `short_answer` với value "T" — và nhánh
 * "đúng loại" ngay bên dưới coi đó như KHÔNG CÓ đáp án. Từ đó `subAnswers`
 * rỗng, `isScored()` trả false, và câu hiện "chưa chấm tự động" suốt đời.
 *
 * Ba điều kiện dưới đây là chỗ phân biệt "vớt lại" với "đoán bừa":
 *
 *   1. Chỉ nhận `short_answer`/`essay` — hai dạng mang VĂN BẢN TỰ DO. Không
 *      đụng `mcq`: một chữ cái A–D cho câu Đ/S là dấu hiệu file đáp án khớp
 *      nhầm câu, không phải dấu hiệu viết khác ngôn ngữ.
 *   2. Đọc được TRỌN VẸN (`parseTfVerdictSequence` trả null nếu sót một mẩu).
 *   3. Tập ý đọc ra phải TRÙNG KHÍT tập ý câu hỏi thật sự có.
 *
 * Điều kiện 3 gánh phần nặng nhất và nó không hiển nhiên: `countTrueFalseCorrect()`
 * lấy MẪU SỐ từ `Object.keys(subAnswers)`, chứ không từ số ý của câu. Nhận một
 * dòng "T" cho câu bốn ý sẽ chấm cả câu trên đúng một ý a — học sinh đúng 1/4
 * được trọn điểm, đúng 0/4 mà ý a trúng cũng được trọn điểm. Thà để câu ở
 * "chưa chấm" còn hơn cho một con điểm dựng trên một phần tư dữ kiện.
 */
export function coerceTrueFalseAnswer(
  answer: ExtractedAnswer | undefined,
  subItems: { id: SubItemId }[] | undefined | null
): SubAnswers | undefined {
  if (!answer) return undefined;
  if (answer.type !== "short_answer" && answer.type !== "essay") return undefined;

  const raw = answer.type === "short_answer" ? answer.value : answer.text;
  const parsed = parseTfVerdictSequence(raw);
  if (!parsed) return undefined;

  const expected = new Set((subItems ?? []).map((s) => s.id));
  const got = Object.keys(parsed) as SubItemId[];
  if (expected.size === 0 || got.length !== expected.size) return undefined;
  if (got.some((id) => !expected.has(id))) return undefined;

  return parsed;
}

/** A3 — 2 tới 4 lựa chọn, nhãn là TIỀN TỐ LIỀN của A–D: {A,B}, {A,B,C},
 *  {A,B,C,D}. Đủ để đựng True/False/Not Given (3 lựa chọn) của đề Tiếng Anh.
 *
 *  "Tiền tố liền" chứ không phải "tập con bất kỳ" — {A,C} bị từ chối. Lý do
 *  không phải sạch sẽ hình thức: nhãn đi thẳng vào correct_answer và vào nút
 *  bấm của màn làm bài, nên một đề nhảy cóc B sẽ hiện ra "A C D" trước mặt học
 *  sinh và không có gì ở tầng dưới bắt lại được. Đề nhảy cóc gần như luôn là
 *  AI đọc SÓT một lựa chọn, và đó đúng là thứ WRONG_CHOICE_COUNT phải bắt. */
function hasValidChoiceSet(
  choices: AssembledQuestion["choices"]
): choices is NonNullable<AssembledQuestion["choices"]> {
  if (!choices) return false;
  const n = choices.length;
  if (n < LIMITS.MIN_CHOICES || n > LIMITS.MAX_CHOICES) return false;
  const ids = new Set(choices.map((c) => c.id));
  if (ids.size !== n) return false;
  return CHOICE_IDS.slice(0, n).every((id) => ids.has(id));
}

/** A2 — MIN_SUB_ITEMS..MAX_SUB_ITEMS ý, id thuộc {a,b,c,d}, không trùng.
 *  Trần dưới nay là 1: khối một-mệnh-đề của đề Tiếng Anh là hợp lệ. Không ép
 *  tiền tố liền như hasValidChoiceSet — nhãn ý con không đi vào correct_answer,
 *  và subAnswers tra theo id nên một tập thưa vẫn chấm đúng. */
function hasValidSubItemSet(
  subItems: AssembledQuestion["subItems"]
): subItems is NonNullable<AssembledQuestion["subItems"]> {
  if (!subItems) return false;
  if (subItems.length < LIMITS.MIN_SUB_ITEMS || subItems.length > LIMITS.MAX_SUB_ITEMS)
    return false;
  const ids = new Set(subItems.map((s) => s.id));
  return ids.size === subItems.length && subItems.every((s) => SUB_ITEM_IDS.includes(s.id));
}

/** Đề có chia phần không — quyết định nhãn lỗi "Phần P Câu N" vs "Câu N".
 *  Export để gate biểu điểm (validatePointsForPublish) đánh nhãn câu GIỐNG HỆT
 *  các lỗi khác trong cùng một bảng lỗi — hai cách gọi tên câu trong một danh
 *  sách là hai cách bắt tác giả dò lại. */
export function isMultiPart(parts: ExtractedPart[], questions: { part: number }[]): boolean {
  return parts.length > 0 || questions.some((q) => q.part !== 1);
}

/**
 * Join lenient: LUÔN dựng AssembledExam (câu thiếu đáp án giữ undefined),
 * kèm lỗi cấp join (ANSWER_COUNT_MISMATCH). Không validate nội dung từng câu —
 * việc đó thuộc validateAssembledExam.
 */
export function assembleExamLenient(
  questions: ExtractedQuestion[],
  answers: ExtractedAnswer[],
  images: Map<string, string>,
  meta: ExamMeta,
  parts: ExtractedPart[] = [],
  passages: ExtractedPassage[] = []
): { exam: AssembledExam; joinErrors: UgcError[] } {
  const joinErrors: UgcError[] = [];

  const answerByKey = new Map<string, ExtractedAnswer>();
  for (const a of answers) answerByKey.set(qKey(a.part, a.number), a);
  const questionKeys = new Set(questions.map((q) => qKey(q.part, q.number)));
  // "unmatched" = đáp án không trỏ tới câu hỏi nào + câu hỏi không có đáp án.
  const orphanAnswers = answers.filter((a) => !questionKeys.has(qKey(a.part, a.number)));
  const unanswered = questions.filter((q) => !answerByKey.has(qKey(q.part, q.number)));
  if (answers.length !== questions.length) {
    joinErrors.push(
      makeUgcError("ANSWER_COUNT_MISMATCH", null, {
        answerCount: answers.length,
        questionCount: questions.length,
        unmatchedCount: orphanAnswers.length + unanswered.length,
      })
    );
  }

  const assembled: AssembledQuestion[] = [];
  const sorted = [...questions].sort((a, b) => a.part - b.part || a.number - b.number);
  for (const q of sorted) {
    const answer = answerByKey.get(qKey(q.part, q.number));

    let correctAnswer: ChoiceId | undefined;
    let subAnswers: SubAnswers | undefined;
    let essayAnswer: string | undefined;
    // Đáp án phải ĐÚNG LOẠI với câu hỏi — file đáp án đưa sai dạng (vd. text
    // tự luận cho câu mcq) thì coi như thiếu (validate sẽ báo ANSWER_MISSING).
    if (q.type === "mcq") {
      if (answer && answer.type === "mcq") correctAnswer = answer.letter;
    } else if (q.type === "true_false") {
      if (answer && answer.type === "true_false" && answer.values.length > 0) {
        subAnswers = {};
        for (const v of answer.values) subAnswers[v.id] = v.value;
      } else {
        subAnswers = coerceTrueFalseAnswer(answer, q.subItems);
      }
    } else if (q.type === "short_answer") {
      if (answer && answer.type === "short_answer" && answer.value.trim().length > 0) {
        essayAnswer = answer.value;
      }
    } else {
      if (answer && answer.type === "essay" && answer.text.trim().length > 0) {
        essayAnswer = answer.text;
      }
    }

    assembled.push({
      part: q.part,
      number: q.number,
      type: q.type,
      stem: q.stem,
      choices: q.type === "mcq" ? q.choices : undefined,
      subItems: q.type === "true_false" ? q.subItems : undefined,
      correctAnswer,
      subAnswers,
      essayAnswer,
      imageUrl: images.get(qKey(q.part, q.number)),
      // A1: mang NGUYÊN khoá AI đặt, kể cả khoá mồ côi. Lọc ở đây sẽ làm
      // PASSAGE_MISSING không bao giờ báo được, và một câu lặng lẽ mất bài đọc
      // là đúng thứ tác giả cần nhìn thấy ở màn review.
      passageId: q.passageId,
      // B1 — mang nguyên; `undefined` nghĩa là "đề không in điểm", và mặc định
      // được áp ở TẦNG CHẤM (maxPointsOf) chứ không ở đây. Nhét 1 vào lúc này
      // sẽ xoá mất sự khác biệt giữa "đề ghi 1 điểm" và "đề không ghi gì", thứ
      // mà màn review cần để biết có nên nhắc tác giả nhập hay không.
      points: q.points,
      topic: meta.subject, // ADR-0004: topic mặc định = môn học
    });
  }

  return { exam: { meta, parts, passages, questions: assembled }, joinErrors };
}

/**
 * Validate thuần trên AssembledExam — trả về MỌI lỗi (rỗng = sạch, đủ điều
 * kiện publish). Dùng bởi assembleExam, publishExam và màn review S-03.
 */
export function validateAssembledExam(exam: AssembledExam): UgcError[] {
  const errors: UgcError[] = [];

  if (exam.questions.length < LIMITS.MIN_QUESTIONS) {
    return [makeUgcError("NO_QUESTIONS_FOUND", null)];
  }
  if (exam.questions.length > LIMITS.MAX_QUESTIONS) {
    return [makeUgcError("TOO_MANY_QUESTIONS", null)];
  }

  // Đề 1 phần giữ nhãn "Câu N" như v2.0; đề nhiều phần → "Phần P Câu N".
  const multiPart = isMultiPart(exam.parts, exam.questions);

  // Trần độ dài NỚI THEO MÔN (A6/A7) — giải một lần cho cả đề, không giải lại
  // trong vòng lặp: mọi câu của một đề dùng chung một môn.
  //
  // Nguồn là exam.meta.subject chứ KHÔNG phải q.topic, dù hai thứ này bằng nhau
  // lúc assemble (topic := meta.subject). Lý do: ở màn review tác giả đổi được
  // dropdown môn, ReviewScreen cập nhật meta.subject rồi gọi thẳng hàm này để
  // validate lại — nhưng topic của từng câu là BẢN CHỤP lúc assemble và chỉ
  // được cascade lại ở server khi lưu. Đọc topic ở đây tức là chấm đề bằng môn
  // CŨ, và sai lệch đó chỉ lộ ra đúng lúc tác giả vừa sửa môn cho đúng.
  // A1 — ngữ liệu dùng chung: kiểm nội dung, rồi kiểm THAM CHIẾU. Postgres
  // không cưỡng chế được khoá trỏ vào jsonb (§8d), nên đây là tầng duy nhất.
  const passageIds = new Set<string>();
  exam.passages.forEach((psg, i) => {
    const passageIndex = i + 1;
    if (psg.text.trim().length === 0) {
      errors.push(makeUgcError("EMPTY_PASSAGE", null, { passageIndex }));
    } else if (psg.text.length > LIMITS.MAX_PASSAGE) {
      errors.push(
        makeUgcError("PASSAGE_TOO_LONG", null, { passageIndex, max: LIMITS.MAX_PASSAGE }),
      );
    }
    passageIds.add(psg.id);
  });

  const maxStem = maxStemFor(exam.meta.subject);
  const maxEssayAnswer = maxEssayAnswerFor(exam.meta.subject);
  // Trần có phải do MÔN quyết định không — quyết định câu chữ của lỗi. Môn chưa
  // biết (sentinel "") thì không có "môn đã chọn" nào để nhắc tới.
  const subjectScoped = exam.meta.subject.trim() !== "";

  for (const q of exam.questions) {
    const n = q.number;
    const partNumber = multiPart ? q.part : undefined;

    if (q.stem.trim().length === 0) {
      errors.push(makeUgcError("EMPTY_STEM", n, { partNumber }));
    } else if (q.stem.length > maxStem) {
      errors.push(makeUgcError("STEM_TOO_LONG", n, { partNumber, max: maxStem, subjectScoped }));
    }

    // Khoá mồ côi: câu khai dùng ngữ liệu nhưng ngữ liệu ấy không có trong đề.
    // Gần như luôn là AI đặt khoá ở câu mà quên xuất đoạn văn tương ứng.
    if (q.passageId !== undefined && !passageIds.has(q.passageId)) {
      errors.push(makeUgcError("PASSAGE_MISSING", n, { partNumber }));
    }

    if (q.type === "mcq") {
      const choiceCount = q.choices?.length ?? 0;
      if (!hasValidChoiceSet(q.choices)) {
        errors.push(makeUgcError("WRONG_CHOICE_COUNT", n, { partNumber, choiceCount }));
      } else {
        for (const c of q.choices) {
          if (c.text.trim().length === 0) {
            errors.push(makeUgcError("EMPTY_CHOICE", n, { partNumber, choiceLabel: c.id }));
          } else if (c.text.length > LIMITS.MAX_CHOICE) {
            errors.push(makeUgcError("CHOICE_TOO_LONG", n, { partNumber, choiceLabel: c.id }));
          }
        }
      }
      if (!q.correctAnswer) {
        errors.push(makeUgcError("ANSWER_MISSING", n, { partNumber }));
      }
    } else if (q.type === "true_false") {
      const subItemCount = q.subItems?.length ?? 0;
      if (!hasValidSubItemSet(q.subItems)) {
        errors.push(makeUgcError("WRONG_SUB_ITEM_COUNT", n, { partNumber, subItemCount }));
      } else {
        for (const s of q.subItems) {
          if (s.text.trim().length === 0) {
            errors.push(makeUgcError("EMPTY_CHOICE", n, { partNumber, choiceLabel: s.id }));
          } else if (s.text.length > LIMITS.MAX_CHOICE) {
            errors.push(makeUgcError("CHOICE_TOO_LONG", n, { partNumber, choiceLabel: s.id }));
          }
        }
        // Mỗi ý phải có đáp án Đ/S từ file đáp án (publish-clean).
        const missing = q.subItems.some((s) => typeof q.subAnswers?.[s.id] !== "boolean");
        if (missing) {
          errors.push(makeUgcError("ANSWER_MISSING", n, { partNumber }));
        }
      }
    } else if (q.type === "short_answer") {
      if (!q.essayAnswer || q.essayAnswer.trim().length === 0) {
        errors.push(makeUgcError("ANSWER_MISSING", n, { partNumber }));
      } else if (q.essayAnswer.length > LIMITS.MAX_SHORT_ANSWER) {
        errors.push(makeUgcError("SHORT_ANSWER_TOO_LONG", n, { partNumber }));
      }
    } else {
      if (!q.essayAnswer || q.essayAnswer.trim().length === 0) {
        errors.push(makeUgcError("ANSWER_MISSING", n, { partNumber }));
      } else if (q.essayAnswer.length > maxEssayAnswer) {
        errors.push(
          makeUgcError("ESSAY_ANSWER_TOO_LONG", n, {
            partNumber,
            max: maxEssayAnswer,
            subjectScoped,
          }),
        );
      }
    }
  }

  return errors;
}

/** Join + validate — hợp đồng gốc (Design Doc §Contracts). */
export function assembleExam(
  questions: ExtractedQuestion[],
  answers: ExtractedAnswer[],
  images: Map<string, string>,
  meta: ExamMeta,
  parts: ExtractedPart[] = [],
  passages: ExtractedPassage[] = []
): Result<AssembledExam> {
  // Lỗi cấp toàn file trả về MỘT MÌNH (khớp copy hướng dẫn re-upload).
  if (questions.length < LIMITS.MIN_QUESTIONS) {
    return { ok: false, errors: [makeUgcError("NO_QUESTIONS_FOUND", null)] };
  }
  if (questions.length > LIMITS.MAX_QUESTIONS) {
    return { ok: false, errors: [makeUgcError("TOO_MANY_QUESTIONS", null)] };
  }

  const { exam, joinErrors } = assembleExamLenient(
    questions,
    answers,
    images,
    meta,
    parts,
    passages
  );
  const errors = [...joinErrors, ...validateAssembledExam(exam)];

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: exam };
}
