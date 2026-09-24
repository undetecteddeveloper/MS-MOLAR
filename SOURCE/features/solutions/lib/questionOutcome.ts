// questionOutcome — type guard "unknown → concrete" cho `myResult` của một
// câu ở màn viết (task 11, gỡ giàn giáo task 10 để lại — xem Investigation
// Notes SolutionEditorScreen.tsx: `SolutionEditorQuestion.myResult` ở lại
// `unknown` vì task 04/10 không có Investigation Target/Required test nào
// đụng tới việc dựng UI cho nó; QuestionAnswerSummary (task 11) là nơi ĐẦU
// TIÊN cần đọc trường này).
//
// `community_solution_for_writer` (migration
// 20260924000000_community_solutions_8b80e2188cc3.sql:464) ghi NGUYÊN một
// phần tử `PerQuestionResult[]` (types/result.ts, camelCase) vào `my_result`,
// KHÔNG transform — nên một type guard đọc đúng hai trường bắt buộc
// (`questionId`, `isCorrect`) là đủ an toàn, không cần validate toàn bộ shape.
import type { PerQuestionResult } from "@/types/result";

export type WriterQuestionOutcome = PerQuestionResult | null;

function isPerQuestionResult(value: unknown): value is PerQuestionResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "questionId" in value &&
    "isCorrect" in value &&
    typeof (value as { isCorrect: unknown }).isCorrect === "boolean"
  );
}

/** `null` khi `myResult` không khớp shape mong đợi (không có `exam_results` —
 *  backend DD "absent when attempt_id resolves to no exam_results row" — hoặc
 *  giá trị lạ) — không bao giờ ném lỗi, không bao giờ đoán mò một outcome giả. */
export function toWriterQuestionOutcome(value: unknown): WriterQuestionOutcome {
  return isPerQuestionResult(value) ? value : null;
}

/** Nhánh hiển thị của `QuestionAnswerSummary` (UI-D16, AC-022). "essay" và
 *  "notAutoScored" đều đọc trực tiếp từ chính `outcome` (kết quả CHẤM của
 *  người viết) — KHÔNG suy qua `question_type` (cột mô tả CÂU HỎI, migration
 *  `8b80e2188cc3`): UI-D16's "Chưa chấm tự động" là một phán quyết về kết quả
 *  chấm (`scored === false`), không phải về loại câu, nên vẫn đọc từ `outcome`
 *  dù `question_type` nay đã có sẵn. */
export type OutcomeBranch = "essay" | "notAutoScored" | "mcq" | "shortAnswerScored" | "unknown";

export function outcomeBranch(outcome: WriterQuestionOutcome): OutcomeBranch {
  if (!outcome) return "unknown";
  if (outcome.essay) return "essay";
  if (outcome.scored === false) return "notAutoScored";
  if (outcome.correct !== undefined) return "mcq";
  return "shortAnswerScored";
}

export type ResultLabel = "correct" | "wrong" | "skipped";

/** "Bạn làm đúng"/"Bạn làm sai"/"Bạn bỏ trống" (AC-022) — chỉ áp dụng cho các
 *  nhánh CÓ phán quyết đúng/sai (mcq, short_answer đã chấm); nhánh
 *  "notAutoScored"/"essay" không gọi hàm này. */
export function resultLabel(outcome: PerQuestionResult): ResultLabel {
  if (!outcome.selected) return "skipped";
  return outcome.isCorrect ? "correct" : "wrong";
}
