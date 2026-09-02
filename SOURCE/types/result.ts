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
  /** ĐIỂM ĐÃ ĐƯỢC của dòng này (B1/B2/B3) — kênh chấm điểm CÓ TRỌNG SỐ, tách
   * hẳn khỏi `scored`/`isCorrect` vốn là kênh ĐẾM.
   *
   * Hai kênh trả lời hai câu hỏi khác nhau, và trộn chúng là cách chắc chắn để
   * hỏng một trong hai: `scored` quyết định dòng có vào ô Đúng/Sai, vào mastery
   * và vào wrongTwice hay không; `earnedPoints`/`maxPoints` quyết định dòng
   * chiếm bao nhiêu trong thang 10. Câu tự luận là ca làm lộ ra sự khác biệt —
   * nó `scored: false` (không vào ô đếm, không nuôi mastery) NHƯNG có
   * `maxPoints` > 0 ngay từ lúc nộp, vì đề đã in sẵn nó đáng mấy điểm.
   *
   * `undefined` ở dòng ghi TRƯỚC B1 và ở câu không ai chấm được. `sumPoints()`
   * bỏ qua hẳn những dòng đó thay vì mặc định 1 — xem lý do tại đó. */
  earnedPoints?: number;
  /** Mẫu số điểm của dòng này — `Question.points` đã chuẩn hoá. Xem trên. */
  maxPoints?: number;
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
  /** Điểm thang 10 (chuẩn THPT VN), làm tròn 2 chữ số.
   *
   * Từ B1/B2/B3 nó là `earnedPoints / maxPoints × 10` — CÓ TRỌNG SỐ và có kể cả
   * câu tự luận. KHÔNG còn suy được từ `correct`/`total` bên dưới, và đó là chủ
   * đích: hai cặp số ấy đếm câu chấm tự động, còn con số này đo điểm của đề. */
  totalScore: number;
  /** Số câu CHẤM TỰ ĐỘNG làm đúng. Ý nghĩa KHÔNG đổi qua B1/B2/B3 — đó là điều
   * kiện để `ScoreCard` giữ phép suy `sai = tổng − đúng` (AC-057). Câu
   * true_false đúng 3/4 ý được điểm thành phần nhưng KHÔNG cộng vào đây. */
  correct: number;
  /** Số câu CHẤM TỰ ĐỘNG. Không đếm câu tự luận. Xem `correct`. */
  total: number;
  // KHÔNG có `earnedPoints`/`maxPoints` ở MỨC LƯỢT THI, và sự vắng mặt đó là
  // một quyết định: AC-012 buộc một dòng ghi TRƯỚC tính năng chấm tự luận phải
  // đọc ra y hệt hôm nay ("the whole ExamResult equals a hand-built pre-change
  // literal"). Thêm hai trường suy diễn vào đây làm MỌI dòng cũ mọc thêm hai
  // khoá — không đổi con số nào hiển thị, nhưng vẫn phá đúng cái cổng ấy.
  // Cần hai vế điểm thì gọi `sumPoints(perQuestion)` (lib/scoring/computeScore).
  perQuestion: PerQuestionResult[];
  topicBreakdown: TopicResult[];
}
