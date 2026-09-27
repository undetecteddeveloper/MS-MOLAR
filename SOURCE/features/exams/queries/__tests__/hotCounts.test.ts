// Test cho `hotCounts.ts` — điểm gọi RPC `exam_hot_counts` DUY NHẤT + phép
// tính hai mốc cửa sổ thang "Nổi nhất" (task P3-T1, backend DD § Query layer
// "hotCounts.ts", ADR-0021 D4, Proof Obligations trong task file).
//
// Mock boundary: chỉ mock `.rpc(...)` của client Supabase (Proof Obligation
// "the window-computation half is pure and needs no mock") — `hotWindows` là
// hàm thuần, chạy thật, không mock. `readBounded`'s `.limit()` nội bộ chạy
// thật trên builder giả bên dưới, không mock riêng.
import { beforeEach, describe, expect, it, vi } from "vitest";

// hotCounts.ts (và mọi module features/exams/queries/*.ts) khai
// `import "server-only"` — cùng pattern stub mà rating.int.test.ts dùng.
vi.mock("server-only", () => ({}));

import { HOT_WINDOW_RECENT_DAYS, HOT_WINDOW_WIDE_DAYS } from "@/lib/adaptive/constants";
import { LIST_ROW_CEILING } from "@/lib/supabase/boundedRead";
import { hotWindows, readHotCounts } from "@/features/exams/queries/hotCounts";

/** Builder giả mô phỏng đúng hình dạng `PostgrestFilterBuilder` mà `readBounded`
 *  cần: chỉ một phương thức `.limit(count)`, awaitable, trả `{data, error}`. */
function createRpcBuilder(result: { data: unknown[] | null; error: { code?: string; message: string } | null }) {
  const limitCalls: number[] = [];
  return {
    limit(count: number) {
      limitCalls.push(count);
      return Promise.resolve(result);
    },
    limitCalls,
  };
}

describe("hotWindows", () => {
  it("computes sinceRecent/sinceWide as ISO strings HOT_WINDOW_RECENT_DAYS/HOT_WINDOW_WIDE_DAYS before a fixed now", () => {
    const now = new Date("2026-09-18T12:00:00.000Z");

    const result = hotWindows(now);

    // Giá trị kỳ vọng tính TAY, độc lập với cách implementation suy ra chúng:
    // 18/09 trừ 7 ngày = 11/09; 18/09 trừ 30 ngày = 19/08 (18/09 - 18 ngày =
    // 31/08, còn lại 12 ngày => 19/08).
    expect(result).toEqual({
      sinceRecent: "2026-09-11T12:00:00.000Z",
      sinceWide: "2026-08-19T12:00:00.000Z",
    });
  });

  it("derives both boundaries from the same now instant with no other clock read", () => {
    // Cùng một `now`, gọi hai lần liên tiếp phải cho CÙNG kết quả — nếu hàm
    // lỡ đọc `Date.now()`/`new Date()` không đối số ở đâu đó, hai lượt gọi
    // (giữa hai microtask) có thể lệch nhau.
    const now = new Date("2026-01-01T00:00:00.000Z");

    const first = hotWindows(now);
    const second = hotWindows(now);

    expect(first).toEqual(second);
  });
});

describe("readHotCounts", () => {
  const now = new Date("2026-09-18T12:00:00.000Z");
  let rpcMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rpcMock = vi.fn();
  });

  it('calls .rpc("exam_hot_counts", {...}) exactly once with p_max_rows = LIST_ROW_CEILING + 1 and the hotWindows(now) boundaries', async () => {
    const builder = createRpcBuilder({ data: [], error: null });
    rpcMock.mockReturnValue(builder);
    const supabase = { rpc: rpcMock } as unknown as Parameters<typeof readHotCounts>[0];

    await readHotCounts(supabase, "listExamShelves.hotCounts", now);

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("exam_hot_counts", {
      p_since_recent: "2026-09-11T12:00:00.000Z",
      p_since_wide: "2026-08-19T12:00:00.000Z",
      // Literal độc lập bằng đúng giá trị hôm nay của LIST_ROW_CEILING (500) + 1
      // — ghim CẢ HAI: giá trị đúng hôm nay VÀ việc nó phải bằng hằng số nhập,
      // không phải một literal tay rời rạc (Completion Criteria).
      p_max_rows: LIST_ROW_CEILING + 1,
    });
  });

  it("forwards the caller-supplied label straight into readBounded (visible via the console.error tripwire path)", async () => {
    // readBounded chỉ log khi CHẠM TRẦN — dựng đúng LIST_ROW_CEILING + 2 dòng
    // (dòng mồi + 1) để tripwire nổ, rồi đọc label ra từ console.error.
    const rows = Array.from({ length: LIST_ROW_CEILING + 2 }, (_, i) => ({
      exam_id: `exam-${i}`,
      recent_count: 1,
      wide_count: 1,
      total_count: 1,
    }));
    const builder = createRpcBuilder({ data: rows, error: null });
    rpcMock.mockReturnValue(builder);
    const supabase = { rpc: rpcMock } as unknown as Parameters<typeof readHotCounts>[0];
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await readHotCounts(supabase, "listExamShelves.hotCounts", now);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toContain("listExamShelves.hotCounts");
    errorSpy.mockRestore();
  });

  it("shapes RPC rows into a Map keyed by exam_id, coercing bigint-as-string counts to number", async () => {
    const builder = createRpcBuilder({
      data: [
        { exam_id: "exam-1", recent_count: "3", wide_count: "10", total_count: "20" },
        { exam_id: "exam-2", recent_count: 0, wide_count: 2, total_count: 5 },
      ],
      error: null,
    });
    rpcMock.mockReturnValue(builder);
    const supabase = { rpc: rpcMock } as unknown as Parameters<typeof readHotCounts>[0];

    const result = await readHotCounts(supabase, "listExamShelves.hotCounts", now);

    // Giá trị kỳ vọng là SỐ literal, khác kiểu dữ liệu (string) của mock cho
    // exam-1 — chứng minh phép ép kiểu thật sự chạy, không phải pass-through.
    expect(result).toEqual(
      new Map([
        ["exam-1", { recent: 3, wide: 10, total: 20 }],
        ["exam-2", { recent: 0, wide: 2, total: 5 }],
      ])
    );
  });

  it("falls back to 0 for a non-finite count field instead of propagating NaN/null", async () => {
    const builder = createRpcBuilder({
      data: [{ exam_id: "exam-1", recent_count: null, wide_count: "not-a-number", total_count: 7 }],
      error: null,
    });
    rpcMock.mockReturnValue(builder);
    const supabase = { rpc: rpcMock } as unknown as Parameters<typeof readHotCounts>[0];

    const result = await readHotCounts(supabase, "listExamShelves.hotCounts", now);

    expect(result).toEqual(new Map([["exam-1", { recent: 0, wide: 0, total: 7 }]]));
  });

  it("propagates a PostgREST infrastructure error thrown by readBounded instead of swallowing it", async () => {
    const infraError = { code: "500", message: "boom" };
    const builder = createRpcBuilder({ data: null, error: infraError });
    rpcMock.mockReturnValue(builder);
    const supabase = { rpc: rpcMock } as unknown as Parameters<typeof readHotCounts>[0];

    await expect(readHotCounts(supabase, "listExamShelves.hotCounts", now)).rejects.toBe(infraError);
  });
});

describe("imported constants sanity (Investigation Notes cross-check)", () => {
  it("HOT_WINDOW_RECENT_DAYS/HOT_WINDOW_WIDE_DAYS are imported from lib/adaptive/constants, not hand-copied", () => {
    // Ghim đúng con số PRD (AC-019/AC-020) — nếu ai đổi hằng số mà quên đổi ở
    // đây, test này đỏ chứ không lặng lẽ trôi lệch.
    expect(HOT_WINDOW_RECENT_DAYS).toBe(7);
    expect(HOT_WINDOW_WIDE_DAYS).toBe(30);
  });
});
