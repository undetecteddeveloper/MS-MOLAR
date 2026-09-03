// passwordPolicy — unit tests (Security review 2026-08-03, mục Low).
// Hàm thuần, không I/O → test trực tiếp, không mock.
// Điểm chính cần khoá: signUp() và updatePassword() nay dùng CHUNG một luật;
// trước đó signUp không kiểm gì và updatePassword chỉ đòi 6 ký tự.

import { readFileSync } from "node:fs";
import { join } from "node:path";
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

// Nguồn của sự cố 2026-08-22 ("không nhập được mật khẩu"): sàn độ dài từng
// được viết ở BA nơi với BA giá trị khác nhau — server bắt 10, thuộc tính
// minLength của form reset ghi 6, và câu gợi ý trên màn hình cũng ghi 6. Người
// dùng làm ĐÚNG theo chữ hiện trên màn hình vẫn bị từ chối, không có cách nào
// đoán ra luật thật. Nhóm test này khoá lại tính chất "một nguồn duy nhất" đó.
describe("cổng chống trôi lệch: sàn độ dài chỉ có MỘT nguồn", () => {
  const read = (relative: string) => readFileSync(join(process.cwd(), relative), "utf-8");

  it("không tụt xuống dưới sàn 8 của NIST SP 800-63B", () => {
    // Không khoá cứng ở 8 (hạ tiếp là quyết định có thể xảy ra), nhưng dưới 8
    // thì mất chỗ dựa tiêu chuẩn — đó phải là một thay đổi có chủ đích, kèm
    // sửa chính test này, chứ không lặng lẽ trôi.
    expect(PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(8);
  });

  it("không form nào viết số cứng vào minLength — phải lấy từ hằng số chung", () => {
    for (const path of [
      "features/auth/components/AuthForm.tsx",
      "features/auth/components/ResetPasswordForm.tsx",
    ]) {
      expect(read(path), `${path} viết số cứng vào minLength`).not.toMatch(
        /minLength=\{\s*\d/
      );
    }
  });

  it("câu gợi ý dùng tham số {min}, không viết sẵn con số vào bản dịch", () => {
    for (const locale of ["en", "vi"]) {
      const line = read(`lib/i18n/dictionaries/${locale}.ts`)
        .split("\n")
        .find((l) => l.includes('"auth.passwordHint"'));
      expect(line, `thiếu khoá auth.passwordHint trong ${locale}.ts`).toBeDefined();
      expect(line, `${locale}.ts viết số cứng trong auth.passwordHint`).toContain("{min}");
      expect(line).not.toMatch(/\d/);
    }
  });

  it("tab Đăng nhập KHÔNG gắn minLength — tài khoản cũ 6 ký tự vẫn phải vào được", () => {
    // Chính sách chỉ áp cho mật khẩu MỚI (xem đầu passwordPolicy.ts). Một
    // `minLength` vô điều kiện ở form đăng nhập sẽ khoá cửa đúng nhóm người
    // đang dùng sản phẩm, và trình duyệt chặn trước khi có bất kỳ câu lỗi nào.
    const source = read("features/auth/components/AuthForm.tsx");
    expect(source).toMatch(/minLength=\{\s*isSignup\s*\?/);
  });
});
