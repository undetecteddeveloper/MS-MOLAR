// computeScore — ⭐ TRACER CODE (giữ mãi vào production).
// Hàm THUẦN (pure): không phụ thuộc UI, không I/O, không fake-data lookup.
// GĐ 2 (M2.6) gọi chính hàm này server-side trong submitExam().
//
// Nhận danh sách câu hỏi (đã resolve, vì Exam chỉ giữ questionIds) + đáp án,
// trả về điểm thang 10 + chi tiết từng câu + breakdown theo chủ đề.
//
// v2.1 (ADR-0005): mcq luôn chấm điểm. true_false re-enable 2026-07-27 — chấm
// nhị phân CẢ CÂU (mọi ý a-d phải khớp subAnswers, một ý sai = cả câu sai,
// không chấm từng phần); thiếu subAnswers (AI extraction fail) → fallback
// scored:false, không phạt oan user vì thiếu ground truth. short_answer
// re-enable 2026-08-01 — so khớp văn bản đã chuẩn hoá (trim + NFC + lowercase)
// hoặc tương đương số học (dấu phẩy/chấm thập phân và số 0 thừa coi như nhau;
// chuỗi số có nhiều hơn một dấu phân cách — vd nhóm hàng nghìn "1.234.567" —
// là mơ hồ nên fallback so văn bản, không đoán số); thiếu/rỗng essayAnswer →
// fallback scored:false, cùng quy tắc ground-truth-presence với true_false.
// essay vẫn "stored, not auto-scored" (không có UI nhập cho player, không có
// gì để chấm). Câu không chấm vẫn có mặt trong perQuestion (scored: false,
// giữ input của user để màn Chi tiết hiển thị) nhưng KHÔNG vào mẫu số điểm
// lẫn topic breakdown — tránh đề trộn 22 câu bị chia điểm /22 dù chỉ 12 câu
// chấm được.

import { decodeTfAnswer } from "@/lib/ugc/tfCodec";
import type { Question, SubItemId } from "@/types/question";
import type {
  PerQuestionResult,
  ScoreResult,
  TopicResult,
} from "@/types/result";

/** Câu có tham gia chấm điểm tự động không: mcq luôn; true_false chỉ khi có
 *  subAnswers ground truth (rỗng = AI extraction fail, không chấm);
 *  short_answer chỉ khi có essayAnswer ground truth không rỗng/toàn khoảng
 *  trắng (cùng lý do — AI extraction fail hoặc row cũ chưa có ground truth);
 *  essay không bao giờ chấm. */
function isScored(q: Question): boolean {
  const type = q.questionType ?? "mcq";
  if (type === "mcq") return true;
  if (type === "true_false") return Object.keys(q.subAnswers ?? {}).length > 0;
  if (type === "short_answer") return Boolean(q.essayAnswer?.trim());
  return false;
}

/** Chuẩn hoá văn bản để so sánh không phân biệt hoa/thường và khoảng trắng
 *  thừa: trim + Unicode NFC + lowercase. */
function normalizeShortAnswerText(value: string): string {
  return value.trim().normalize("NFC").toLowerCase();
}

/** Parse chuỗi số kiểu Việt Nam (dấu phẩy HOẶC dấu chấm đều coi là thập
 *  phân). Chuỗi có nhiều hơn một dấu phân cách (vd nhóm hàng nghìn
 *  "1.234.567") là mơ hồ → trả về null để isShortAnswerCorrect fallback so
 *  văn bản, không đoán số. Không parse được (kể cả rỗng) → null. */
function parseShortAnswerNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const separatorCount = (trimmed.match(/[.,]/g) ?? []).length;
  if (separatorCount > 1) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/** So khớp câu trả lời short_answer với ground truth `expected`: ưu tiên
 *  tương đương số học (khi cả hai bên parse được số hợp lệ), fallback so
 *  văn bản đã chuẩn hoá. Bỏ trống (`submitted === undefined`) → sai, không
 *  phải bỏ qua (SA-BE-007, cùng quy ước với true_false). Không bao giờ throw. */
function isShortAnswerCorrect(
  expected: string,
  submitted: string | undefined,
): boolean {
  if (submitted === undefined) return false;
  const expectedNumber = parseShortAnswerNumber(expected);
  const submittedNumber = parseShortAnswerNumber(submitted);
  if (expectedNumber !== null && submittedNumber !== null) {
    return expectedNumber === submittedNumber;
  }
  return normalizeShortAnswerText(expected) === normalizeShortAnswerText(submitted);
}

/** Nhị phân CẢ CÂU: mọi ý trong subAnswers phải khớp đúng lựa chọn của user
 *  (tfCodec "a:Đ,b:S" — decodeTfAnswer, cùng codec AnswerChoice dùng để mã
 *  hoá lúc làm bài). Bỏ trống một ý hoặc cả câu → mismatch → sai, không skip. */
function isTrueFalseCorrect(
  subAnswers: Partial<Record<SubItemId, boolean>>,
  answer: string | undefined,
): boolean {
  const selected = decodeTfAnswer(answer);
  return (Object.keys(subAnswers) as SubItemId[]).every(
    (id) => selected[id] === subAnswers[id],
  );
}

export function computeScore(
  questions: Question[],
  answers: Record<string, string>,
): ScoreResult {
  const perQuestion: PerQuestionResult[] = questions.map((q) => {
    const selected = answers[q.id];
    if (!isScored(q)) {
      return { questionId: q.id, selected, isCorrect: false, scored: false };
    }
    if (q.questionType === "true_false") {
      return {
        questionId: q.id,
        selected,
        isCorrect: isTrueFalseCorrect(q.subAnswers ?? {}, selected),
        scored: true,
      };
    }
    if (q.questionType === "short_answer") {
      return {
        questionId: q.id,
        selected,
        isCorrect: isShortAnswerCorrect(q.essayAnswer ?? "", selected),
        scored: true,
      };
    }
    return {
      questionId: q.id,
      selected,
      correct: q.correctAnswer,
      isCorrect: selected === q.correctAnswer,
      scored: true,
    };
  });

  const scored = perQuestion.filter((r) => r.scored !== false);
  const total = scored.length;
  const correct = scored.filter((r) => r.isCorrect).length;

  // Thang 10. total=0 → 0 để tránh chia cho 0 (đề toàn câu không chấm).
  const totalScore =
    total === 0 ? 0 : Math.round((correct / total) * 10 * 100) / 100;

  // Gom theo chủ đề — CHỈ câu được chấm, giữ thứ tự chủ đề xuất hiện lần đầu.
  const topicOrder: string[] = [];
  const buckets = new Map<string, { correct: number; total: number }>();
  questions.forEach((q, i) => {
    if (perQuestion[i].scored === false) return;
    let bucket = buckets.get(q.topic);
    if (!bucket) {
      bucket = { correct: 0, total: 0 };
      buckets.set(q.topic, bucket);
      topicOrder.push(q.topic);
    }
    bucket.total += 1;
    if (perQuestion[i].isCorrect) bucket.correct += 1;
  });
  const topicBreakdown: TopicResult[] = topicOrder.map((topic) => {
    const b = buckets.get(topic)!;
    return { topic, correct: b.correct, total: b.total };
  });

  return { totalScore, correct, total, perQuestion, topicBreakdown };
}
