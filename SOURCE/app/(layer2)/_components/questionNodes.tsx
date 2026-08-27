// renderQuestionNodes — render nội dung câu hỏi (markdown + LaTeX) ở SERVER
// rồi truyền xuống cây client dưới dạng phần tử React (TD-023, 2026-08-27).
//
// ⚠ KHÔNG BAO GIỜ import file này từ một component có `"use client"` ⚠
//
// Toàn bộ mục đích của nó là giữ `RichText` — và cây phụ thuộc 126 KB br của
// nó (react-markdown + remark-gfm + remark-math + rehype-katex +
// rehype-sanitize + katex) — Ở LẠI PHÍA SERVER. Một import tĩnh từ component
// client kéo nguyên chunk đó về bundle và xoá sạch khoản tiết kiệm, đúng như
// TD-021 đã đo: route /result/detail đứng nguyên 181.8K khi còn MỘT import
// tĩnh sót lại. Cần KIỂU thì import từ `questionNodes.types.ts` (file đó
// không chứa giá trị nào để mà import nhầm).
//
// Vì sao render TRƯỚC toàn bộ N câu, chứ không render câu đang xem:
// `ExamPlayer` là component client giữ state làm bài — server không biết
// người dùng đang ở câu nào và không được biết (đổi câu là tương tác client,
// không phải điều hướng). Nên server phải giao đủ N câu một lần; client chỉ
// việc chọn phần tử thứ `current` ra hiển thị.
//
// Vì sao KHÔNG dùng nạp động (next/dynamic) thay cho cách này: nội dung câu
// hỏi là thứ phải có NGAY khi vào màn làm bài — nạp động chỉ đổi "tải chậm"
// thành "trang trống rồi mới có chữ". Nạp động đúng cho thứ chỉ hiện sau khi
// người dùng CHỦ ĐỘNG bấm (xem ExplainStepAffordance, TD-021).
//
// className ở đây là NGUỒN CHÂN LÝ DUY NHẤT cho kiểu chữ nội dung câu hỏi:
// trước TD-023 chúng nằm trong QuestionRenderer/AnswerChoice cạnh chỗ dùng.
// Gom về một chỗ vì server dựng phần tử còn client đặt nó vào khung — hai nơi
// giữ hai bản className là cách chắc chắn để chúng lệch nhau.

import type { ChoiceId, PublicQuestion, SubItemId } from "@/types/question";
import { RichText } from "@/components/shared/RichText";
import type { QuestionNodes } from "./questionNodes.types";

/** Thân câu hỏi — font-serif, một nấc lớn hơn phần còn lại của màn hình.
 *  (Lý do chọn serif + cỡ chữ: xem ghi chú trong QuestionRenderer.) */
const CONTENT_CLASS = "text-foreground font-serif text-lg leading-[1.75] text-pretty sm:text-xl";

/** Nhãn lựa chọn A–D — sans 16px, `flex-1` vì nằm cạnh badge chữ cái. */
const CHOICE_CLASS = "flex-1 text-base leading-relaxed text-card-foreground";

/** Nội dung ý a–d của câu true_false — sans 14px, `flex-1` cạnh nhãn "a)". */
const SUB_ITEM_CLASS = "text-card-foreground flex-1 text-sm leading-relaxed";

/**
 * Render sẵn nội dung của TẤT CẢ câu hỏi. Thứ tự phần tử trả về khớp 1-1 với
 * `questions` — `ExamPlayer` tra theo chỉ số câu hiện tại, không tra theo id.
 */
export function renderQuestionNodes(questions: PublicQuestion[]): QuestionNodes[] {
  return questions.map((question) => {
    const choices: Partial<Record<ChoiceId, React.ReactNode>> = {};
    for (const choice of question.choices) {
      choices[choice.id] = <RichText text={choice.text} inline className={CHOICE_CLASS} />;
    }

    const subItems: Partial<Record<SubItemId, React.ReactNode>> = {};
    for (const item of question.subItems ?? []) {
      subItems[item.id] = <RichText text={item.text} inline className={SUB_ITEM_CLASS} />;
    }

    return {
      content: <RichText text={question.content} className={CONTENT_CLASS} />,
      choices,
      subItems,
    };
  });
}
