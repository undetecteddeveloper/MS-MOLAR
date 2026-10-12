// @vitest-environment jsdom

// Dấu "trang trước khi vào Maxwell" trong sessionStorage. Đường tấn công là
// trọng tâm: giá trị này cuối cùng đi vào `router.push`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSafeMaxwellOrigin, readMaxwellOrigin, rememberMaxwellOrigin } from "../easterEgg";

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isSafeMaxwellOrigin", () => {
  it.each([
    "/exams",
    "/exams?subject=Math&page=2",
    "/exams/exam-toan-10",
    "/history?scoreMin=5",
    "/me/dashboard",
    "/profile",
    "/maxwelling", // chỉ KHÁC trang ẩn, không phải nó
  ])("nhận %s", (value) => {
    expect(isSafeMaxwellOrigin(value)).toBe(true);
  });

  it.each([
    "",
    "exams",
    "//evil.com",
    "//evil.com/path",
    "https://evil.com",
    "javascript:alert(1)",
    "/\\evil.com",
    "/exams\\evil",
    "/exams\nSet-Cookie: x=1",
    "/exams\u0000",
    "/maxwell",
    "/maxwell?x=1",
    "/maxwell/extra",
    `/${"a".repeat(600)}`,
  ])("từ chối %j", (value) => {
    expect(isSafeMaxwellOrigin(value)).toBe(false);
  });

  it.each([null, undefined, 42, {}, []])("từ chối giá trị không phải chuỗi %j", (value) => {
    expect(isSafeMaxwellOrigin(value)).toBe(false);
  });
});

describe("rememberMaxwellOrigin / readMaxwellOrigin", () => {
  it("ghi rồi đọc lại đúng giá trị", () => {
    rememberMaxwellOrigin("/exams?subject=Math");
    expect(readMaxwellOrigin()).toBe("/exams?subject=Math");
  });

  it("chưa ghi → null", () => {
    expect(readMaxwellOrigin()).toBeNull();
  });

  it("không ghi giá trị không an toàn; dấu cũ giữ nguyên", () => {
    rememberMaxwellOrigin("/history");
    rememberMaxwellOrigin("//evil.com");
    expect(readMaxwellOrigin()).toBe("/history");
  });

  it("giá trị độc bị chèn thẳng vào storage vẫn không được trả ra", () => {
    window.sessionStorage.setItem("ms-molar-maxwell-origin", "//evil.com");
    expect(readMaxwellOrigin()).toBeNull();
  });

  it("sessionStorage ném lỗi (chế độ riêng tư/bị chặn) → không văng, đọc ra null", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });

    expect(() => rememberMaxwellOrigin("/exams")).not.toThrow();
    expect(readMaxwellOrigin()).toBeNull();
  });
});
