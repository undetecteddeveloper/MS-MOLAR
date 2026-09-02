// questionPoints — LỜI KHAI DUY NHẤT của "câu này đáng mấy điểm" và "đúng được
// mấy phần của số điểm đó" (B1 + B2, 2026-09-01).
//
// Tách khỏi `computeScore.ts` vì có BA nơi phải đồng ý về cùng một phép tính và
// hai trong số đó không đi qua computeScore: hàm chấm lúc nộp bài, script
// backfill tính lại điểm cũ, và đường ghi band tự luận. Ba bản chép của thang
// bậc PHẦN II là ba cơ hội để một lượt thi cũ và một lượt thi mới trên CÙNG một
// đề cho ra hai con số khác nhau.
//
// THUẦN: không I/O, không env, không đồng hồ.

import type { Question } from "@/types/question";

/** Điểm mặc định của một câu khi đề không khai gì.
 *
 *  Bằng 1 KHÔNG phải cho tiện: với đề thuần trắc nghiệm, tổng có trọng số
 *  Σ(đúng×1)/Σ(1)×10 rút gọn về ĐÚNG công thức cũ `đúng/tổng×10`, nên số cũ và
 *  số mới trùng khít và không đề nào bị dịch điểm chỉ vì luật đổi. Codebase đã
 *  dùng đúng lối lập luận này hai lần ở schema.sql:490-492 (`question_type` mặc
 *  định 'mcq', `part_number` mặc định 1, kèm ghi chú "row cũ tự đúng").
 *
 *  VAI TRÒ TỪ B1 TRỞ ĐI: chỉ còn là SHIM CHO DỮ LIỆU CŨ. Cổng publish nay bắt
 *  tác giả nhập điểm cho mọi câu và cộng đủ 10 (validatePointsForPublish trong
 *  normalizeMeta.ts), nên đề mới KHÔNG BAO GIỜ chạm tới hằng này — mọi câu của
 *  chúng đều mang điểm thật do người ra đề khai.
 *
 *  Nó vẫn phải ở lại, và không được đổi thành 0 hay ném lỗi: những đề đã
 *  published TRƯỚC B1 mang `points = 1` từ default của cột, và AC-012 buộc mọi
 *  lượt thi cũ đọc lại ra ĐÚNG con số cũ. Đây là đường lui cho quá khứ, không
 *  phải giá trị mặc định cho tương lai. */
export const DEFAULT_QUESTION_POINTS = 1;

/** Thang bậc PHẦN II (câu đúng/sai 4 ý) theo quy chế Bộ GD&ĐT 2025, đã xác nhận
 *  với đề thật: đúng 1 ý = 0.1đ · 2 ý = 0.25đ · 3 ý = 0.5đ · 4 ý = 1.0đ.
 *
 *  Lưu dưới dạng TỈ LỆ của `points`, không phải điểm tuyệt đối: quy chế viết
 *  cho câu đáng đúng 1.0 điểm, nhưng đề trường có thể cho câu PHẦN II một trọng
 *  số khác, và khi ấy các bậc phải co giãn theo chứ không đứng yên ở 0.1/0.25.
 *  Với points = 1 thì hai cách đọc trùng nhau, đúng như quy chế mô tả.
 *
 *  Chỉ số = SỐ Ý ĐÚNG. Phần tử 0 là 0 điểm — sai hết không được gì. */
const TRUE_FALSE_TIERS = [0, 0.1, 0.25, 0.5, 1] as const;

/** Số ý mà thang bậc trên được viết cho. */
const TIERED_SUB_ITEM_COUNT = 4;

/** Điểm tối đa của một câu. Không phải số dương hữu hạn ⇒ mặc định.
 *
 *  Chặn ở đây chứ không tin cột DB: `points` đi từ AI đọc đề → tác giả sửa tay
 *  → jsonb/numeric, và một `0` lọt qua sẽ làm câu đó biến mất khỏi mẫu số
 *  trong im lặng, còn một số âm thì kéo tổng điểm của cả lượt thi xuống. */
export function maxPointsOf(question: Pick<Question, "points">): number {
  const raw = question.points;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_QUESTION_POINTS;
  }
  return raw;
}

/** TỈ LỆ điểm được hưởng của một câu true_false, theo số ý đúng trên tổng số ý.
 *
 *  Hai nhánh, và nhánh thứ hai là hệ quả trực tiếp của A2/A3:
 *
 *    · ĐÚNG 4 ý (hình dạng PHẦN II chuẩn) → tra thang bậc của quy chế.
 *    · Khác 4 ý → TỈ LỆ THUẬN `đúng/tổng`. Quy chế chỉ viết cho khối 4 ý; từ A2
 *      thì khối một-mệnh-đề của đề Tiếng Anh cũng là `true_false`, và áp bậc
 *      0.1 cho "đúng 1 ý" ở một câu CHỈ CÓ một ý sẽ trả 10% điểm cho một bài
 *      làm hoàn toàn đúng. Tỉ lệ thuận suy biến đúng ở mọi n: 1/1 = 1.0.
 *
 *  `total <= 0` ⇒ 0 (không có gì để chấm), không bao giờ chia cho 0. */
export function trueFalseCreditRatio(correctCount: number, total: number): number {
  if (total <= 0) return 0;
  const correct = Math.max(0, Math.min(correctCount, total));
  if (total === TIERED_SUB_ITEM_COUNT) return TRUE_FALSE_TIERS[correct];
  return correct / total;
}
