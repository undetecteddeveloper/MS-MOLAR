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
  it("uses per-action buckets, so hitting one action does not block another", () => {
    for (let i = 0; i < RATE_LIMITS.reportExam.limit; i += 1) {
      expect(guard("reportExam", "u1").ok).toBe(true);
    }
    expect(guard("reportExam", "u1").ok).toBe(false);
    expect(guard("submitExam", "u1").ok).toBe(true);
  });

  it("every configured limit is generous enough not to hit a real user", () => {
    // Guard chống vòng lặp tự động, không phải chống người dùng thật.
    for (const cfg of Object.values(RATE_LIMITS)) {
      expect(cfg.limit).toBeGreaterThanOrEqual(15);
      expect(cfg.windowMs).toBeGreaterThanOrEqual(60_000);
    }
  });
});
