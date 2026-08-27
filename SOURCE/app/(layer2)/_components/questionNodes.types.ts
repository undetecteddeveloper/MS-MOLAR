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

/** Nội dung một câu hỏi đã render ở SERVER, khớp 1-1 với `PublicQuestion`. */
export interface QuestionNodes {
  /** Thân câu hỏi (`question.content`). */
  content: ReactNode;
  /** Nhãn từng lựa chọn A–D (mcq). Khoá vắng mặt = câu không có lựa chọn đó. */
  choices: Partial<Record<ChoiceId, ReactNode>>;
  /** Nội dung từng ý a–d (true_false). Vắng mặt = câu không có ý đó. */
  subItems: Partial<Record<SubItemId, ReactNode>>;
}
