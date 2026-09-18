// toAttemptSource — chuẩn hoá `?from=` (client-controlled) về 4 giá trị
// exam_attempts.source đã khai trong CHECK (P0-T1, schema.sql:207-208).
//
// Bất biến quan trọng nhất (AC-041, ADR-0021 D5): KHÔNG BAO GIỜ ném lỗi hay
// chặn attempt start vì một giá trị lạ — mọi input không khớp đúng 1 trong 4
// literal đều rơi về 'none', kể cả input cố tình dị dạng (mảng, chuỗi kiểu
// injection). CHECK ở DB là bức tường thứ hai, không phải thứ nhất; test này
// canh bức tường thứ nhất — tầng ứng dụng không bao giờ cần tới bức tường kia.
//
// @category: core-functionality
// @dependency: none — hàm thuần, không I/O

import { describe, expect, it } from "vitest";
import { ATTEMPT_SOURCES, toAttemptSource } from "@/lib/exams/attemptSource";

describe("ATTEMPT_SOURCES", () => {
  it("đúng 4 literal, khớp byte-for-byte với CHECK của schema.sql", () => {
    expect(ATTEMPT_SOURCES).toEqual(["practice", "hot", "explore", "none"]);
  });
});

describe("toAttemptSource — round-trip 4 literal hợp lệ", () => {
  it.each(ATTEMPT_SOURCES)("giữ nguyên khi input là '%s'", (literal) => {
    expect(toAttemptSource(literal)).toBe(literal);
  });
});

describe("toAttemptSource — mọi input không khớp rơi về 'none'", () => {
  it("undefined -> 'none' (bấm nút không qua ?from, flat grid/home)", () => {
    expect(toAttemptSource(undefined)).toBe("none");
  });

  it("null -> 'none'", () => {
    expect(toAttemptSource(null)).toBe("none");
  });

  it("chuỗi rỗng -> 'none'", () => {
    expect(toAttemptSource("")).toBe("none");
  });

  it("literal sai hoa/thường ('PRACTICE') -> 'none', không tự động lowercase", () => {
    expect(toAttemptSource("PRACTICE")).toBe("none");
  });

  it("chuỗi dạng injection -> 'none', không ném lỗi", () => {
    expect(toAttemptSource("' or 1=1 --")).toBe("none");
  });

  it("mảng (searchParams đa giá trị, vd ?from=a&from=b) -> 'none'", () => {
    expect(toAttemptSource(["practice", "hot"])).toBe("none");
  });

  it("mảng rỗng -> 'none'", () => {
    expect(toAttemptSource([])).toBe("none");
  });
});
