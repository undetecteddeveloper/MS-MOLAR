import { describe, expect, it } from "vitest";
import { paginate } from "../paginate";

const items = Array.from({ length: 47 }, (_, i) => i + 1);

describe("paginate", () => {
  it("cắt đúng trang đầu, trang giữa và trang cuối (không lặp, không thiếu dòng ở mép)", () => {
    expect(paginate(items, 1, 20)).toEqual({
      items: items.slice(0, 20),
      page: 1,
      pageCount: 3,
      total: 47,
    });
    expect(paginate(items, 2, 20).items).toEqual(items.slice(20, 40));
    expect(paginate(items, 3, 20).items).toEqual(items.slice(40, 47));
  });

  it("kẹp trang vượt trần về trang cuối và trang lạ về trang 1", () => {
    expect(paginate(items, 999, 20).page).toBe(3);
    expect(paginate(items, 0, 20).page).toBe(1);
    expect(paginate(items, -4, 20).page).toBe(1);
    expect(paginate(items, Number.NaN, 20).page).toBe(1);
    expect(paginate(items, 2.9, 20).page).toBe(2);
  });

  it("danh sách rỗng vẫn là MỘT trang, không phải không trang", () => {
    expect(paginate([], 1, 20)).toEqual({ items: [], page: 1, pageCount: 1, total: 0 });
  });

  it("cỡ trang lạ (0, âm, NaN) không chia cho 0 mà rơi về 1 dòng/trang", () => {
    expect(paginate(items, 1, 0).pageCount).toBe(47);
    expect(paginate(items, 1, -5).items).toEqual([1]);
    expect(paginate(items, 1, Number.NaN).items).toEqual([1]);
  });
});
