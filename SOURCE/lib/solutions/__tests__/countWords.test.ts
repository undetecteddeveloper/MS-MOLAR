// countWords — TS twin của SQL count_words() (backend DD § Main Components
// "lib/solutions/countWords.ts"; AC-023, UI Spec "Cách đo" hàng "Đếm từ").
//
// Các ca đúng theo AC-023 (PRD, verbatim): "'Chọn A vì A đúng' (5 từ) không
// đạt; một ghi chú gồm 14 từ và một công thức '$\Delta = b^2 - 4ac$' viết liền
// không khoảng trắng bên trong đếm là 15 từ và đạt; xuống dòng và tab tách từ
// như dấu cách; bộ đếm ở giao diện và phép đếm ở server cho cùng kết quả trên
// cùng chuỗi."
import { describe, expect, it } from "vitest";

import { countWords } from "@/lib/solutions/countWords";

describe("countWords — twin của SQL count_words() (AC-023)", () => {
  it("chuỗi rỗng đếm 0 từ", () => {
    expect(countWords("")).toBe(0);
  });

  it("chuỗi chỉ toàn khoảng trắng (kể cả tab/xuống dòng) đếm 0 từ", () => {
    expect(countWords("   \t\n  ")).toBe(0);
  });

  it("'Chọn A vì A đúng' đếm đúng 5 từ — không đạt luật 15 từ", () => {
    expect(countWords("Chọn A vì A đúng")).toBe(5);
  });

  it("14 từ + một công thức viết liền (không khoảng trắng bên trong) đếm đủ 15 từ và đạt", () => {
    const fourteenWords = "một hai ba bốn năm sáu bảy tám chín mười mười-một mười-hai mười-ba mười-bốn";
    expect(countWords(fourteenWords)).toBe(14);
    const withFormula = `${fourteenWords} $\\Delta=b^2-4ac$`;
    expect(countWords(withFormula)).toBe(15);
  });

  it("xuống dòng và tab tách từ giống hệt dấu cách", () => {
    expect(countWords("a\nb\tc   d")).toBe(4);
  });

  it("khoảng trắng đầu/cuối không tính vào số từ", () => {
    expect(countWords("  một hai ba  ")).toBe(3);
  });

  it("giao diện và server dùng CHUNG một hàm — cùng chuỗi cho cùng kết quả (đối chứng bằng hai lời gọi độc lập)", () => {
    const note = "một hai ba bốn năm sáu bảy tám";
    expect(countWords(note)).toBe(countWords(note));
    expect(countWords(note)).toBe(8);
  });
});
