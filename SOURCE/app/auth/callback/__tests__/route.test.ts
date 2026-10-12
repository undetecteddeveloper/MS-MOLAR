// /auth/callback — đích sau OAuth đọc từ cookie `ms-molar-post-auth`
// (brief 20261012 T7). Khẳng định: cookie hợp lệ → về đúng trang; cookie lạ hoặc
// thiếu → /exams; link khôi phục mật khẩu KHÔNG bao giờ bị cookie kéo đi chỗ khác;
// cookie luôn bị xoá sau khi đọc.

import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore, exchangeMock } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn() },
  exchangeMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { exchangeCodeForSession: exchangeMock } }),
}));

import { GET } from "../route";

const ORIGIN = "http://localhost:3000";

async function callback(query: string): Promise<string | null> {
  const res = await GET(new Request(`${ORIGIN}/auth/callback?${query}`));
  const location = res.headers.get("location");
  return location ? location.replace(ORIGIN, "") : null;
}

function storedCookie(value: string | undefined) {
  cookieStore.get.mockImplementation((name: string) =>
    name === "ms-molar-post-auth" && value !== undefined ? { value } : undefined
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  exchangeMock.mockResolvedValue({ data: { session: { access_token: "not-a-jwt" } }, error: null });
});

describe("/auth/callback — đích từ cookie", () => {
  it("cookie hợp lệ → về đúng trang, rồi xoá cookie", async () => {
    storedCookie("/history");

    expect(await callback("code=abc&next=/exams")).toBe("/history");
    expect(cookieStore.set).toHaveBeenCalledWith(
      "ms-molar-post-auth",
      "",
      expect.objectContaining({ maxAge: 0, path: "/" })
    );
  });

  it("cookie bị sửa thành đích ngoài → /exams", async () => {
    storedCookie("//evil.example");
    expect(await callback("code=abc&next=/exams")).toBe("/exams");

    storedCookie("https://evil.example/exams");
    expect(await callback("code=abc&next=/exams")).toBe("/exams");
  });

  it("không có cookie → /exams (hành vi cũ)", async () => {
    storedCookie(undefined);
    expect(await callback("code=abc&next=/exams")).toBe("/exams");
  });

  it("link khôi phục mật khẩu: luôn /reset-password, bất kể cookie", async () => {
    storedCookie("/history");
    expect(await callback("code=abc&next=/reset-password")).toBe("/reset-password");
  });

  it("đổi mã thất bại → form đăng nhập, không đọc cookie", async () => {
    exchangeMock.mockResolvedValue({ data: { session: null }, error: { message: "expired" } });
    storedCookie("/history");

    expect(await callback("code=abc&next=/exams")).toBe("/?auth=signin");
  });
});
