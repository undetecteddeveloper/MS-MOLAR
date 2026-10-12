// Proxy cho khách vào các trang con — chỉ GET/HEAD (brief T1).
//
// Bất biến canh ở đây: mở trang cho khách xem KHÔNG được mở đường ghi. Server
// Action là POST tới chính URL trang, nên mỗi ca POST dưới đây phải vẫn bị đá
// về form đăng nhập. `PUBLIC_PATHS` (publicPaths.test.ts) cố ý không đổi.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let currentUser: { id: string } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: currentUser } }) },
  }),
}));

import { updateSession } from "../middleware";

function req(path: string, method = "GET") {
  return new NextRequest(`http://localhost:3000${path}`, { method });
}

async function redirectTarget(path: string, method = "GET"): Promise<string | null> {
  const res = await updateSession(req(path, method));
  const location = res.headers.get("location");
  return location ? new URL(location).pathname + new URL(location).search : null;
}

beforeEach(() => {
  currentUser = null;
});

describe("khách chưa đăng nhập — GET các trang được xem", () => {
  it.each(["/exams", "/exams/exam-toan-10", "/history", "/me/dashboard", "/upload", "/maxwell"])(
    "%s đi qua, không bị đá",
    async (path) => {
      expect(await redirectTarget(path)).toBeNull();
    }
  );

  it("HEAD cũng đi qua", async () => {
    expect(await redirectTarget("/exams", "HEAD")).toBeNull();
  });

  it("giữ nguyên query lọc của Kho đề", async () => {
    expect(await redirectTarget("/exams?subject=Math&page=2")).toBeNull();
  });
});

describe("khách chưa đăng nhập — vẫn bị đá về form đăng nhập", () => {
  it.each(["POST", "PUT", "PATCH", "DELETE"])("%s tới /upload (Server Action)", async (method) => {
    expect(await redirectTarget("/upload", method)).toBe("/?auth=signin");
  });

  it("POST tới /exams/{id} (nút Làm bài là Server Action)", async () => {
    expect(await redirectTarget("/exams/exam-toan-10", "POST")).toBe("/?auth=signin");
  });

  it("POST tới /maxwell (trang ẩn chỉ đọc, không có đường ghi)", async () => {
    expect(await redirectTarget("/maxwell", "POST")).toBe("/?auth=signin");
  });

  it.each([
    "/exams/exam-toan-10/attempt/abc",
    "/exams/exam-toan-10/rate",
    "/exams/exam-toan-10/solutions",
    "/exams/exam-toan-10/attempt/abc/result",
    "/me/exams",
    "/me/exams/abc",
    "/profile",
    "/admin",
    "/exams-evil",
    "/maxwell/extra",
    "/maxwell-evil",
  ])("GET %s", async (path) => {
    expect(await redirectTarget(path)).toBe("/?auth=signin");
  });
});

describe("người đã đăng nhập", () => {
  it("không đổi: POST và GET đều đi qua", async () => {
    currentUser = { id: "u1" };
    expect(await redirectTarget("/upload", "POST")).toBeNull();
    expect(await redirectTarget("/exams/exam-toan-10/attempt/abc")).toBeNull();
  });
});
