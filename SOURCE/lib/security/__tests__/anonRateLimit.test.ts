// Trần theo IP cho lưu lượng chưa đăng nhập (TECH-DEBT TD-013).
//
// Mock boundary: `rateLimitStore` — biên duy nhất chạm mạng. Mọi thứ khác chạy
// thật, gồm cả phép đọc header và phép nhận diện cookie, vì chính hai chỗ ấy là
// nơi một lỗi im lặng gỡ bỏ trần: một `x-forwarded-for` đọc sai đầu chuỗi cho
// kẻ gọi tự chọn khoá của mình, còn một phép khớp cookie sai tên cho MỌI request
// đi vòng qua trần.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hitSharedStore = vi.fn();
const isSharedStoreConfigured = vi.fn(() => true);

vi.mock("../rateLimitStore", () => ({
  hitSharedStore: (...args: unknown[]) => hitSharedStore(...args),
  isSharedStoreConfigured: () => isSharedStoreConfigured(),
}));

const { ANON_RATE_LIMIT, checkAnonRateLimit, clientIpFrom, isAnonymousRequest } = await import(
  "../anonRateLimit"
);

beforeEach(() => {
  hitSharedStore.mockReset();
  hitSharedStore.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
  isSharedStoreConfigured.mockReset();
  isSharedStoreConfigured.mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ═══════════════ 1. Địa chỉ client ═══════════════════════════════════════════

describe("clientIpFrom", () => {
  it("lấy mục ĐẦU TIÊN của x-forwarded-for, không phải cả chuỗi", () => {
    // Mục đầu là client gốc; các mục sau là proxy trên đường đi. Dùng cả chuỗi
    // làm khoá thì kẻ gọi chỉ cần tự thêm một địa chỉ vào đầu mỗi request là có
    // một bucket mới — trần biến mất mà không ai thấy.
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" });
    expect(clientIpFrom(headers)).toBe("203.0.113.7");
  });

  it("tụt về x-real-ip khi không có x-forwarded-for", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
  });

  it("KHÔNG có header nào ⇒ null, KHÔNG phải một chuỗi dự phòng", () => {
    // Một khoá `"unknown"` dùng chung sẽ gộp mọi request không có header vào
    // MỘT bucket; bucket ấy tự chạm trần rồi chặn những người chẳng liên quan
    // gì tới nhau. "Không biết" phải là không đếm.
    expect(clientIpFrom(new Headers())).toBeNull();
    expect(clientIpFrom(new Headers({ "x-forwarded-for": "   " }))).toBeNull();
  });
});

// ═══════════════ 2. Ai bị đếm ════════════════════════════════════════════════

describe("isAnonymousRequest", () => {
  it("không cookie nào ⇒ chưa đăng nhập", () => {
    expect(isAnonymousRequest([])).toBe(true);
  });

  it("cookie phiên Supabase ⇒ ĐÃ đăng nhập, bất kể project ref nào", () => {
    // Tên cookie chứa project ref và ref đổi theo môi trường, nên phép khớp
    // phải theo hình dạng chứ không theo một chuỗi cứng — viết cứng tên cookie
    // của dev là ghim prod vào một cái tên không bao giờ khớp.
    expect(isAnonymousRequest(["sb-hynwleaxtbtjzkvpjsug-auth-token"])).toBe(false);
    expect(isAnonymousRequest(["sb-pebjdlbgbmizgfpuptjl-auth-token"])).toBe(false);
  });

  it("cookie phiên bị CẮT MẢNH vẫn được nhận ra", () => {
    // `@supabase/ssr` cắt phiên lớn thành `...-auth-token.0`, `.1`. Một phép so
    // sánh BẰNG sẽ trượt hết, và mọi người dùng đăng nhập có phiên lớn sẽ bị
    // đếm như khách vãng lai — nhóm bị chặn nhầm đầu tiên là nhóm dùng nhiều
    // nhất.
    expect(isAnonymousRequest(["sb-abc-auth-token.0", "sb-abc-auth-token.1"])).toBe(false);
  });

  it("cookie KHÁC không làm request trông như đã đăng nhập", () => {
    expect(isAnonymousRequest(["locale", "sb-abc-code-verifier", "theme"])).toBe(true);
  });
});

// ═══════════════ 3. Quyết định ═══════════════════════════════════════════════

describe("checkAnonRateLimit", () => {
  it("đếm theo IP, với đúng trần đang khai", () => {
    return checkAnonRateLimit("203.0.113.7").then(() => {
      expect(hitSharedStore).toHaveBeenCalledTimes(1);
      expect(hitSharedStore).toHaveBeenCalledWith(
        "anon-ip:203.0.113.7",
        ANON_RATE_LIMIT.limit,
        ANON_RATE_LIMIT.windowMs
      );
    });
  });

  it("khoá mang tiền tố RIÊNG, không va vào bucket của `guard()`", async () => {
    // `guard()` khoá theo `${action}:${userId}`. Một IP trùng hình dạng với một
    // khoá action sẽ chia chung bucket nếu không có tiền tố — hai trần khác hẳn
    // nhau cùng trừ vào một bộ đếm.
    await checkAnonRateLimit("198.51.100.4");
    expect(String(hitSharedStore.mock.calls[0][0])).toMatch(/^anon-ip:/);
  });

  it("chuyển tiếp NGUYÊN VĂN lượt từ chối, kèm số giây chờ", async () => {
    hitSharedStore.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });
    await expect(checkAnonRateLimit("203.0.113.7")).resolves.toEqual({
      ok: false,
      retryAfterSeconds: 42,
    });
  });

  it("IP null ⇒ CHO ĐI, và không tốn lượt mạng nào", async () => {
    await expect(checkAnonRateLimit(null)).resolves.toEqual({ ok: true, retryAfterSeconds: 0 });
    expect(hitSharedStore).not.toHaveBeenCalled();
  });

  it("Redis CHƯA CẤU HÌNH ⇒ fail-OPEN, không gọi store", async () => {
    isSharedStoreConfigured.mockReturnValue(false);
    await expect(checkAnonRateLimit("203.0.113.7")).resolves.toEqual({
      ok: true,
      retryAfterSeconds: 0,
    });
    expect(hitSharedStore).not.toHaveBeenCalled();
  });

  it("Redis NÉM LỖI ⇒ fail-OPEN, không ném ra ngoài", async () => {
    // Fail-closed ở đây biến một sự cố Redis thành "mọi khách chưa đăng nhập
    // nhận 429" — tự tay gây ra đúng cái downtime mà TD-013 tồn tại để tránh.
    // Khác `quota.ts` (fail-CLOSED) vì chỗ đó canh tiền trả bên thứ ba, còn chỗ
    // này canh invocation của chính ta.
    hitSharedStore.mockRejectedValue(new Error("ECONNRESET"));
    await expect(checkAnonRateLimit("203.0.113.7")).resolves.toEqual({
      ok: true,
      retryAfterSeconds: 0,
    });
  });
});

// ═══════════════ 4. Hình dạng của chính con số ═══════════════════════════════

describe("ANON_RATE_LIMIT — trần nằm GIỮA hai bậc độ lớn", () => {
  it("cửa sổ tính bằng phút, không phải giờ", () => {
    // Một cửa sổ hàng giờ biến trần chống-flood thành một hạn mức duyệt web:
    // người thật sẽ chạm nó sau nửa buổi dùng bình thường, còn vòng lặp thì vẫn
    // kịp nện hết hạn mức trong phút đầu tiên.
    expect(ANON_RATE_LIMIT.windowMs).toBe(60_000);
  });

  it("trần đủ RỘNG cho một địa chỉ NAT đông người, đủ HẸP để chặn vòng lặp", () => {
    // Ghim hai bất đẳng thức chứ không ghim con số: sàn giữ cho một lần "siết
    // cho chắc" không biến thành chặn nhầm cả một phòng máy sau CGNAT; trần giữ
    // cho một lần "nới cho êm" không biến khối này thành đồ trang trí.
    expect(ANON_RATE_LIMIT.limit).toBeGreaterThanOrEqual(120);
    expect(ANON_RATE_LIMIT.limit).toBeLessThanOrEqual(600);
  });
});
