// Kiểu của nội dung câu hỏi ĐÃ RENDER SẴN (TD-023, 2026-08-27).
//
// File này CỐ Ý chỉ có kiểu, không có giá trị nào — và nó tách khỏi
// `questionNodes.tsx` vì đúng một lý do: component CLIENT
// (ExamPlayer/QuestionRenderer/AnswerChoice) cần kiểu này, nhưng nếu chúng
// import từ file có chứa `RichText` thì chỉ cần MỘT lần ai đó đổi
// `import type` thành `import` là 126 KB br quay lại bundle client, im lặng,
// và không cổng nào trong dự án bắt được. Ở đây thì không có gì để mà import
// nhầm.
//
// Vì sao là ReactNode chứ không phải chuỗi: server render markdown+LaTeX một
// lần rồi truyền phần tử React xuống — client không cần biết markdown là gì.

import type { ReactNode } from "react";
import type { ChoiceId, SubItemId } from "@/types/question";

/** Một mẩu của bài đọc đã render: văn bản, hoặc một CHỖ TRỐNG cần điền.
 *
 *  Bài đọc không còn là MỘT node duy nhất kể từ 2026-09-02: đề điền khuyết in
 *  đề bài của câu hỏi ngay trong bài đọc, nên màn làm bài phải ghép được đáp án
 *  học sinh vừa chọn vào đúng chỗ trống của nó — thứ chỉ làm được khi chỗ trống
 *  là một phần tử RIÊNG mà client điều khiển, không phải mấy ký tự gạch dưới
 *  nằm lẫn trong HTML server đã render xong. */
export type PassageChunkNode =
  | { kind: "text"; node: ReactNode }
  | {
      kind: "blank";
      /** Số in trên đề ("34"), null nếu bài đọc không đánh số chỗ trống. */
      label: number | null;
      /** Câu hỏi ứng với chỗ trống này; null = không gán được câu nào. */
      questionId: string | null;
      /** Nội dung từng lựa chọn của câu đó — client tra bằng đáp án đã chọn.
       *  Đi kèm ở đây (chứ không tra ngược qua `questions`) để `QuestionRenderer`
       *  không phải nhận thêm cả danh sách câu hỏi chỉ để đọc một chuỗi. */
      options: Partial<Record<ChoiceId, string>>;
    };

/** Bài đọc đã render — các đoạn văn, mỗi đoạn là chuỗi mẩu xen chỗ trống. */
export interface PassageNodes {
  /** Class typography của khối bài đọc. Đi xuống dưới dạng DỮ LIỆU vì
   *  `questionNodes.tsx` là nguồn chân lý duy nhất cho mọi className nội dung
   *  (xem ghi chú đầu file đó), mà khối bao ngoài nay do client dựng. */
  className: string;
  paragraphs: PassageChunkNode[][];
}

/** Nội dung một câu hỏi đã render ở SERVER, khớp 1-1 với `PublicQuestion`. */
export interface QuestionNodes {
  /** Thân câu hỏi (`question.content`). */
  content: ReactNode;
  /** Nhãn từng lựa chọn A–D (mcq). Khoá vắng mặt = câu không có lựa chọn đó. */
  choices: Partial<Record<ChoiceId, ReactNode>>;
  /** Nội dung từng ý a–d (true_false). Vắng mặt = câu không có ý đó. */
  subItems: Partial<Record<SubItemId, ReactNode>>;
  /** NGỮ LIỆU DÙNG CHUNG (A1) đã render — bài đọc mà câu này tham chiếu.
   *  Vắng mặt = câu tự chứa (đại đa số câu). */
  passage?: PassageNodes;
  /** Tiêu đề in trên đề của ngữ liệu ("Read the following passage..."). */
  passageTitle?: string;
}
