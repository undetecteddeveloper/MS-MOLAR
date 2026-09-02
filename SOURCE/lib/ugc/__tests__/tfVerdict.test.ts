// tfVerdict — đọc phán quyết Đúng/Sai từ file đáp án viết bằng bất kỳ chữ cái
// nào (2026-09-02). Nguồn gốc: đề TIẾNG ANH ghi "Câu 21: T" / "3. F", extractor
// chỉ được dạy Đ/S tiếng Việt nên câu rơi khỏi đường chấm điểm.

import { describe, expect, it } from "vitest";
import { parseTfVerdict, parseTfVerdictSequence } from "../tfVerdict";

describe("parseTfVerdict — một token", () => {
  it("đọc được cả chữ cái Việt lẫn Anh cho ĐÚNG", () => {
    for (const token of ["Đ", "đ", "Đúng", "ĐÚNG", "D", "T", "t", "True", "TRUE", "Y", "Yes", "✓"]) {
      expect(parseTfVerdict(token), token).toBe(true);
    }
  });

  it("đọc được cả chữ cái Việt lẫn Anh cho SAI", () => {
    for (const token of ["S", "s", "Sai", "SAI", "F", "f", "False", "FALSE", "N", "No", "✗"]) {
      expect(parseTfVerdict(token), token).toBe(false);
    }
  });

  it("bỏ dấu câu bao quanh trước khi đọc", () => {
    expect(parseTfVerdict(" (T). ")).toBe(true);
    expect(parseTfVerdict('"F"')).toBe(false);
  });

  it("trả null cho token không quyết định được", () => {
    // "X" CỐ Ý không nằm trong bảng nào: trong đáp án viết tay nó vừa là dấu
    // tích (chọn) vừa là dấu gạch (sai) — đoán một nghĩa là chấm sai bài.
    for (const token of ["X", "x", "?", "", "  ", "A", "1", "Đúng/Sai"]) {
      expect(parseTfVerdict(token), token).toBeNull();
    }
  });
});

describe("parseTfVerdictSequence — cả dòng đáp án của một câu", () => {
  it("dạng có nhãn ý — giữ đúng nhãn file đã ghi", () => {
    expect(parseTfVerdictSequence("a:Đ,b:S,c:Đ,d:S")).toEqual({
      a: true,
      b: false,
      c: true,
      d: false,
    });
    expect(parseTfVerdictSequence("a) T  b) F")).toEqual({ a: true, b: false });
    expect(parseTfVerdictSequence("A - True, B - False")).toEqual({ a: true, b: false });
  });

  it("dạng tách bằng dấu — gán theo thứ tự a–d", () => {
    expect(parseTfVerdictSequence("T,F,T,T")).toEqual({ a: true, b: false, c: true, d: true });
    expect(parseTfVerdictSequence("Đ S Đ Đ")).toEqual({ a: true, b: false, c: true, d: true });
  });

  it("dạng dính liền — mỗi ký tự một ý", () => {
    expect(parseTfVerdictSequence("TFTT")).toEqual({ a: true, b: false, c: true, d: true });
    expect(parseTfVerdictSequence("ĐSĐĐ")).toEqual({ a: true, b: false, c: true, d: true });
  });

  it("MỘT phán quyết đơn lẻ — đúng hình dạng đề Tiếng Anh sinh ra lỗi này", () => {
    expect(parseTfVerdictSequence("T")).toEqual({ a: true });
    expect(parseTfVerdictSequence("F")).toEqual({ a: false });
    expect(parseTfVerdictSequence("True")).toEqual({ a: true });
  });

  it("một từ đầy đủ KHÔNG bị cắt thành từng ký tự", () => {
    // Bẫy thứ tự: nếu nhánh "dính liền" chạy trước nhánh "tách bằng dấu" thì
    // "TRUE" đọc thành T-R-U-E và trả về rác thay vì {a:true}.
    expect(parseTfVerdictSequence("TRUE")).toEqual({ a: true });
    expect(parseTfVerdictSequence("FALSE")).toEqual({ a: false });
  });

  it("trả null khi có bất kỳ mẩu nào không đọc được", () => {
    for (const raw of ["", "   ", "1260", "T, ?, F", "a:T,b:5", "chưa có đáp án", "A"]) {
      expect(parseTfVerdictSequence(raw), raw).toBeNull();
    }
  });

  it("trả null khi dòng dài hơn 4 ý — không có ý nào để gán tiếp", () => {
    expect(parseTfVerdictSequence("T,F,T,F,T")).toBeNull();
  });
});
