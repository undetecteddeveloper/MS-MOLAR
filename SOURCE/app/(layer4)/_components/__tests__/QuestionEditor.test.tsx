// @vitest-environment jsdom

// QuestionEditor — màn review sau upload phải HIỂN THỊ công thức, không in nguồn.
//
// Trước bản vá này layer4 không dùng <RichText> ở đâu cả: tác giả upload đề Toán
// và nhìn thấy "$\frac{1}{2}$" nguyên văn ở màn duyệt, trong khi màn làm bài lại
// render đúng. Không có cách nào biết đề hiển thị đúng hay sai trước khi publish.
//
// Chế độ SỬA cố ý giữ chuỗi NGUỒN trong input — sửa công thức thì phải sửa được
// LaTeX. Test này ghim đúng ranh giới đó: xem = đã render, sửa = nguồn thô.
//
// @category: core-functionality
// @dependency: none — real QuestionEditor + real RichText, no mocks

// Không có auto-cleanup của RTL trong cấu hình vitest này → truy vấn bó trong
// `container`, không dùng `screen`.
import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AssembledQuestion } from "@/lib/ugc/types";
import { QuestionEditor } from "../QuestionEditor";

const MCQ: AssembledQuestion = {
  part: 1,
  number: 1,
  type: "mcq",
  stem: "Tính $\\frac{1}{2} + \\frac{1}{3}$.",
  choices: [
    { id: "A", text: "$\\frac{5}{6}$" },
    { id: "B", text: "$\\frac{2}{5}$" },
    { id: "C", text: "1" },
    { id: "D", text: "2" },
  ],
  correctAnswer: "A",
  topic: "Phân số",
};

function renderEditor(question: AssembledQuestion = MCQ, onChange = vi.fn()) {
  return { onChange, ...render(<QuestionEditor question={question} onChange={onChange} hasError={false} />) };
}

describe("QuestionEditor — LaTeX ở chế độ xem", () => {
  it("stem có công thức render thành math, không in chuỗi nguồn", () => {
    const { container } = renderEditor();

    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.textContent).not.toContain("$\\frac{1}{2} + \\frac{1}{3}$");
  });

  it("lựa chọn A–D có công thức cũng render thành math", () => {
    const { container } = renderEditor();

    const annotations = Array.from(container.querySelectorAll("annotation")).map(
      (a) => a.textContent,
    );
    expect(annotations).toContain("\\frac{5}{6}");
    expect(annotations).toContain("\\frac{2}{5}");
  });

  it("chế độ sửa trả lại chuỗi NGUỒN để sửa được công thức", () => {
    const { container } = renderEditor();

    fireEvent.click(within(container).getByRole("button", { name: /edit/i }));

    expect(within(container).getByDisplayValue("Tính $\\frac{1}{2} + \\frac{1}{3}$.")).toBeTruthy();
    expect(within(container).getByDisplayValue("$\\frac{5}{6}$")).toBeTruthy();
  });

  it("ý a–d của true_false cũng render math ở chế độ xem", () => {
    const { container } = renderEditor({
      part: 2,
      number: 1,
      type: "true_false",
      stem: "Xét tính đúng sai:",
      subItems: [{ id: "a", text: "Hàm số nghịch biến trên $(-\\infty; 2)$." }],
      subAnswers: { a: true },
      topic: "Hàm số",
    });

    expect(container.querySelector(".katex")).not.toBeNull();
  });
});
