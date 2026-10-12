// isMaxwellQuery — chỉ khớp TOÀN BỘ từ khoá. Phần lớn ca là ca KHÔNG được khớp:
// một từ khoá tìm đề thật mà bị đưa sang trang ẩn là lỗi khó thấy nhất.

import { describe, expect, it } from "vitest";
import { isMaxwellQuery, MAXWELL_PATH } from "../easterEgg";

describe("isMaxwellQuery", () => {
  it.each([
    "maxwell",
    "Maxwell",
    "MAXWELL",
    "  maxwell  ",
    "cat",
    "Cat",
    "CAT",
    "mèo",
    "Mèo",
    "meo",
    "cát", // bỏ dấu giống ô tìm: "cát" → "cat"
  ])("khớp %j", (raw) => {
    expect(isMaxwellQuery(raw)).toBe(true);
  });

  it.each([
    "category",
    "education",
    "catalan",
    "maxwell the cat",
    "max",
    "maxwel",
    "cats",
    "toán",
    "c",
    "",
    "   ",
    "m.a.x.w.e.l.l",
  ])("không khớp %j", (raw) => {
    expect(isMaxwellQuery(raw)).toBe(false);
  });

  it("null và undefined không khớp", () => {
    expect(isMaxwellQuery(null)).toBe(false);
    expect(isMaxwellQuery(undefined)).toBe(false);
  });

  it("từ khoá dài bất thường bị cắt trước khi so khớp, không khớp nhầm", () => {
    expect(isMaxwellQuery(`maxwell${" ".repeat(200)}x`)).toBe(true); // cắt ở 64 ký tự: còn "maxwell"
    expect(isMaxwellQuery(`${"a".repeat(70)}maxwell`)).toBe(false);
  });

  it("đường dẫn đích là /maxwell", () => {
    expect(MAXWELL_PATH).toBe("/maxwell");
  });
});
