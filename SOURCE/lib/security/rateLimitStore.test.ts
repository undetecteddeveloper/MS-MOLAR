// Bộ đếm rate limit dùng chung (TECH-DEBT TD-008).
//
// Điều đáng kiểm nhất ở đây KHÔNG phải "Redis có đếm đúng không" — Redis đếm
// đúng, và test đó sẽ chỉ đang kiểm cái mock của chính mình. Đáng kiểm là HÀNH
// VI KHI REDIS KHÔNG TRẢ LỜI, vì đó là nhánh chạy đúng lúc tệ nhất và là nhánh
// dễ viết sai nhất: nuốt lỗi thành "ok" sẽ biến một sự cố Upstash thành việc
// lặng lẽ gỡ bỏ guard, và không ai phát hiện ra cho tới khi có người lợi dụng.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const evalMock = vi.fn();

vi.mock("@upstash/redis", () => ({
  Redis: class {
    eval = evalMock;
  },
}));

import { __resetRateLimitForTests, guard, RATE_LIMITS } from "./rateLimit";
import {
  __resetSharedStoreForTests,
  hitSharedStore,
  isSharedStoreConfigured,
} from "./rateLimitStore";

const ENV_KEYS = ["KV_REST_API_URL", "KV_REST_API_TOKEN"] as const;

function configureRedis(on: boolean) {
  for (const k of ENV_KEYS) {
    if (on) process.env[k] = k === "KV_REST_API_URL" ? "https://x.upstash.io" : "tok";
    else delete process.env[k];
  }
  __resetSharedStoreForTests();
}

beforeEach(() => {
  evalMock.mockReset();
  __resetRateLimitForTests();
  __resetSharedStoreForTests();
});

afterEach(() => configureRedis(false));

describe("isSharedStoreConfigured", () => {
  it("false khi thiếu env — bên gọi phải biết RAM là câu trả lời cuối, không phải cache", () => {
    configureRedis(false);
    expect(isSharedStoreConfigured()).toBe(false);
  });

  it("true khi có đủ URL + token", () => {
    configureRedis(true);
    expect(isSharedStoreConfigured()).toBe(true);
  });
});

describe("hitSharedStore", () => {
  it("dịch kết quả script thành ok khi còn suất", async () => {
    configureRedis(true);
    evalMock.mockResolvedValue([1, 0]);
    expect(await hitSharedStore("submitExam:u1", 30, 3_600_000)).toEqual({
      ok: true,
      retryAfterSeconds: 0,
    });
  });

  it("tính retryAfter từ mốc CŨ NHẤT còn trong cửa sổ", async () => {
    configureRedis(true);
    const now = Date.now();
    // Lần gọi cũ nhất cách đây 10 phút, cửa sổ 1 giờ → còn phải chờ 50 phút.
    evalMock.mockResolvedValue([0, now - 10 * 60_000]);
    const res = await hitSharedStore("submitExam:u1", 30, 3_600_000);
    expect(res.ok).toBe(false);
    expect(res.retryAfterSeconds).toBeGreaterThan(49 * 60);
    expect(res.retryAfterSeconds).toBeLessThanOrEqual(50 * 60 + 1);
  });

  it("retryAfter không bao giờ là 0 khi đã bị chặn", async () => {
    configureRedis(true);
    // Mốc cũ nhất vừa đúng lúc hết hạn → phép tính ra <= 0. Trả 0 giây sẽ khiến
    // client thử lại ngay lập tức trong một vòng lặp chặt.
    evalMock.mockResolvedValue([0, Date.now() - 3_600_000]);
    expect((await hitSharedStore("k", 30, 3_600_000)).retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("ném khi chưa cấu hình — KHÔNG âm thầm trả ok", async () => {
    configureRedis(false);
    await expect(hitSharedStore("k", 30, 1000)).rejects.toThrow();
  });

  it("mỗi lần gọi dùng member khác nhau, để 2 lần trong cùng mili giây không nuốt nhau", async () => {
    configureRedis(true);
    evalMock.mockResolvedValue([1, 0]);
    await hitSharedStore("k", 30, 1000);
    await hitSharedStore("k", 30, 1000);
    const [first, second] = evalMock.mock.calls.map((c) => (c[2] as unknown[])[3]);
    expect(first).not.toBe(second);
  });
});

describe("guard — hai lớp", () => {
  it("không gọi Redis khi lớp RAM đã chặn (lớp chặn sớm hoạt động)", async () => {
    configureRedis(true);
    evalMock.mockResolvedValue([1, 0]);

    for (let i = 0; i < RATE_LIMITS.reportExam.limit; i += 1) {
      await guard("reportExam", "u1");
    }
    const callsBefore = evalMock.mock.calls.length;

    const blocked = await guard("reportExam", "u1");
    expect(blocked.ok).toBe(false);
    expect(evalMock.mock.calls.length).toBe(callsBefore);
  });

  it("Redis có thẩm quyền: RAM cho qua nhưng Redis chặn thì kết quả là CHẶN", async () => {
    // Đây là toàn bộ lý do TD-008 tồn tại — instance này chưa thấy gì, nhưng
    // các instance khác đã dùng hết trần.
    configureRedis(true);
    evalMock.mockResolvedValue([0, Date.now() - 60_000]);
    expect((await guard("submitExam", "u-moi")).ok).toBe(false);
  });

  it("Redis hỏng → tụt về kết quả RAM, KHÔNG mở cổng", async () => {
    configureRedis(true);
    evalMock.mockRejectedValue(new Error("upstash down"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Vẫn còn suất trong RAM → cho qua (yếu đi, không biến mất).
    expect((await guard("reportExam", "u1")).ok).toBe(true);

    // Dùng hết trần RAM → vẫn chặn được, dù Redis vẫn đang chết.
    for (let i = 1; i < RATE_LIMITS.reportExam.limit; i += 1) {
      await guard("reportExam", "u1");
    }
    expect((await guard("reportExam", "u1")).ok).toBe(false);

    // Redis chết mà im lặng thì TD-008 quay lại y như cũ, chỉ khác là nay có
    // một file bảo rằng đã trả.
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("không cấu hình Redis → hành vi y hệt trước 2026-08-07, không log ồn", async () => {
    configureRedis(false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await guard("reportExam", "u1")).ok).toBe(true);
    expect(evalMock).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
