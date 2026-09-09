// AnswerChoice — một lựa chọn đáp án trong Exam Player (Layer 2). GĐ 3 M3.1 Task 2.
// Radio native ẩn (giữ a11y), thẻ là affordance thị giác. Controlled qua props
// selected/onSelect.
//
// Theme "Sân trường" (2026-09-06): hàng lựa chọn là THẺ TÔ NỀN trắng nằm trên
// thẻ câu hỏi màu surface — không kẻ viền. Đang chọn = nền vàng nhẹ + viền vàng
// nắng 2px + huy hiệu chữ cái đổi sang TÔ ĐẶC màu chữ (xanh đen). Vàng tự nó chỉ
// đạt 1,6:1 nên không được là ranh giới thông tin một mình (design plan §2):
// huy hiệu đặc là kênh hình, radio `checked` là kênh trợ năng, vàng là kênh màu.
//
// Viền 2px TRONG SUỐT ở trạng thái chưa chọn: hai trạng thái cao bằng nhau nên
// chọn đáp án không xê dịch các hàng bên dưới. Chiều cao mỗi hàng giữ 52px
// (26px chữ + 22px đệm + 4px viền) vì khu vực trả lời của QuestionRenderer cao
// CỐ ĐỊNH 238px = 4 hàng × 52px + 3 khe × 10px — nới thêm là lựa chọn D rơi ra
// ngoài vùng nhìn thấy.
//
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

export function AnswerChoice({ name, choice, label, selected, onSelect }: AnswerChoiceProps) {
  return (
    <label
      className={`has-[:focus-visible]:ring-ring/40 flex cursor-pointer items-center rounded-lg border-2 px-4 py-[11px] transition-[color,background-color,border-color,scale] ease-out motion-safe:active:scale-[0.985] has-[:focus-visible]:ring-3 ${
        selected
          ? "border-sun bg-sun-soft"
          : "bg-card border-transparent hover:bg-[color-mix(in_oklch,var(--card),var(--foreground)_5%)]"
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
        // (text-base/leading-relaxed ≈ 26px) để không làm hàng cao thêm — xem
        // phép tính 238px ở đầu file.
        // `motion-badge-in` chỉ gắn khi đang chọn → animation chạy đúng lúc
        // huy hiệu này TRỞ THÀNH được chọn (globals.css §CHUYỂN ĐỘNG).
        className={`mr-3 flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
          selected ? "motion-badge-in bg-foreground text-background" : "bg-surface text-muted-foreground"
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
