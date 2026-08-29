// Data model — Result của một lần làm đề (Layer 2 Core Loop).
// Contract output của computeScore (M1.6); GĐ 2 getResult() trả về đúng shape này.

import type { ChoiceId } from "./question";
// Nhập KIỂU, và vòng lặp import ở đây là vòng lặp CHỈ-KIỂU: `essayLifecycle.ts`
// nhập `PerQuestionResult` từ chính file này. `import type` bị xoá hết lúc phát
// mã nên không có chu trình nào ở runtime. Hướng phụ thuộc cố ý là hướng này:
// `EssayView` được khai MỘT LẦN trong `essayLifecycle.ts` cùng với các phép suy
// diễn sinh ra nó (ADR-0018, I7) — chép lại hình dạng ấy sang đây sẽ là lời khai
// thứ hai của cùng một hợp đồng.
import type { EssayView } from "@/lib/scoring/essayLifecycle";

export interface PerQuestionResult {
  questionId: string;
  /** Input của user; undefined = bỏ trống. mcq: "A".."D"; true_false: chuỗi
   * "a:Đ,b:S,..." (tfCodec); short_answer/essay: text tự do (UGC v2.1). */
  selected?: string;
  /** Đáp án đúng — CHỈ câu mcq (câu không chấm để undefined). */
  correct?: ChoiceId;
  isCorrect: boolean;
  /** false = câu KHÔNG tính điểm. true_false/short_answer chấm điểm CÓ ĐIỀU
   * KIỆN (chỉ khi có ground truth — subAnswers/essayAnswer; thiếu ground
   * truth → scored:false). undefined (row cũ trước v2.1) = true.
   *
   * essay LUÔN false, và từ ADR-0018 LÝ DO đã đổi dù giá trị thì không: không
   * còn là "không có gì để chấm" nữa — band ĐƯỢC ghi, nhưng ghi BÊN NGOÀI
   * `computeScore()` bởi `record_essay_grade()`, và dòng cố ý ở lại ngoài mẫu
   * số điểm ở MỌI trạng thái vòng đời (EG-BE-004). Một phần tử `graded` mang
   * `scored: true` là một khuyết tật: `record_skill_mastery()` lọc theo
   * `coalesce((pq->>'scored')::boolean, true)` (schema.sql:1354) nên câu tự
   * luận sẽ bắt đầu nuôi mô hình mastery, và `computeWrongTwiceQuestionIds()`
   * sẽ bắt đầu trả về id câu tự luận. */
  scored?: boolean;
  /** Câu này đã bị chấm SAI trên >= 2 lượt làm bài khác nhau của cùng user
   * (Engine 1, UI Spec D1). KHÔNG lưu trong DB — computeScore() không bao giờ
   * đặt trường này; getResult() tính lúc đọc qua computeWrongTwiceQuestionIds().
   * undefined khi trường không có ý nghĩa (scored === false hoặc isCorrect) —
   * chỉ dòng đang sai VÀ có chấm mới mang true/false. */
  hasBeenWrongTwice?: boolean;
  /** Trạng thái vòng đời chấm tự luận ĐÃ SUY RA (ADR-0018), gắn lúc đọc theo
   * đúng lối `hasBeenWrongTwice` ở trên: `computeScore()` không bao giờ đặt
   * trường này — `getResult()` suy nó qua `deriveEssayView(entry, created_at,
   * now)`. `undefined` khi dòng KHÔNG ÁP DỤNG: câu không phải tự luận, dòng ghi
   * trước khi tính năng ship, hoặc một `essayState` không nhận ra. Đó là ba câu
   * trả lời khác nhau ở thượng nguồn nhưng cùng một câu ở đây — không bề mặt
   * nào hiển thị gì cho cả ba. */
  essay?: EssayView;
}

export interface TopicResult {
  topic: string;
  correct: number;
  total: number;
}

export interface ScoreResult {
  /** Điểm thang 10 (chuẩn THPT VN), làm tròn 2 chữ số. */
  totalScore: number;
  correct: number;
  total: number;
  perQuestion: PerQuestionResult[];
  topicBreakdown: TopicResult[];
}
