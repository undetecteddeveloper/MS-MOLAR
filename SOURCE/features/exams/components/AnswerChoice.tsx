// AnswerChoice — một lựa chọn đáp án trong Exam Player (Layer 2). GĐ 3 M3.1 Task 2.
// Visual đồng bộ TEMPLATE/L2/ExamPage: hàng hairline bo góc 4px, radio native ẩn
// (giữ a11y), viền brand 2px khi chọn. Controlled qua props selected/onSelect.
// Badge chữ cái A–D đứng trước nội dung — cùng hình dạng với badge ở màn kết quả
// (result/detail) để một lựa chọn trông giống nhau ở cả hai màn. KHÔNG aria-hidden:
// chữ cái là cách người làm bài gọi tên đáp án ("chọn câu B"), nên nó phải nằm
// trong tên khả truy cập của radio.

import type { ReactNode } from "react";
import type { Choice, ChoiceId } from "@/types/question";

interface AnswerChoiceProps {
  /** name của nhóm radio — để mỗi câu là một nhóm độc lập. */
  name: string;
  choice: Choice;
  /**
   * Nhãn lựa chọn ĐÃ RENDER SẴN Ở SERVER (TD-023) — markdown + LaTeX của
   * `choice.text`, dựng bởi `renderQuestionNodes`. Trước đây component này
   * tự gọi `<RichText text={choice.text}>`, và vì nó là component client thì
   * cả cây phụ thuộc 126 KB br của RichText đi thẳng vào bundle của màn làm
   * bài. `choice` vẫn được truyền vào vì `choice.id` là giá trị của radio.
   */
  label: ReactNode;
  selected: boolean;
  onSelect: (id: ChoiceId) => void;
}

export function AnswerChoice({
  name,
  choice,
  label,
  selected,
  onSelect,
}: AnswerChoiceProps) {
  return (
    <label
      className={`flex cursor-pointer items-center rounded border px-4 py-3 transition-colors ${
        selected
          ? "border-2 border-brand py-[11px]"
          : "border-border bg-card hover:border-ring/50 hover:bg-accent"
      }`}
    >
      {/* Radio thật ẩn đi (giữ keyboard + screen reader), card là affordance thị giác. */}
      <input
        type="radio"
        name={name}
        value={choice.id}
        checked={selected}
        onChange={() => onSelect(choice.id)}
        className="sr-only"
      />
      <span
        // size-6 (24px) chứ KHÔNG phải size-7: badge phải thấp hơn dòng text
        // (text-base/leading-relaxed ≈ 26px) để không làm hàng cao thêm. Khu vực
        // trả lời của QuestionRenderer cao CỐ ĐỊNH 238px — badge 28px đẩy đúng
        // lựa chọn D ra ngoài vùng nhìn thấy.
        className={`mr-3 flex size-6 shrink-0 items-center justify-center rounded-md border font-mono text-sm font-medium transition-colors ${
          selected ? "border-brand bg-brand text-brand-foreground" : "border-border text-muted-foreground"
        }`}
      >
        {choice.id}
      </span>
      {/* Dấu cách THẬT: tên khả truy cập nối các phần tử inline không tự chèn
          khoảng trắng — thiếu nó screen reader đọc liền "Be^x + C". Flex bỏ qua
          text node chỉ chứa khoảng trắng nên hình thức không đổi. */}{" "}
      {label}
    </label>
  );
}
