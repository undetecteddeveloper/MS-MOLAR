// Data model — Result của một lần làm đề (Layer 2 Core Loop).
// Contract output của computeScore (M1.6); GĐ 2 getResult() trả về đúng shape này.

import type { ChoiceId } from "./question";

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
   * truth → scored:false). essay LUÔN false ("stored, not auto-scored" —
   * không có ground truth để chấm). undefined (row cũ trước v2.1) = true. */
  scored?: boolean;
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
