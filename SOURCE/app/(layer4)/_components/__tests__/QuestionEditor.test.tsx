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
//
// TD-023 (2026-08-27): RichText nay NẠP ĐỘNG (next/dynamic) trong QuestionEditor
// — 102 KB br ra khỏi đường hydrate ban đầu của route nặng nhất site. Hệ quả với
// test: cây React chỉ có nội dung đã render SAU khi chunk kia resolve, nên mọi
// khẳng định về `.katex` phải `await`. Cố ý KHÔNG mock `next/dynamic`: mock đi
// thì test sẽ xanh kể cả khi ranh giới nạp động hỏng, tức là mất đúng thứ nó canh.

// Không có auto-cleanup của RTL trong cấu hình vitest này → truy vấn bó trong
// `container`, không dùng `screen`.
import { fireEvent, render, waitFor, within } from "@testing-library/react";

import { describe, expect, it, vi } from "vitest";
import type { AssembledQuestion } from "@/lib/ugc/types";
import { QuestionEditor } from "../QuestionEditor";

/** NGÂN SÁCH CHỜ cho ranh giới `next/dynamic` + một lượt render KaTeX thật.
 *
 *  Đây là một con số NGÂN SÁCH, không phải một lời khẳng định về hiệu năng:
 *  mặc định 1000ms của RTL đủ khi chạy một mình (đo 1290ms khi chạy CẢ BỘ) và
 *  hụt khi 120 file test cùng tranh CPU, tức là một test ĐỎ NGẪU NHIÊN theo
 *  tải máy — thứ vô dụng hơn cả không có test, vì nó dạy người đọc bỏ qua màu
 *  đỏ. Nới rộng ở đây KHÔNG làm yếu điều đang canh: nếu nội dung không bao giờ
 *  render thì `waitFor` vẫn đỏ, chỉ là muộn hơn. (Cùng bài học với
 *  ExplainStepAffordance.test.tsx.) */
const DYNAMIC_RENDER_BUDGET_MS = 5000;


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
  it("stem có công thức render thành math, không in chuỗi nguồn", async () => {
    const { container } = renderEditor();

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), {
      timeout: DYNAMIC_RENDER_BUDGET_MS,
    });
    expect(container.textContent).not.toContain("$\\frac{1}{2} + \\frac{1}{3}$");
  });

  it("lựa chọn A–D có công thức cũng render thành math", async () => {
    const { container } = renderEditor();

    await waitFor(() => expect(container.querySelector("annotation")).not.toBeNull(), {
      timeout: DYNAMIC_RENDER_BUDGET_MS,
    });
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

  it("ý a–d của true_false cũng render math ở chế độ xem", async () => {
    const { container } = renderEditor({
      part: 2,
      number: 1,
      type: "true_false",
      stem: "Xét tính đúng sai:",
      subItems: [{ id: "a", text: "Hàm số nghịch biến trên $(-\\infty; 2)$." }],
      subAnswers: { a: true },
      topic: "Hàm số",
    });

    await waitFor(() => expect(container.querySelector(".katex")).not.toBeNull(), {
      timeout: DYNAMIC_RENDER_BUDGET_MS,
    });
  });
});
