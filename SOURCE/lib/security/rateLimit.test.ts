// rateLimit — unit tests (Security review 2026-08-03, Low).
// Dùng đồng hồ giả để kiểm hành vi cửa sổ trượt mà không phải chờ thật.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRateLimitForTests, checkRateLimit, guard, RATE_LIMITS } from "./rateLimit";

beforeEach(() => {
  __resetRateLimitForTests();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows calls up to the limit, then blocks", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(checkRateLimit("k", 3, 1000).ok).toBe(true);
    }
    expect(checkRateLimit("k", 3, 1000).ok).toBe(false);
  });

  it("keys are independent — one user's spam does not block another", () => {
    for (let i = 0; i < 3; i += 1) checkRateLimit("user-a", 3, 1000);
    expect(checkRateLimit("user-a", 3, 1000).ok).toBe(false);
    expect(checkRateLimit("user-b", 3, 1000).ok).toBe(true);
  });

  it("frees up as the window slides, not all at once at a fixed boundary", () => {
    checkRateLimit("k", 2, 1000); // t=0
    vi.advanceTimersByTime(600);
    checkRateLimit("k", 2, 1000); // t=600
    expect(checkRateLimit("k", 2, 1000).ok).toBe(false);

    // t=1001: only the t=0 call has left the window → exactly one slot back.
    vi.advanceTimersByTime(401);
    expect(checkRateLimit("k", 2, 1000).ok).toBe(true);
    expect(checkRateLimit("k", 2, 1000).ok).toBe(false);
  });

  it("reports a retryAfter that actually corresponds to a free slot", () => {
    checkRateLimit("k", 1, 10_000);
    const blocked = checkRateLimit("k", 1, 10_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    vi.advanceTimersByTime(blocked.retryAfterSeconds * 1000);
    expect(checkRateLimit("k", 1, 10_000).ok).toBe(true);
  });

  // Nếu lần gọi bị CHẶN cũng được ghi nhận, kẻ spam sẽ tự đẩy thời gian chờ dài
  // vô hạn — và người dùng thật bấm nhầm 2 lần cũng bị phạt theo.
  it("does not count blocked calls, so hammering cannot extend the penalty", () => {
    checkRateLimit("k", 1, 10_000);
    const first = checkRateLimit("k", 1, 10_000);
    vi.advanceTimersByTime(1000);
    for (let i = 0; i < 50; i += 1) checkRateLimit("k", 1, 10_000);
    const afterSpam = checkRateLimit("k", 1, 10_000);
    expect(afterSpam.retryAfterSeconds).toBeLessThanOrEqual(first.retryAfterSeconds);
  });
});

describe("guard", () => {
  // Không cấu hình KV_REST_API_* trong test → `guard` dừng ở lớp RAM. Đó đúng
  // là nhánh cần ghim ở đây: hành vi khi Redis vắng mặt phải y hệt trước
  // 2026-08-07, vì đó là lưới đỡ khi Upstash chết (xem rateLimitStore.ts).
  it("uses per-action buckets, so hitting one action does not block another", async () => {
    for (let i = 0; i < RATE_LIMITS.reportExam.limit; i += 1) {
      expect((await guard("reportExam", "u1")).ok).toBe(true);
    }
    expect((await guard("reportExam", "u1")).ok).toBe(false);
    expect((await guard("submitExam", "u1")).ok).toBe(true);
  });

  // HAI NHÓM TRẦN, vì có hai thứ KHÁC NHAU đang chặn chúng — không thể kiểm
  // bằng một bất biến chung:
  //   - Nhóm tốn DB của CHÍNH ta: thứ giới hạn chúng là chi phí của ta, mà ta
  //     tự nới được. Nên trần đặt rộng rãi và bất biến cần ghim là "đủ rộng để
  //     không làm phiền người dùng thật" — guard chống vòng lặp tự động thôi.
  //   - Nhóm tiêu hạn ngạch BÊN THỨ BA: thứ giới hạn chúng là hạn ngạch của nhà
  //     cung cấp, ta KHÔNG nới được. Trần vì thế phải chặt, và bất biến cần ghim
  //     ngược lại: nằm dưới trần nhà cung cấp, và cửa sổ trùng ĐƠN VỊ của hạn
  //     ngạch đó. Ghim cả windowMs vì hạ `limit` mà giữ cửa sổ theo giờ thì trần
  //     ngày không còn được đặt (xem lý lẽ đầy đủ ở RATE_LIMITS.explainStep).
  // Hai danh sách dưới đây liệt kê tường minh, không suy ra từ nhau: thêm action
  // mới vào RATE_LIMITS mà quên xếp nhóm sẽ làm case "phân loại" đỏ, thay vì
  // lọt qua cả hai nhánh mà không ai quyết định nó thuộc nhóm nào.
  const DB_COST_ACTIONS: readonly (keyof typeof RATE_LIMITS)[] = [
    "submitExam",
    "rateExam",
    "reportExam",
    "updateProfile",
    "submitTicket",
  ];
  const SUPPLIER_CAPPED_ACTIONS: readonly (keyof typeof RATE_LIMITS)[] = ["explainStep"];

  /** Trần free tier của Gemini: 20 request/NGÀY cho CẢ project (rateLimit.ts). */
  const SUPPLIER_DAILY_QUOTA = 20;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  it("classifies every configured action into exactly one category", () => {
    // Xếp trùng hai nhóm cũng đỏ ở đây: mảng gộp sẽ dài hơn danh sách khoá.
    const classified = [...DB_COST_ACTIONS, ...SUPPLIER_CAPPED_ACTIONS].sort();
    expect(classified).toEqual(Object.keys(RATE_LIMITS).sort());
  });

  it("keeps every DB-cost limit generous enough not to hit a real user", () => {
    for (const action of DB_COST_ACTIONS) {
      expect(RATE_LIMITS[action].limit).toBeGreaterThanOrEqual(15);
      expect(RATE_LIMITS[action].windowMs).toBeGreaterThanOrEqual(60_000);
    }
  });

  it("keeps every supplier-capped limit under the supplier quota, on its day unit", () => {
    for (const action of SUPPLIER_CAPPED_ACTIONS) {
      expect(RATE_LIMITS[action].windowMs).toBe(ONE_DAY_MS);
      expect(RATE_LIMITS[action].limit).toBeLessThanOrEqual(SUPPLIER_DAILY_QUOTA);
    }
  });
});
