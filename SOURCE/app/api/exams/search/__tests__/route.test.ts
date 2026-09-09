// GET /api/exams/search — hợp đồng của vỏ route (ADR-0020). Mock ba biên: phiên
// (getCurrentUser), rate limit (guard), truy vấn (searchExamTitles). Chứng minh
// THỨ TỰ CHI PHÍ: khách bị chặn trước mọi thứ; từ khoá rỗng/ngắn trả [] mà không
// chạm rate limit lẫn DB; vượt trần trả 429 kèm Retry-After; RPC hỏng trả 500
// với mã lý do, không rò thân lỗi.

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/security/rateLimit", () => ({ guard: vi.fn() }));
vi.mock("@/features/exams/queries", () => ({ searchExamTitles: vi.fn() }));

import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { guard } from "@/lib/security/rateLimit";
import { searchExamTitles } from "@/features/exams/queries";
import { GET } from "../route";

const mockUser = vi.mocked(getCurrentUser);
const mockGuard = vi.mocked(guard);
const mockSearch = vi.mocked(searchExamTitles);

function request(q: string | null): Request {
  const url = new URL("http://localhost/api/exams/search");
  if (q !== null) url.searchParams.set("q", q);
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUser.mockResolvedValue({ id: "user-1" } as never);
  mockGuard.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  mockSearch.mockResolvedValue([]);
});

describe("GET /api/exams/search", () => {
  it("khách chưa đăng nhập → 401, không chạm rate limit lẫn DB", async () => {
    mockUser.mockResolvedValue(null as never);

    const res = await GET(request("toan"));

    expect(res.status).toBe(401);
    expect(mockGuard).not.toHaveBeenCalled();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("từ khoá rỗng hoặc quá ngắn sau chuẩn hoá → [] ngay, không tốn rate limit lẫn DB", async () => {
    for (const q of [null, "", "  ", "a", "!!!"]) {
      const res = await GET(request(q));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ items: [] });
    }
    expect(mockGuard).not.toHaveBeenCalled();
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("từ khoá hợp lệ → guard theo user rồi tìm với chuỗi ĐÃ chuẩn hoá, trả items", async () => {
    const hits = [{ id: "e1", title: "Đề Toán 10", subject: "Math", grade: 10 }];
    mockSearch.mockResolvedValue(hits);

    const res = await GET(request("  Toán 10 (giữa kì) "));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: hits });
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=30");
    expect(mockGuard).toHaveBeenCalledWith("searchExams", "user-1");
    expect(mockSearch).toHaveBeenCalledWith("toan 10 giua ki");
  });

  it("vượt trần → 429 kèm Retry-After, không gọi DB", async () => {
    mockGuard.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });

    const res = await GET(request("toan"));

    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("42");
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("RPC hỏng → 500 với mã lý do, không rò thân lỗi", async () => {
    mockSearch.mockRejectedValue(new Error("PGRST202 secret detail"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(request("toan"));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "search_failed" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
