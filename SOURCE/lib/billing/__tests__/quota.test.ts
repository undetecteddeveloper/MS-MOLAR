// Hạn mức theo gói, MỘT chỗ suy ra mốc bắt đầu kỳ, và đường GHI hai bộ đếm
// (backend DD I004 — plan Task 1.4 + 5.1).
//
// Điều đáng test ở đây không phải "hàm có trả số không", mà là một hình dạng
// hỏng IM LẶNG rất cụ thể: đường ĐỌC (readEntitlement — hiện `used`/`resetsAt`)
// và đường GHI (consumeQuota — INCR ở cổng) cùng ghép chuỗi khoá
// `quota:{kind}:{userId}:{periodStartEpoch}`. Nếu hai bên suy ra `periodStart`
// bằng hai phép tính khác nhau — lệch một phép làm tròn, hay một bên tính bằng
// giây còn bên kia bằng mili giây — thì màn hình báo "còn n lượt" trong khi
// cổng từ chối, và KHÔNG CÓ GÌ ĐỎ. Vì thế mọi kỳ vọng dưới đây là **số literal
// tính độc lập bằng `Date.UTC`**, không bao giờ đọc ngược từ implementation.
//
// Mốc `createdAt` cố ý đặt ở 09:17:33.123Z — tức 16:17:33.123 giờ Asia/Saigon
// (UTC+7), KHÔNG phải nửa đêm ở cả hai múi. Nhờ vậy epoch kỳ vọng mang theo
// phần giờ-phút-giây-ms, và mọi implementation cắt về mốc NGÀY (theo UTC hay
// theo giờ máy) đều lệch — ở bất kỳ múi giờ nào CI hay máy dev đang chạy.
//
// Với `consumeQuota()` có thêm ba thứ mà một assertion trên GIÁ TRỊ TRẢ VỀ
// không phân biệt được, nên chúng được kiểm bằng NHẬT KÝ LỜI GỌI Redis:
//   1. HAI BỘ ĐẾM, HAI ĐƠN VỊ (AC-020). `quota:…` +1 mỗi thao tác người dùng;
//      `ai:budget:…` +`geminiCalls`. Một implementation cộng `geminiCalls` vào
//      cả hai khoá vẫn trả `{ok:true}` y hệt — chỉ delta mới tố cáo nó.
//   2. ĐẶT CHỖ, KHÔNG PHẢI TÍCH TỪNG LƯỢT. Ngân sách phải nhích bằng ĐÚNG MỘT
//      lệnh `INCRBY n`, không phải n lệnh `INCR` — ba lệnh rời cho phép một lời
//      từ chối rơi vào giữa `Promise.all` của pipeline upload.
//   3. KHÔNG THỪA KẾ LỚP RAM của rateLimit.ts. Redis chết ⇒ TỪ CHỐI, và bộ đếm
//      trong RAM của một instance không bao giờ chặn được ngân sách toàn dự án.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// `quota.ts` khai `import "server-only"` kể từ khi `consumeQuota()` chạm Redis
// và Supabase — module đó NÉM khi được nạp ngoài bundle server của Next. Stub
// theo lối 14 file test khác trong repo (vd readEntitlement.test.ts:34).
vi.mock("server-only", () => ({}));

// ──────────────────────────── Biên I/O được mock ─────────────────────────────
// ĐÚNG hai biên: Upstash và Supabase. `periodStartEpoch()`, `quotaKey()`,
// `PLAN_LIMITS` và toàn bộ `readEntitlement()` chạy THẬT — chúng chính là thứ
// đang được kiểm, và mock một module nội bộ ở đây là kiểm chính cái mock.
//
// Redis giả CÓ TRẠNG THÁI (một Map) chứ không phải một hàm trả sẵn: các ca dưới
// đây khẳng định DELTA THẬT của từng khoá (before → after) và THỨ TỰ lời gọi,
// hai thứ mà `mockResolvedValue` không dựng lại được.

const { redis, createClientMock } = vi.hoisted(() => {
  const state = {
    store: new Map<string, number>(),
    calls: [] as Array<[string, ...unknown[]]>,
    down: false,
  };
  const log = (name: string, args: unknown[]) => {
    state.calls.push([name, ...args]);
    // Ghi nhật ký TRƯỚC khi ném: một ca "Redis chết" vẫn phải chứng minh được
    // lệnh nào đã được THỬ phát đi.
    if (state.down) throw new Error("Upstash không trả lời");
  };
  const bump = (key: string, by: number) => {
    const next = (state.store.get(key) ?? 0) + by;
    state.store.set(key, next);
    return next;
  };
  return {
    redis: {
      state,
      async incr(key: string) {
        log("incr", [key]);
        return bump(key, 1);
      },
      async incrby(key: string, by: number) {
        log("incrby", [key, by]);
        return bump(key, by);
      },
      async decr(key: string) {
        log("decr", [key]);
        return bump(key, -1);
      },
      async decrby(key: string, by: number) {
        log("decrby", [key, by]);
        return bump(key, -by);
      },
      async expire(key: string, seconds: number) {
        log("expire", [key, seconds]);
        return 1;
      },
      async pexpire(key: string, ms: number) {
        log("pexpire", [key, ms]);
        return 1;
      },
      async mget(...keys: string[]) {
        log("mget", keys);
        return keys.map((k) => state.store.get(k) ?? null);
      },
    },
    createClientMock: vi.fn(),
  };
});

vi.mock("@upstash/redis", () => ({
  Redis: class {
    incr = redis.incr;
    incrby = redis.incrby;
    decr = redis.decr;
    decrby = redis.decrby;
    expire = redis.expire;
    pexpire = redis.pexpire;
    mget = redis.mget;
  },
}));

vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));

import { PLAN_LIMITS, consumeQuota, periodStartEpoch } from "../quota";
import { readEntitlement } from "../readEntitlement";
import type { Entitlement, Plan, Quota } from "../types";
import * as frozenTypes from "../types";

/** 30 ngày, viết lại ở test bằng số học tường minh chứ không import từ module
 *  đang được test — một hằng đi chung với implementation thì không kiểm được
 *  implementation. */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 2_592_000_000

/** `user_profiles.created_at` của người dùng Free. 2026-01-15T09:17:33.123Z. */
const CREATED_AT_MS = Date.UTC(2026, 0, 15, 9, 17, 33, 123); // 1768468653123
/** `subscriptions.period_anchor_at`. 2026-03-03T14:45:10.500Z. */
const ANCHOR_MS = Date.UTC(2026, 2, 3, 14, 45, 10, 500); // 1772549110500

const daysAfterCreation = (days: number) =>
  new Date(CREATED_AT_MS + Math.round(days * 24 * 60 * 60 * 1000));
describe("PLAN_LIMITS", () => {
  it("đúng bốn con số của PRD R5/D5 và R6/D7", () => {
    expect(PLAN_LIMITS).toEqual({
      free: { tutor: 5, upload: 3 },
      premium: { tutor: 500, upload: 15 },
    });
  });

  it("KHÔNG nằm trong types.ts — hợp đồng đó đóng băng (DD I012)", () => {
    // Ca này đỏ đúng vào lúc có người "gom cho gọn" bảng hạn mức vào
    // types.ts. Đổi types.ts thì phải sửa UI Spec trước, nên nó không được
    // phép xảy ra lặng lẽ trong một commit backend.
    expect(Object.keys(frozenTypes)).not.toContain("PLAN_LIMITS");
  });
});

describe("periodStartEpoch — Free: created_at + 30d × floor((now − created_at)/30d)", () => {
  it.each([
    ["ngày 0 (vừa tạo tài khoản)", 0, 1768468653123],
    ["ngày 15 — floor = 0, KHÔNG phải ceil", 15, 1768468653123],
    ["ngày 29 — floor = 0, KHÔNG phải round", 29, 1768468653123],
    ["ngày 29,999 — vẫn kỳ cũ", 29.999, 1768468653123],
    ["ngày 30 chẵn — biên: kỳ MỚI bắt đầu đúng tại đây", 30, 1771060653123],
    ["ngày 31 — vẫn kỳ thứ hai", 31, 1771060653123],
    ["ngày 61 — kỳ thứ ba", 61, 1773652653123],
  ])("%s", (_label, days, expected) => {
    expect(periodStartEpoch("free", null, new Date(CREATED_AT_MS), daysAfterCreation(days))).toBe(
      expected
    );
  });

  it("kỳ mới bắt đầu ĐÚNG tại mili giây thứ 2_592_000_000 — không sớm hơn một mili giây nào", () => {
    // Ca 29,999 ngày ở trên còn cách biên 86,4 GIÂY, nên nó KHÔNG phân biệt
    // được một implementation cấp kỳ mới sớm vài mili giây. Hai lời gọi dưới
    // đây kẹp đúng biên: mili giây CUỐI của kỳ cũ và mili giây ĐẦU của kỳ mới.
    // Cả hai kỳ vọng là literal, nên một biên bị dịch đi dù chỉ 1 ms là đỏ.
    const lastMsOfFirstPeriod = new Date(CREATED_AT_MS + THIRTY_DAYS_MS - 1);
    const firstMsOfSecondPeriod = new Date(CREATED_AT_MS + THIRTY_DAYS_MS);

    expect(
      periodStartEpoch("free", null, new Date(CREATED_AT_MS), lastMsOfFirstPeriod)
    ).toBe(1768468653123);
    expect(
      periodStartEpoch("free", null, new Date(CREATED_AT_MS), firstMsOfSecondPeriod)
    ).toBe(1771060653123);
  });

  it("trả MILI giây, không phải giây — hai đầu khoá không được quy đổi", () => {
    // 1768468653123 (ms) và 1768468653 (s) là hai khoá khác nhau; một bên đọc
    // theo giây còn bên kia theo ms là đúng lỗi I004 mô tả, và nó im lặng.
    const epoch = periodStartEpoch(
      "free",
      null,
      new Date(CREATED_AT_MS),
      daysAfterCreation(15)
    );
    expect(epoch).toBe(new Date(CREATED_AT_MS).getTime());
    expect(Number.isInteger(epoch)).toBe(true);
  });

  it("mốc kỳ luôn cách created_at đúng một bội của 30 ngày", () => {
    for (const days of [0, 15, 29, 30, 31, 61, 120]) {
      const epoch = periodStartEpoch("free", null, new Date(CREATED_AT_MS), daysAfterCreation(days));
      expect((epoch - CREATED_AT_MS) % THIRTY_DAYS_MS, `ngày ${days}`).toBe(0);
    }
  });

  it("BỎ QUA anchor khi gói là free — anchor của một thuê bao đã hết hạn không được kéo mốc kỳ", () => {
    expect(
      periodStartEpoch("free", new Date(ANCHOR_MS), new Date(CREATED_AT_MS), daysAfterCreation(31))
    ).toBe(1771060653123);
  });
});

describe("periodStartEpoch — Premium: đúng period_anchor_at", () => {
  it("trả thẳng anchor, không cộng thêm kỳ nào", () => {
    expect(
      periodStartEpoch("premium", new Date(ANCHOR_MS), new Date(CREATED_AT_MS), new Date(ANCHOR_MS + 5 * 86_400_000))
    ).toBe(1772549110500);
  });

  it("BỎ QUA created_at — người mua Premium không quay về lịch kỳ của ngày đăng ký", () => {
    const withOtherCreatedAt = periodStartEpoch(
      "premium",
      new Date(ANCHOR_MS),
      new Date(Date.UTC(2024, 5, 1, 3, 4, 5, 6)),
      new Date(ANCHOR_MS + 5 * 86_400_000)
    );
    expect(withOtherCreatedAt).toBe(1772549110500);
  });

  it("premium mà thiếu anchor là dữ liệu sai — ném lỗi chứ không âm thầm rơi về công thức Free", () => {
    // `subscriptions.period_anchor_at` là `not null` (schema.sql:1689), nên ca
    // này chỉ tới được bằng dữ liệu hỏng. Rơi lặng lẽ về công thức Free sẽ đẻ
    // ra một khoá THỨ HAI cho cùng một người — đúng thứ hàm này tồn tại để
    // chặn.
    expect(() =>
      periodStartEpoch("premium", null, new Date(CREATED_AT_MS), daysAfterCreation(31))
    ).toThrow();
  });
});

describe("periodStartEpoch — ân hạn cho QUYỀN, không bao giờ cho HẠN MỨC (AC-011)", () => {
  // expires_at = anchor + 30 ngày; ân hạn kéo dài 3 ngày sau đó (PRD D8/R4).
  const EXPIRES_AT_MS = ANCHOR_MS + THIRTY_DAYS_MS; // 1775141110500

  it("giá trị TRƯỚC và SAU mốc hết hạn là MỘT — bộ đếm vẫn tính vào kỳ cũ", () => {
    const beforeExpiry = periodStartEpoch(
      "premium",
      new Date(ANCHOR_MS),
      new Date(CREATED_AT_MS),
      new Date(EXPIRES_AT_MS - 1000)
    );
    const insideGrace = periodStartEpoch(
      "premium",
      new Date(ANCHOR_MS),
      new Date(CREATED_AT_MS),
      new Date(EXPIRES_AT_MS + 86_400_000)
    );

    // Cả hai là literal 1772549110500, không phải "bằng nhau" suông: một
    // implementation trả cùng một giá trị SAI ở cả hai lần gọi vẫn phải đỏ.
    expect(beforeExpiry).toBe(1772549110500);
    expect(insideGrace).toBe(1772549110500);
    expect(insideGrace).toBe(beforeExpiry);
  });

  it("cuối ân hạn (hết hạn + 3 ngày) vẫn chưa cấp mốc kỳ mới", () => {
    expect(
      periodStartEpoch(
        "premium",
        new Date(ANCHOR_MS),
        new Date(CREATED_AT_MS),
        new Date(EXPIRES_AT_MS + 3 * 86_400_000)
      )
    ).toBe(1772549110500);
  });
});

// ════════════════════ consumeQuota — đường GHI (plan Task 5.1) ════════════════

const USER_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

/** Kỳ CHỨA `BUDGET_NOW_MS` của người dùng Free tạo lúc `CREATED_AT_MS`:
 *  `1768468653123 + 1 × 2_592_000_000`. Tính tay ở đây, không gọi
 *  `periodStartEpoch()` — một kỳ vọng dựng bằng chính hàm đang được kiểm thì
 *  hàm đó sai kiểu gì nó cũng xanh. */
const PERIOD_START = 1771060653123;
/** `PERIOD_START + 30 ngày` = 1773652653123. Đây là `resetsAt` mà đường ĐỌC
 *  dựng, và là thứ đường GHI suy NGƯỢC lại để ra đúng `PERIOD_START`. */
const RESETS_AT = "2026-03-16T09:17:33.123Z";
/** Kỳ KẾ TIẾP — dùng để hai trường cùng kiểu trong một `Entitlement` mang hai
 *  giá trị KHÁC NHAU, nên một implementation đọc nhầm loại thao tác là đỏ. */
const NEXT_RESETS_AT = "2026-04-15T09:17:33.123Z"; // ⇒ periodStart 1773652653123

const TUTOR_KEY = `quota:tutor:${USER_ID}:${PERIOD_START}`;
const UPLOAD_KEY = `quota:upload:${USER_ID}:${PERIOD_START}`;

/** 2026-03-01T05:30:00.000Z. CỐ Ý là một instant có NGÀY LỊCH khác nhau giữa
 *  các múi giờ đang tham gia: `2026-03-01` theo UTC (Vercel chạy UTC) và cũng
 *  `2026-03-01` theo Asia/Saigon (máy dev + CI của repo này), nhưng
 *  `2026-02-28` theo America/Los_Angeles — lệch cả THÁNG. Một implementation
 *  cắt ngày bằng `toISOString().slice(0,10)` hay bằng giờ máy đều ra một chuỗi
 *  khác literal dưới đây. */
const BUDGET_NOW_MS = Date.UTC(2026, 2, 1, 5, 30); // 1772343000000
const BUDGET_KEY = "ai:budget:2026-02-28";

/** `PERIOD_START + 30 ngày + 1 ngày dôi − BUDGET_NOW_MS`, tính tay:
 *  1771060653123 + 2592000000 + 86400000 − 1772343000000. */
const QUOTA_TTL_MS = 1396053123;
/** 26 giờ, tính bằng GIÂY. */
const BUDGET_TTL_S = 93600;

const at = (key: string) => redis.state.store.get(key) ?? 0;
const callNames = () => redis.state.calls.map(([name]) => name);
const quotaKeysTouched = () =>
  [...redis.state.store.keys()].filter((k) => k.startsWith("quota:"));

/**
 * `Entitlement` với hạn mức ở trạng thái `known`.
 *
 * `used`/`limit` cố ý ĐIÊN RỒ (đã dùng 999 trên trần 1): mọi ca "được phục vụ"
 * dưới đây vì thế cũng là bằng chứng rằng `consumeQuota()` cưỡng chế bằng BỘ
 * ĐẾM REDIS + `PLAN_LIMITS`, chứ không bằng con số đã cũ mà trang web dựng ra
 * lúc render. Chỉ `resetsAt` là dữ liệu thật được dùng tới.
 */
function knownEnt(plan: Plan, resetsAt: string, uploadResetsAt = resetsAt): Entitlement {
  const seed = (rs: string): Quota => ({ state: "known", used: 999, limit: 1, resetsAt: rs });
  return {
    plan,
    expiresAt: plan === "premium" ? "2026-04-02T14:45:10.500Z" : null,
    inGracePeriod: false,
    tutor: seed(resetsAt),
    upload: seed(uploadResetsAt),
  };
}

function unknownEnt(plan: Plan): Entitlement {
  return {
    plan,
    expiresAt: plan === "premium" ? "2026-04-02T14:45:10.500Z" : null,
    inGracePeriod: false,
    tutor: { state: "unknown" },
    upload: { state: "unknown" },
  };
}

// ─────────────────────── Supabase: chỉ nhánh `unknown` chạm ───────────────────

type PgError = { code: string } | null;
const writeSpy = vi.fn();
let subRow: { expires_at: string; period_anchor_at: string } | null = null;
let subError: PgError = null;
let profileRow: { created_at: string } | null = null;
let profileError: PgError = null;
let supabaseThrows = false;

function tableStub(result: { data: unknown; error: PgError }) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    insert: writeSpy,
    update: writeSpy,
    upsert: writeSpy,
    delete: writeSpy,
  };
  return builder;
}

const fromSpy = vi.fn((table: string) => {
  if (table === "subscriptions") return tableStub({ data: subRow, error: subError });
  if (table === "user_profiles") return tableStub({ data: profileRow, error: profileError });
  throw new Error(`consumeQuota đọc bảng ngoài dự kiến: ${table}`);
});

let warnSpy: { mockRestore: () => void };

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(BUDGET_NOW_MS));
  redis.state.store.clear();
  redis.state.calls.length = 0;
  redis.state.down = false;
  createClientMock.mockReset();
  createClientMock.mockImplementation(async () => {
    if (supabaseThrows) throw new Error("Supabase không kết nối được");
    return { from: fromSpy, rpc: writeSpy };
  });
  fromSpy.mockClear();
  writeSpy.mockClear();
  subRow = null;
  subError = null;
  profileRow = { created_at: "2026-01-15T09:17:33.123Z" };
  profileError = null;
  supabaseThrows = false;
  vi.stubEnv("KV_REST_API_URL", "https://x.upstash.io");
  vi.stubEnv("KV_REST_API_TOKEN", "tok");
  vi.stubEnv("AI_BUDGET_DAILY_LIMIT", "20");
  vi.stubEnv("AI_BUDGET_FREE_SHARE", "");
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  warnSpy.mockRestore();
});

// ═════════════════════════════════════════════════════════════════════════════

describe("consumeQuota — hai bộ đếm, hai ĐƠN VỊ (AC-020, DD I004)", () => {
  it("gia sư: khoá kỳ +1 và ngân sách +1", async () => {
    const before = { user: at(TUTOR_KEY), budget: at(BUDGET_KEY) };

    const result = await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1);

    expect(result).toEqual({ ok: true });
    expect(at(TUTOR_KEY) - before.user).toBe(1);
    expect(at(BUDGET_KEY) - before.budget).toBe(1);
  });

  it("upload `automatic` (3 request): khoá kỳ +1, ngân sách +3", async () => {
    // Đây là ca chính của I004. Một implementation cộng `geminiCalls` vào CẢ
    // HAI khoá vẫn trả `{ok:true}` y hệt, và tiêu 3 suất upload của người dùng
    // cho MỘT lượt upload. Một implementation cộng 1 vào cả hai thì under-count
    // ngân sách nhà cung cấp 3×. Cả hai đều im lặng; chỉ hai delta LITERAL
    // KHÁC NHAU mới loại được cả hai.
    const before = { user: at(UPLOAD_KEY), budget: at(BUDGET_KEY) };

    const result = await consumeQuota("upload", USER_ID, knownEnt("free", RESETS_AT), 3);

    expect(result).toEqual({ ok: true });
    expect(at(UPLOAD_KEY) - before.user).toBe(1);
    expect(at(BUDGET_KEY) - before.budget).toBe(3);
  });

  it("upload chế độ còn lại (2 request): khoá kỳ VẪN +1, ngân sách +2", async () => {
    const before = { user: at(UPLOAD_KEY), budget: at(BUDGET_KEY) };

    const result = await consumeQuota("upload", USER_ID, knownEnt("free", RESETS_AT), 2);

    expect(result).toEqual({ ok: true });
    expect(at(UPLOAD_KEY) - before.user).toBe(1);
    expect(at(BUDGET_KEY) - before.budget).toBe(2);
  });

  it("ĐẶT CHỖ: đúng MỘT lệnh INCRBY n, không phải n lệnh INCR — và đúng thứ tự này", async () => {
    // "Đặt chỗ trước khi phát request" KHÔNG chứng minh được bằng giá trị trả
    // về: `{ok:true}` giống hệt nhau ở mọi cách cài đặt. Nó chỉ chứng minh được
    // bằng SỐ LỜI GỌI và THỨ TỰ trên client Redis. Ba lệnh INCR rời cho phép
    // một lời từ chối rơi vào GIỮA `Promise.all` của pipeline upload, bỏ lại
    // một lượt bóc đề dở dang đã tiêu cả tiền nhà cung cấp lẫn suất người dùng.
    await consumeQuota("upload", USER_ID, knownEnt("free", RESETS_AT), 3);

    expect(redis.state.calls).toEqual([
      ["incr", UPLOAD_KEY],
      ["pexpire", UPLOAD_KEY, QUOTA_TTL_MS],
      ["incrby", BUDGET_KEY, 3],
      ["expire", BUDGET_KEY, BUDGET_TTL_S],
    ]);
  });

  it("dùng `resetsAt` của ĐÚNG loại thao tác, không phải của loại kia", async () => {
    // Hai trường cùng kiểu trong một object là chỗ dễ đọc nhầm nhất, và đọc
    // nhầm thì khoá vẫn đúng HÌNH DẠNG nên không có gì đỏ. Vì thế hai giá trị
    // ở đây KHÁC NHAU, cách nhau đúng một kỳ.
    await consumeQuota("upload", USER_ID, knownEnt("free", NEXT_RESETS_AT, RESETS_AT), 2);

    expect(quotaKeysTouched()).toEqual([UPLOAD_KEY]);
  });
});

describe("consumeQuota — khoá ngân sách là ngày lịch America/Los_Angeles", () => {
  it("dựng `ai:budget:2026-02-28` tại instant mà UTC lẫn giờ máy đều đang là 2026-03-01", async () => {
    await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1);

    const budgetKeys = [...redis.state.store.keys()].filter((k) => k.startsWith("ai:budget:"));
    expect(budgetKeys).toEqual([BUDGET_KEY]);
    expect(at(BUDGET_KEY)).toBe(1);
  });

  it("TTL 26 giờ trên khoá ngân sách, tính bằng GIÂY", async () => {
    await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1);

    expect(redis.state.calls).toContainEqual(["expire", BUDGET_KEY, 93600]);
  });
});

describe("consumeQuota — đường ĐỌC và đường GHI ghép RA CÙNG MỘT CHUỖI (I004)", () => {
  /** Chạy `readEntitlement()` THẬT tại `nowMs` và trả về khoá nó đọc + chính
   *  `Entitlement` nó dựng ra (đúng thứ production truyền cho `consumeQuota`). */
  async function readPath(nowMs: number): Promise<{ key: string; ent: Entitlement }> {
    vi.setSystemTime(new Date(nowMs));
    redis.state.calls.length = 0;
    const ent = await readEntitlement(USER_ID);
    const mget = redis.state.calls.find(([name]) => name === "mget");
    return { key: mget?.[1] as string, ent };
  }

  /**
   * Ba chuỗi phải bằng ĐÚNG một literal viết tay: khoá đường ĐỌC, khoá đường
   * GHI nhánh `known`, và khoá đường GHI nhánh `unknown`.
   *
   * So hai bên với NHAU thôi thì không đủ — hai đường cùng sai một kiểu vẫn
   * xanh. Và dựng kỳ vọng bằng `quotaKey()`/`periodStartEpoch()`, đúng hai hàm
   * mà cả hai phía đang gọi, thì kỳ vọng trôi theo implementation: nó không
   * chứng minh gì cả.
   */
  async function expectByteIdenticalKey(nowMs: number, expected: string) {
    const { key: readKey, ent } = await readPath(nowMs);
    expect(readKey, "đường ĐỌC (readEntitlement → mget)").toBe(expected);

    redis.state.calls.length = 0;
    await consumeQuota("tutor", USER_ID, ent, 1);
    expect(redis.state.calls[0], "đường GHI, nhánh known (suy ngược từ resetsAt)").toEqual([
      "incr",
      expected,
    ]);

    redis.state.calls.length = 0;
    await consumeQuota("tutor", USER_ID, unknownEnt(ent.plan), 1);
    expect(redis.state.calls[0], "đường GHI, nhánh unknown (periodStartEpoch trực tiếp)").toEqual([
      "incr",
      expected,
    ]);
  }

  it("premium có period_anchor_at", async () => {
    subRow = {
      expires_at: "2026-04-02T14:45:10.500Z",
      period_anchor_at: "2026-03-03T14:45:10.500Z",
    };
    await expectByteIdenticalKey(
      ANCHOR_MS + 5 * 86_400_000,
      `quota:tutor:${USER_ID}:1772549110500`
    );
  });

  it("free ngày 15 kể từ khi tạo tài khoản", async () => {
    await expectByteIdenticalKey(
      CREATED_AT_MS + 15 * 86_400_000,
      `quota:tutor:${USER_ID}:1768468653123`
    );
  });

  it("free ngày 29 — floor, không phải round", async () => {
    await expectByteIdenticalKey(
      CREATED_AT_MS + 29 * 86_400_000,
      `quota:tutor:${USER_ID}:1768468653123`
    );
  });

  it("free ngày 31 — kỳ thứ hai", async () => {
    await expectByteIdenticalKey(
      CREATED_AT_MS + 31 * 86_400_000,
      `quota:tutor:${USER_ID}:1771060653123`
    );
  });

  it("trong ÂN HẠN: khoá KHÔNG ĐỔI so với trước mốc hết hạn (AC-011)", async () => {
    // Ân hạn cấp QUYỀN chứ không cấp HẠN MỨC. Một implementation "tử tế" đẩy
    // mốc kỳ khi hết hạn sẽ tặng không một kỳ hạn mức đầy — và người bước vào
    // ân hạn với 0 lượt còn lại sẽ được phục vụ thay vì bị từ chối.
    subRow = {
      expires_at: "2026-04-02T14:45:10.500Z",
      period_anchor_at: "2026-03-03T14:45:10.500Z",
    };
    await expectByteIdenticalKey(
      ANCHOR_MS + THIRTY_DAYS_MS + 86_400_000,
      `quota:tutor:${USER_ID}:1772549110500`
    );
  });
});

describe("consumeQuota — `unknown` là trạng thái HIỂN THỊ, không bao giờ là trạng thái KHOÁ", () => {
  it("KHÔNG rơi về khoá trần `quota:{kind}:{userId}`", async () => {
    // Khoá trần chia đôi bộ đếm của MỘT kỳ và phát cho người dùng một suất mới
    // sau mỗi lần Redis chớp — một lỗ rò capacity đã trả tiền, và im lặng.
    await consumeQuota("tutor", USER_ID, unknownEnt("free"), 1);

    expect(quotaKeysTouched()).toEqual([TUTOR_KEY]);
  });

  it("suy mốc kỳ bằng `periodStartEpoch()` từ anchor + created_at (premium)", async () => {
    subRow = {
      expires_at: "2026-04-02T14:45:10.500Z",
      period_anchor_at: "2026-03-03T14:45:10.500Z",
    };

    await consumeQuota("tutor", USER_ID, unknownEnt("premium"), 1);

    expect(quotaKeysTouched()).toEqual([`quota:tutor:${USER_ID}:1772549110500`]);
  });

  it("Supabase hỏng ⇒ `unavailable`, và KHÔNG bộ đếm nào bị chạm", async () => {
    supabaseThrows = true;

    const result = await consumeQuota("tutor", USER_ID, unknownEnt("free"), 1);

    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(redis.state.calls).toEqual([]);
    expect([...redis.state.store.keys()]).toEqual([]);
  });

  it("premium mà thiếu anchor (dữ liệu hỏng) ⇒ `unavailable`, không đoán một mốc kỳ", async () => {
    subRow = null;

    const result = await consumeQuota("tutor", USER_ID, unknownEnt("premium"), 1);

    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(redis.state.calls).toEqual([]);
  });

  it("nhánh `known` KHÔNG đọc Supabase — mốc kỳ suy ngược từ `resetsAt`", async () => {
    await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1);

    expect(createClientMock).not.toHaveBeenCalled();
  });
});

describe("consumeQuota — hạn mức người dùng (AC-014)", () => {
  it("free/tutor: lượt thứ 5 được phục vụ, lượt thứ 6 bị từ chối `user_quota`", async () => {
    redis.state.store.set(TUTOR_KEY, 4);
    expect(await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1)).toEqual({
      ok: true,
    });
    expect(at(TUTOR_KEY)).toBe(5);

    redis.state.calls.length = 0;
    const sixth = await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1);

    expect(sixth).toEqual({ ok: false, reason: "user_quota" });
    // Bị từ chối thì KHÔNG được mất suất: bộ đếm phải trở về đúng 5.
    expect(at(TUTOR_KEY)).toBe(5);
    // Và tuyệt đối không chạm ngân sách dự án — không request nào được phát.
    // Literal 1 là phần lượt thứ 5 (được phục vụ) đã đặt chỗ; lượt thứ 6 phải
    // cộng thêm ĐÚNG 0 vào đó.
    expect(callNames()).not.toContain("incrby");
    expect(at(BUDGET_KEY)).toBe(1);
  });

  it("free/upload: trần là 3 của ĐÚNG loại upload, không phải 5 của tutor", async () => {
    redis.state.store.set(UPLOAD_KEY, 3);
    // Bộ đếm tutor cố ý để 0: một implementation đọc nhầm khoá hay nhầm trần
    // sẽ phục vụ lượt này.
    redis.state.store.set(TUTOR_KEY, 0);

    const result = await consumeQuota("upload", USER_ID, knownEnt("free", RESETS_AT), 2);

    expect(result).toEqual({ ok: false, reason: "user_quota" });
    expect(at(UPLOAD_KEY)).toBe(3);
  });

  it("premium/tutor: trần 500 — lượt 500 phục vụ, lượt 501 từ chối", async () => {
    redis.state.store.set(TUTOR_KEY, 499);
    expect(await consumeQuota("tutor", USER_ID, knownEnt("premium", RESETS_AT), 1)).toEqual({
      ok: true,
    });

    const over = await consumeQuota("tutor", USER_ID, knownEnt("premium", RESETS_AT), 1);
    expect(over).toEqual({ ok: false, reason: "user_quota" });
    expect(at(TUTOR_KEY)).toBe(500);
  });
});

describe("consumeQuota — ngân sách dự án và AI_BUDGET_FREE_SHARE (AC-023)", () => {
  it("trần ngày 20, suất Free mặc định 0,5 ⇒ 10: lượt đưa ngân sách lên đúng 10 được phục vụ", async () => {
    redis.state.store.set(BUDGET_KEY, 9);

    const result = await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1);

    expect(result).toEqual({ ok: true });
    expect(at(BUDGET_KEY)).toBe(10);
  });

  it("lượt VƯỢT 10 bị từ chối `project_budget` — và KHÔNG lấy mất suất của người dùng", async () => {
    redis.state.store.set(BUDGET_KEY, 10);
    redis.state.store.set(TUTOR_KEY, 0);

    const result = await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1);

    expect(result).toEqual({ ok: false, reason: "project_budget" });
    // Cả hai bộ đếm phải trở về đúng chỗ cũ: người dùng không trả giá bằng một
    // suất hạn mức cho một sự cố ở tầm dự án.
    expect(at(BUDGET_KEY)).toBe(10);
    expect(at(TUTOR_KEY)).toBe(0);
  });

  it("CÙNG trạng thái đó, người Premium VẪN được phục vụ tới trần đầy 20", async () => {
    redis.state.store.set(BUDGET_KEY, 10);

    const result = await consumeQuota("tutor", USER_ID, knownEnt("premium", RESETS_AT), 1);

    expect(result).toEqual({ ok: true });
    expect(at(BUDGET_KEY)).toBe(11);
  });

  it("Premium bị từ chối khi vượt TRẦN ĐẦY, không phải khi vượt suất Free", async () => {
    redis.state.store.set(BUDGET_KEY, 20);

    const result = await consumeQuota("tutor", USER_ID, knownEnt("premium", RESETS_AT), 1);

    expect(result).toEqual({ ok: false, reason: "project_budget" });
    expect(at(BUDGET_KEY)).toBe(20);
  });

  it("AI_BUDGET_FREE_SHARE là PHÂN SỐ: `0.5` nghĩa là một nửa, không phải 0,5%", async () => {
    // Đây là ca chốt cách mã hoá (lý do đầy đủ ghi ở `quota.ts`). Đọc `0.5`
    // theo PHẦN TRĂM cho trần Free = floor(20 × 0,005) = 0, tức TỪ CHỐI TOÀN
    // BỘ lưu lượng Free ngay từ lượt đầu tiên của ngày — một sự cố toàn phần
    // gây ra bởi một dấu chấm, và không có gì đỏ ở đâu cả.
    vi.stubEnv("AI_BUDGET_FREE_SHARE", "0.5");

    const result = await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1);

    expect(result).toEqual({ ok: true });
    expect(at(BUDGET_KEY)).toBe(1);
  });

  it("`0.25` ⇒ trần Free là 5, không phải mặc định 10 — giá trị được ĐỌC thật", async () => {
    vi.stubEnv("AI_BUDGET_FREE_SHARE", "0.25");
    redis.state.store.set(BUDGET_KEY, 5);

    expect(await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1)).toEqual({
      ok: false,
      reason: "project_budget",
    });

    redis.state.store.set(BUDGET_KEY, 4);
    expect(await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1)).toEqual({
      ok: true,
    });
  });

  it("`50` nằm ngoài khoảng (0, 1] ⇒ rơi về 0,5 — đúng con số người vận hành định nói", async () => {
    // Người gõ `50` đang nghĩ "phần trăm". Đọc thô theo phân số cho trần Free =
    // 1000, tức suất bảo lưu cho Premium BIẾN MẤT trong im lặng. Rơi về mặc
    // định 0,5 vừa an toàn vừa cho ra ĐÚNG 50% mà họ định nói.
    vi.stubEnv("AI_BUDGET_FREE_SHARE", "50");
    redis.state.store.set(BUDGET_KEY, 10);

    const result = await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1);

    expect(result).toEqual({ ok: false, reason: "project_budget" });
    expect(at(BUDGET_KEY)).toBe(10);
  });

  it("Premium BỎ QUA suất Free hoàn toàn", async () => {
    vi.stubEnv("AI_BUDGET_FREE_SHARE", "0.25");
    redis.state.store.set(BUDGET_KEY, 5);

    expect(await consumeQuota("tutor", USER_ID, knownEnt("premium", RESETS_AT), 1)).toEqual({
      ok: true,
    });
  });

  it("upload `automatic` bị từ chối khi 3 request ĐẶT CHỖ vượt trần, dù 1 request thì không", async () => {
    // Đặt chỗ được kiểm theo TOÀN BỘ số request sẽ phát, chứ không theo một
    // request rồi tính sau — đó là toàn bộ lý do nó là đặt chỗ.
    redis.state.store.set(BUDGET_KEY, 8);

    const result = await consumeQuota("upload", USER_ID, knownEnt("free", RESETS_AT), 3);

    expect(result).toEqual({ ok: false, reason: "project_budget" });
    expect(at(BUDGET_KEY)).toBe(8);
    expect(at(UPLOAD_KEY)).toBe(0);
  });
});

describe("consumeQuota — AI_BUDGET_DAILY_LIMIT: thiếu trần KHÔNG phải trần vô hạn (AC-025)", () => {
  it.each([
    ["để trống", ""],
    ["`unlimited`", "unlimited"],
    ["`Infinity`", "Infinity"],
    ["`0`", "0"],
    ["`20.5`", "20.5"],
  ])("%s ⇒ `unavailable`, và 0 lượt chạm Redis", async (_label, raw) => {
    vi.stubEnv("AI_BUDGET_DAILY_LIMIT", raw);

    const result = await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1);

    expect(result).toEqual({ ok: false, reason: "unavailable" });
    // Từ chối TRƯỚC mọi phép ghi: một deploy quên biến môi trường không được
    // đốt hạn mức của người dùng trong lúc từ chối phục vụ họ.
    expect(redis.state.calls).toEqual([]);
  });

  it("trần 1 ⇒ đúng một request mỗi ngày cho Premium; request thứ hai bị từ chối", async () => {
    vi.stubEnv("AI_BUDGET_DAILY_LIMIT", "1");

    expect(await consumeQuota("tutor", USER_ID, knownEnt("premium", RESETS_AT), 1)).toEqual({
      ok: true,
    });
    expect(await consumeQuota("tutor", USER_ID, knownEnt("premium", RESETS_AT), 1)).toEqual({
      ok: false,
      reason: "project_budget",
    });
  });
});

describe("consumeQuota — Redis không tới được ⇒ TỪ CHỐI (AC-024)", () => {
  it("chưa cấu hình Upstash ⇒ `unavailable`, 0 lượt chạm bộ đếm", async () => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");

    const result = await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1);

    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(redis.state.calls).toEqual([]);
  });

  it("Upstash ném ⇒ `unavailable` — KHÔNG tụt về bộ đếm trong RAM", async () => {
    redis.state.down = true;

    // Ba lượt liên tiếp: một lớp RAM thừa kế từ rateLimit.ts sẽ cho lượt 1–2 đi
    // qua rồi mới chặn (hoặc cho tất cả đi qua), nên một ca đơn lẻ không phân
    // biệt được. Bộ đếm trong RAM của MỘT instance không bao giờ chặn nổi một
    // ngân sách toàn dự án.
    for (const attempt of [1, 2, 3]) {
      const result = await consumeQuota("tutor", USER_ID, knownEnt("free", RESETS_AT), 1);
      expect(result, `lượt ${attempt}`).toEqual({ ok: false, reason: "unavailable" });
    }

    // Lệnh ĐÃ được thử phát đi (nên đây là "Redis chết", không phải "bỏ qua
    // Redis"), nhưng không bộ đếm nào ghi nhận được gì.
    expect(callNames()).toEqual(["incr", "incr", "incr"]);
    expect([...redis.state.store.keys()]).toEqual([]);
  });
});

describe("consumeQuota — chữ ký", () => {
  it("tham số thứ tư BẮT BUỘC, không có giá trị mặc định (DD I004)", () => {
    // Một mặc định `= 1` tái tạo Y NGUYÊN cái undercount 2–3× mà thiết kế này
    // tồn tại để sửa, và tái tạo nó IM LẶNG. `Function.length` đếm các tham số
    // ĐỨNG TRƯỚC tham số có mặc định đầu tiên, nên thêm `= 1` làm dòng này đỏ.
    expect(consumeQuota.length).toBe(4);
  });
});

/** KHÔNG phải một ca test và cố ý không bao giờ được gọi: cổng kiểm nó là
 *  `npx tsc --noEmit`. Thêm `geminiCalls = 1` làm lời gọi dưới đây hết lỗi, và
 *  một `@ts-expect-error` KHÔNG DÙNG TỚI tự nó là lỗi biên dịch — nên cả hai
 *  cổng cùng đỏ. `export` để nó là một ràng buộc kiểu có thật chứ không phải
 *  một biến chết. */
export const __missingGeminiCallsMustNotCompile = (ent: Entitlement) =>
  // @ts-expect-error — thiếu tham số thứ tư phải là LỖI BIÊN DỊCH
  consumeQuota("tutor", USER_ID, ent);

describe("consumeQuota — một chỗ dựng khoá duy nhất, và không thừa kế lớp RAM", () => {
  const SOURCE_ROOT = process.cwd();
  const quotaSource = readFileSync(path.join(SOURCE_ROOT, "lib/billing/quota.ts"), "utf8");

  /** Bỏ dòng chú thích để phép quét đếm CHỖ DỰNG chuỗi chứ không đếm chỗ NHẮC
   *  TỚI nó — `quota.ts` nhắc tới cả hai mẫu khoá ở nhiều dòng chú thích. */
  function codeLines(source: string): string[] {
    return source.split("\n").filter((line) => {
      const trimmed = line.trim();
      return !(trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*"));
    });
  }

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".next")) continue;
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
    }
    return out;
  }

  it("`quota.ts` chứa ĐÚNG MỘT dòng dựng mẫu khoá `quota:` — nhánh unknown không đẻ ra khoá thứ hai", () => {
    const sites = codeLines(quotaSource).filter((l) => /["'`]quota:/.test(l));
    expect(sites).toHaveLength(1);
  });

  it("toàn repo có ĐÚNG MỘT chỗ dựng mẫu khoá `ai:budget:`", () => {
    const sites = walk(SOURCE_ROOT)
      .filter((f) => codeLines(readFileSync(f, "utf8")).some((l) => /["'`]ai:budget:/.test(l)))
      .map((f) => path.relative(SOURCE_ROOT, f).split(path.sep).join("/"));

    expect(sites).toEqual(["lib/billing/quota.ts"]);
  });

  it("`quota.ts` KHÔNG import rateLimit/rateLimitStore và không tự dựng bộ đếm trong RAM", () => {
    // Ca này đỏ đúng vào lúc có người "tái dùng cho gọn" bộ đệm của
    // rateLimit.ts. Một bộ đếm process-local bao giờ cũng nhân với số instance
    // và về 0 ở mỗi cold start — nó không bao giờ chặn nổi một ngân sách chung.
    const code = codeLines(quotaSource).join("\n");
    expect(code).not.toMatch(/rateLimit/);
    expect(code).not.toMatch(/new Map\(/);
  });
});
