// @vitest-environment jsdom

// `\begin{tabular}` → bảng GFM.
//
// Vì sao test này tồn tại: `tabular` KHÔNG phải môi trường toán. KaTeX không
// hiểu nó, và bảng trong đề gần như luôn nằm NGOÀI `$…$` nên remark-math cũng
// không chạm tới — kết quả là mã nguồn LaTeX của bảng đổ nguyên ra màn hình
// dưới dạng chữ thô. Không lỗi, không cảnh báo, chỉ là một câu hỏi đọc không
// nổi (bug prod: đề Sinh học 12 câu 38, bảng kiểu gen/số lượng). Cùng một hình
// dạng im lặng như normalizeMathDelimiters, nên cũng cần test canh.
//
// @category: core-functionality
// @dependency: none — real RichText, no mocks

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText, tabularToMarkdownTable } from "../RichText";

const PROD_FIXTURE = `Trong các phát biểu sau, có bao nhiêu dự đoán phù hợp?
\\begin{tabular}{lll}
\\hline
Các loài ốc & Kiểu gen & Số lượng \\\\
\\hline
A. sulfic & AA & 126 \\\\
A. andea & DD & 122 \\\\
\\hline
\\end{tabular}
(I) cả hai loài này đều đã bị ảnh hưởng của yếu tố ngẫu nhiên.`;

describe("tabularToMarkdownTable", () => {
  it("đổi tabular thành bảng GFM: hàng đầu là header, \\hline bị bỏ", () => {
    expect(tabularToMarkdownTable("\\begin{tabular}{ll}\\hline a & b \\\\ c & d \\\\\\end{tabular}"))
      .toBe(`
| a | b |
| --- | --- |
| c | d |
`);
  });

  it("bỏ qua cột thiếu bằng cách đệm ô rỗng — GFM đòi mọi hàng cùng số cột", () => {
    expect(tabularToMarkdownTable("\\begin{tabular}{lll}a & b & c \\\\ d \\\\\\end{tabular}")).toBe(`
| a | b | c |
| --- | --- | --- |
| d |  |  |
`);
  });

  it("escape dấu | trong ô để nó không cắt nhầm cột", () => {
    expect(tabularToMarkdownTable("\\begin{tabular}{l}$a|b$ \\\\\\end{tabular}")).toContain(
      "| $a\\|b$ |"
    );
  });

  it("KHÔNG đụng \\begin{cases} — môi trường đó nằm trong $…$ và KaTeX render đúng", () => {
    const cases = "$d: \\begin{cases} x = 2 \\\\ y = 3 + 2t \\end{cases}$";
    expect(tabularToMarkdownTable(cases)).toBe(cases);
  });

  it("thân bảng không đọc ra hàng nào → trả nguyên văn, không nuốt nội dung", () => {
    const empty = "\\begin{tabular}{l}\\hline\\end{tabular}";
    expect(tabularToMarkdownTable(empty)).toBe(empty);
  });
});

describe("RichText — fixture thật từ production", () => {
  it("render ra <table> thật, không còn chữ 'tabular' hay '\\hline' trên màn hình", () => {
    const { container } = render(<RichText text={PROD_FIXTURE} />);

    const table = container.querySelector("table");
    expect(table).not.toBeNull();
    expect(Array.from(table!.querySelectorAll("th")).map((c) => c.textContent)).toEqual([
      "Các loài ốc",
      "Kiểu gen",
      "Số lượng",
    ]);
    expect(table!.querySelectorAll("tbody tr")).toHaveLength(2);

    expect(container.textContent).not.toContain("tabular");
    expect(container.textContent).not.toContain("hline");
    // Phần văn bản quanh bảng phải còn nguyên.
    expect(container.textContent).toContain("có bao nhiêu dự đoán phù hợp?");
    expect(container.textContent).toContain("yếu tố ngẫu nhiên");
  });
});
