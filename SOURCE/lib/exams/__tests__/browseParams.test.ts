// hasBrowseParam — dự đoán nhánh render của /exams (Kho đề theo kệ, AC-008/
// AC-010): có ĐÚNG 1 trong 10 tham số URL của lưới phẳng hay không.
//
// Bất biến quan trọng nhất (Boundary Context, work plan Connection Map):
// predicate đọc SỰ HIỆN DIỆN CỦA KHOÁ THÔ (`key in sp && sp[key] !== undefined`),
// KHÔNG BAO GIỜ đọc giá trị đã chuẩn hoá/parse. `?sort=garbage`, `?page=abc`,
// `?dir=asc` đều parse ra `undefined`/`NaN` ở page.tsx, nhưng URL đó VẪN phải
// render lưới phẳng (AC-010) — nếu predicate lỡ đọc local đã parse, những case
// này sẽ sai thành `false` (coi như "vắng mặt") và âm thầm hiện kệ thay vì
// lưới phẳng. Test này canh đúng lỗi đó.
//
// @category: core-functionality
// @dependency: none — hàm thuần, không I/O

import { describe, expect, it } from "vitest";
import { BROWSE_PARAM_KEYS, hasBrowseParam } from "@/lib/exams/browseParams";

describe("BROWSE_PARAM_KEYS", () => {
  it("đúng 10 khoá của AC-008, khớp với SearchParams của exams/page.tsx", () => {
    expect(BROWSE_PARAM_KEYS).toEqual([
      "q",
      "subject",
      "grade",
      "school",
      "year",
      "semester",
      "sort",
      "level",
      "dir",
      "page",
    ]);
  });
});

describe("hasBrowseParam — bare URL (0 khoá nào hiện diện)", () => {
  it("object rỗng -> false", () => {
    expect(hasBrowseParam({})).toBe(false);
  });

  it("object chỉ chứa khoá KHÔNG nằm trong danh sách -> false", () => {
    expect(hasBrowseParam({ unrelated: "x", another: "y" })).toBe(false);
  });
});

describe("hasBrowseParam — mỗi khoá trong 10 khoá AC-008, hiện diện với giá trị hợp lệ -> true", () => {
  it.each(BROWSE_PARAM_KEYS)("khoá '%s' hiện diện -> true", (key) => {
    expect(hasBrowseParam({ [key]: "anything" })).toBe(true);
  });
});

describe("hasBrowseParam — giá trị dị dạng vẫn được coi là HIỆN DIỆN (đọc khoá thô, không đọc giá trị đã parse)", () => {
  it("?sort=garbage -> true (dù page.tsx parse ra undefined)", () => {
    expect(hasBrowseParam({ sort: "garbage" })).toBe(true);
  });

  it("?page=abc -> true (dù Number.parseInt ra NaN)", () => {
    expect(hasBrowseParam({ page: "abc" })).toBe(true);
  });

  it("?dir=asc không kèm ?sort -> true (AC-010: dir đơn độc vẫn phải xuống lưới phẳng)", () => {
    expect(hasBrowseParam({ dir: "asc" })).toBe(true);
  });

  it("?q= (hiện diện nhưng rỗng) -> true, không bị coi là falsy", () => {
    expect(hasBrowseParam({ q: "" })).toBe(true);
  });

  it("giá trị là mảng (repeated key, vd ?subject=a&subject=b) -> true, vẫn !== undefined", () => {
    expect(hasBrowseParam({ subject: ["a", "b"] })).toBe(true);
  });
});

describe("hasBrowseParam — khoá hiện diện nhưng giá trị là undefined -> false (đúng phần thứ hai của rule)", () => {
  it("{ sort: undefined } -> false (khoá tồn tại trên object nhưng giá trị undefined)", () => {
    expect(hasBrowseParam({ sort: undefined })).toBe(false);
  });
});
