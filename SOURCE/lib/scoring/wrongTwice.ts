// computeWrongTwiceQuestionIds — hàm THUẦN (pure): không I/O, không đọc ambient
// state, mọi dữ liệu do caller tiêm vào (cùng nhà với computeScore.ts và
// aggregateAttempts.ts).
//
// Trả về tập questionId mà user đã làm SAI trên >= 2 LƯỢT LÀM BÀI KHÁC NHAU —
// điều kiện "wrong twice" của Engine 1 (backend DD § Data Contracts). Đây là
// NGUỒN SỰ THẬT DUY NHẤT của định nghĩa "sai hai lần": getResult() dùng để bật
// affordance trên màn Chi tiết, còn explainStep() dùng để kiểm tra lại phía
// server (ranh giới bảo mật thật sự). Hai chỗ gọi phải luôn đồng ý với nhau nên
// logic này KHÔNG được nhân bản ở nơi khác.
//
// Quy ước `scored !== false` mirror ĐÚNG computeScore.ts (undefined = có chấm,
// cho dòng cũ trước v2.1): câu không chấm được (essay, hoặc true_false/
// short_answer thiếu ground truth) không bao giờ tính là "sai".
import type { PerQuestionResult } from "@/types/result";

/** "Hai lần" = 2 lượt làm bài KHÁC NHAU (PRD A4/D1), không phải 2 lần sai trong
 *  cùng một lượt. */
const DISTINCT_ATTEMPT_THRESHOLD = 2;

/** Một lượt làm bài đã nộp, rút gọn còn đúng phần hàm này cần — không dùng lại
 *  ExamResult/ScoreResult vì cả hai mang theo payload (điểm, topic breakdown,
 *  nội dung câu hỏi) không liên quan ở đây. */
export interface WrongTwiceAttempt {
  attemptId: string;
  perQuestion: PerQuestionResult[];
}

/**
 * Tập questionId bị chấm SAI trên >= 2 attemptId KHÁC NHAU, tính trên TOÀN BỘ
 * các lượt làm bài của một user (kể cả lượt đang xem).
 *
 * - Danh tính câu hỏi là TOÀN CỤC, không theo đề: cùng một câu xuất hiện ở hai
 *   đề khác nhau vẫn cộng dồn vào cùng một ngưỡng (PRD A4).
 * - Đếm theo attemptId phân biệt: một lượt lỡ liệt kê cùng câu hai lần chỉ
 *   tính là MỘT lượt.
 * - Câu `scored: false` không bao giờ đóng góp; `scored` bỏ trống = có chấm.
 * - Không bao giờ throw (thuần, không validate).
 */
export function computeWrongTwiceQuestionIds(attempts: WrongTwiceAttempt[]): Set<string> {
  const wrongAttemptIdsByQuestion = new Map<string, Set<string>>();

  for (const attempt of attempts) {
    for (const row of attempt.perQuestion) {
      if (row.scored === false || row.isCorrect) continue;
      let wrongAttemptIds = wrongAttemptIdsByQuestion.get(row.questionId);
      if (!wrongAttemptIds) {
        wrongAttemptIds = new Set<string>();
        wrongAttemptIdsByQuestion.set(row.questionId, wrongAttemptIds);
      }
      wrongAttemptIds.add(attempt.attemptId);
    }
  }

  const wrongTwice = new Set<string>();
  for (const [questionId, wrongAttemptIds] of wrongAttemptIdsByQuestion) {
    if (wrongAttemptIds.size >= DISTINCT_ATTEMPT_THRESHOLD) wrongTwice.add(questionId);
  }
  return wrongTwice;
}
