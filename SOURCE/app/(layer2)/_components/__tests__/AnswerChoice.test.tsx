// @vitest-environment jsdom

// AnswerChoice — badge chữ cái A–D + LaTeX trong nội dung lựa chọn.
//
// Chữ cái phải nằm trong TÊN KHẢ TRUY CẬP của radio, không chỉ hiện ra bằng
// mắt: người làm bài gọi đáp án bằng chữ cái ("chọn B"), và màn kết quả cũng
// đối chiếu theo chữ cái. Một badge aria-hidden sẽ trông đúng và đọc sai.
//
// @category: core-functionality
// @dependency: none — real AnswerChoice + real RichText, no mocks

// Không có auto-cleanup của RTL trong cấu hình vitest này (không globals,
// không setupFile) → mọi truy vấn phải bó trong `container`, không dùng
// `screen` (document tích luỹ qua các test trong cùng file).
import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Choice } from "@/types/question";
import { AnswerChoice } from "../AnswerChoice";

const CHOICE: Choice = { id: "B", text: "e^x + C" };

function renderChoice(choice: Choice = CHOICE, selected = false, onSelect = vi.fn()) {
  return {
    onSelect,
    ...render(
      <AnswerChoice name="question-q1" choice={choice} selected={selected} onSelect={onSelect} />,
    ),
  };
}

describe("AnswerChoice — badge chữ cái", () => {
  it("hiện chữ cái của lựa chọn trước nội dung", () => {
    const { container } = renderChoice();

    expect(container.textContent).toBe("B e^x + C");
  });

  it("chữ cái nằm trong tên khả truy cập của radio", () => {
    const { container } = renderChoice();

    expect(within(container).getByRole("radio", { name: "B e^x + C" })).toBeTruthy();
  });

  it("vẫn bấm chọn được qua radio", () => {
    const { container, onSelect } = renderChoice();

    fireEvent.click(within(container).getByRole("radio"));

    expect(onSelect).toHaveBeenCalledWith("B");
  });

  it("nội dung lựa chọn có LaTeX vẫn render thành math", () => {
    const { container } = renderChoice({ id: "A", text: "$\\frac{1}{2}$" });

    expect(container.querySelector(".katex")).not.toBeNull();
  });
});
