// passwordPolicy — unit tests (Security review 2026-08-03, mục Low).
// Hàm thuần, không I/O → test trực tiếp, không mock.
// Điểm chính cần khoá: signUp() và updatePassword() nay dùng CHUNG một luật;
// trước đó signUp không kiểm gì và updatePassword chỉ đòi 6 ký tự.

import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  validatePassword,
} from "./passwordPolicy";

describe("validatePassword", () => {
  it("accepts a normal passphrase", () => {
    expect(validatePassword("correct horse battery")).toBeNull();
  });

  it("rejects anything shorter than the minimum", () => {
    expect(validatePassword("a".repeat(PASSWORD_MIN_LENGTH - 1))).toMatch(/at least/);
  });

  it("accepts exactly the minimum length (boundary)", () => {
    expect(validatePassword("a1b2c3d4e5".slice(0, PASSWORD_MIN_LENGTH))).toBeNull();
  });

  it("rejects the old 6-character minimum that updatePassword used to allow", () => {
    // Regression guard for the actual finding: 'abc123' passed before.
    expect(validatePassword("abc123")).not.toBeNull();
  });

  it("does NOT require mixed case, digits or symbols (NIST: length over composition)", () => {
    expect(validatePassword("aaaaaaaaaaaaaaa")).toBeNull();
  });

  it("rejects common passwords regardless of case", () => {
    expect(validatePassword("password123")).toMatch(/too common/);
    expect(validatePassword("PassWord123")).toMatch(/too common/);
    expect(validatePassword("matkhau123")).toMatch(/too common/);
  });

  it("rejects whitespace-only input even when long enough", () => {
    expect(validatePassword(" ".repeat(PASSWORD_MIN_LENGTH + 5))).toMatch(/only spaces/);
  });

  // bcrypt (thuật toán Supabase Auth dùng) cắt âm thầm sau 72 byte — mật khẩu
  // dài hơn thế tạo cảm giác an toàn giả.
  it("rejects passwords over the bcrypt byte ceiling", () => {
    expect(validatePassword("a".repeat(PASSWORD_MAX_BYTES + 1))).toMatch(/too long/);
  });

  it("accepts exactly the byte ceiling (boundary)", () => {
    expect(validatePassword("a".repeat(PASSWORD_MAX_BYTES))).toBeNull();
  });

  it("counts BYTES not characters, so accented Vietnamese hits the ceiling sooner", () => {
    // 'ế' is 3 bytes in UTF-8 → 30 chars but 90 bytes, over the 72-byte ceiling.
    const accented = "ế".repeat(30);
    expect(accented.length).toBeLessThan(PASSWORD_MAX_BYTES);
    expect(new TextEncoder().encode(accented).length).toBeGreaterThan(PASSWORD_MAX_BYTES);
    expect(validatePassword(accented)).toMatch(/too long/);
  });
});
