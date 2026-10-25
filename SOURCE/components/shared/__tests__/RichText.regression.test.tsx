// @vitest-environment jsdom

// Task 3.1 (Gate B) — fixture hồi quy gieo sẵn (ADR-0002).
//
// Snapshot được TẠO TRƯỚC khi harden RichText (baseline = pipeline chưa có
// rehype-sanitize), sau đó harden và chạy lại: snapshot PHẢI giữ nguyên —
// chứng minh sanitize không làm regress nội dung seed đang hiển thị.
//
// Fixture đại diện lấy từ lib/fake-data/exams.ts (nội dung seed thật: unicode
// toán ℝ/², backslash "\ {2}") + các mẫu LaTeX $…$/$$…$$/\frac/\sqrt mà
// RichText đã hỗ trợ cho nội dung câu hỏi.

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "../RichText";

// Stems seed (block) — nguyên văn từ lib/fake-data/exams.ts.
const SEEDED_STEMS = [
  "Tập xác định của hàm số y = 1 / (x - 2) là?",
  "Parabol y = x² - 4x + 3 có tọa độ đỉnh là?",
  "Một vật chuyển động thẳng đều với vận tốc 5 m/s. Quãng đường đi được trong 4 s là?",
];

// Choices seed (inline) — chứa backslash, unicode, ngoặc nhọn.
const SEEDED_CHOICES = ["ℝ \\ {2}", "(2; +∞)", "m/s²", "{2; 3}", "x = -3"];

// Mẫu LaTeX đại diện cho nội dung dùng math thật.
const MATH_SAMPLES = [
  "Giá trị của $x^2 + \\frac{1}{2}$ khi $x = 2$?",
  "Tính $\\sqrt{2} \\cdot \\sqrt{8}$",
  "$$\\int_0^1 x \\, dx = \\frac{1}{2}$$",
  "Cho hàm số $y = \\dfrac{2x+1}{x-1}$, mệnh đề nào đúng?",
];

describe("RichText — seeded regression (block)", () => {
  for (const [i, stem] of SEEDED_STEMS.entries()) {
    it(`stem seed #${i + 1} render không đổi`, () => {
      const { container } = render(<RichText text={stem} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  }
  for (const [i, sample] of MATH_SAMPLES.entries()) {
    it(`math sample #${i + 1} render không đổi`, () => {
      const { container } = render(<RichText text={sample} />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  }
});

describe("RichText — seeded regression (inline choices)", () => {
  for (const [i, choice] of SEEDED_CHOICES.entries()) {
    it(`choice seed #${i + 1} render không đổi`, () => {
      const { container } = render(<RichText text={choice} inline />);
      expect(container.innerHTML).toMatchSnapshot();
    });
  }
});

describe("RichText — GFM subset seed", () => {
  it("bảng + bold + code render không đổi", () => {
    const md = [
      "Cho **bảng giá trị**:",
      "",
      "| x | y |",
      "|---|---|",
      "| 1 | 2 |",
      "",
      "và đoạn `y = f(x)`.",
    ].join("\n");
    const { container } = render(<RichText text={md} />);
    expect(container.innerHTML).toMatchSnapshot();
  });
});
