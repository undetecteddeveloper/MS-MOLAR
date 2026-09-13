// recovery — nhận diện access token của lượt khôi phục mật khẩu qua claim
// `amr`, và danh sách path một phiên đang khôi phục được tới.

import { describe, expect, it } from "vitest";
import {
  RECOVERY_PATH,
  isRecoveryAccessToken,
  isRecoveryAllowedPath,
} from "@/lib/auth/recovery";

/** Dựng một JWT KHÔNG ký (header.payload.signature) — hàm chỉ đọc payload. */
function fakeJwt(payload: unknown): string {
  const enc = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${enc({ alg: "HS256", typ: "JWT" })}.${enc(payload)}.sig`;
}

describe("isRecoveryAccessToken", () => {
  it("true khi amr có method=recovery", () => {
    const token = fakeJwt({
      sub: "u1",
      amr: [{ method: "recovery", timestamp: 1789266208 }],
    });
    expect(isRecoveryAccessToken(token)).toBe(true);
  });

  it("false với phiên đăng nhập mật khẩu / OAuth", () => {
    expect(isRecoveryAccessToken(fakeJwt({ amr: [{ method: "password" }] }))).toBe(false);
    expect(isRecoveryAccessToken(fakeJwt({ amr: [{ method: "oauth" }] }))).toBe(false);
  });

  it("false khi thiếu amr, token rỗng, token hỏng — không ném", () => {
    expect(isRecoveryAccessToken(fakeJwt({ sub: "u1" }))).toBe(false);
    expect(isRecoveryAccessToken(fakeJwt({ amr: "recovery" }))).toBe(false);
    expect(isRecoveryAccessToken("")).toBe(false);
    expect(isRecoveryAccessToken(null)).toBe(false);
    expect(isRecoveryAccessToken(undefined)).toBe(false);
    expect(isRecoveryAccessToken("not-a-jwt")).toBe(false);
    expect(isRecoveryAccessToken("a.###.c")).toBe(false);
  });

  it("đọc được payload có ký tự ngoài ASCII (giải mã UTF-8 tường minh)", () => {
    const token = fakeJwt({ user_metadata: { name: "Nguyễn Phát" }, amr: [{ method: "recovery" }] });
    expect(isRecoveryAccessToken(token)).toBe(true);
  });
});

describe("isRecoveryAllowedPath", () => {
  it("chỉ cho trang đặt lại và điểm về của link email", () => {
    expect(isRecoveryAllowedPath(RECOVERY_PATH)).toBe(true);
    expect(isRecoveryAllowedPath("/auth/callback")).toBe(true);
    expect(isRecoveryAllowedPath("/")).toBe(false);
    expect(isRecoveryAllowedPath("/exams")).toBe(false);
    expect(isRecoveryAllowedPath("/profile")).toBe(false);
    // Tiền tố THEO ĐOẠN, không phải tiền tố chuỗi thô.
    expect(isRecoveryAllowedPath("/reset-password-old")).toBe(false);
  });
});
