// Đường ĐỌC quyền lợi — backend DD `:846` "readEntitlement.ts — the read-time
// derivation", PRD AC-001/005/010/011/016/052, UI Spec C-01.
//
// Thứ đáng kiểm ở đây KHÔNG phải "hàm có trả về một object đúng hình dạng
// không" — TypeScript đã giữ hình dạng. Đáng kiểm là BỐN thứ mà kiểu không giữ
// được, và cả bốn đều hỏng IM LẶNG:
//
//   1. BIÊN ÂN HẠN. `expires_at + 3 ngày` là ranh giới giữa "còn Premium" và
//      "về Free". Lệch một ngày, hay dùng `<=` thay `<`, không làm đỏ dòng nào
//      — nó chỉ cho không (hoặc lấy mất) 24 giờ Premium. Vì thế mọi ca biên
//      dưới đây kẹp đúng MỘT MILI GIÂY quanh mốc, tính từ CÙNG một số literal
//      mà `vi.setSystemTime()` đặt vào đồng hồ — không phải một mốc gõ tay lệch
//      vài giờ so với biên (bài học ca "ngày 29,999" của Task 1.4: nó cách biên
//      86 400 GIÂY nên không phân biệt được gì).
//   2. KHOÁ BỘ ĐẾM. `used` đọc từ `quota:{kind}:{userId}:{periodStartEpoch}`,
//      và đường GHI (Task 5.1) sẽ INCR đúng chuỗi đó. Nên các ca dưới đây
//      khẳng định CHUỖI KHOÁ ĐƯỢC TRUYỀN VÀO REDIS, không phải "có gọi Redis".
//      Chuỗi kỳ vọng là literal, ghép tay trong test.
//   3. ÂN HẠN CẤP QUYỀN, KHÔNG CẤP HẠN MỨC (AC-011). Trong ân hạn khoá phải
//      KHÔNG ĐỔI so với trước mốc hết hạn. Một implementation "tử tế" đẩy mốc
//      kỳ khi hết hạn sẽ tặng người dùng một kỳ hạn mức miễn phí.
//   4. HƯỚNG HỎNG. Supabase hỏng ⇒ `plan` về Free (fail-CLOSED); Redis hỏng ⇒
//      hạn mức về `unknown`, KHÔNG phải 0 (fail-OPEN, UI-D2). Hai hướng ngược
//      nhau, cố ý, và một implementation gộp cả hai về một hướng vẫn xanh nếu
//      test chỉ kiểm "không ném lỗi".

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// readEntitlement.ts `import "server-only"` — module đó ném lỗi ngoài bundle
// server của Next. Stub theo lối 14 file test khác trong repo (vd
// lib/billing/__tests__/paidTier.test.ts:13).
vi.mock("server-only", () => ({}));

// `vi.hoisted` vì cả hai factory dưới đây bị nâng lên đầu file, trước mọi khai
// báo `const` thường — và cả hai module ĐỀU được readEntitlement.ts import
// thật, nên factory được chạy ngay lúc nạp.
const { mgetMock, createClientMock } = vi.hoisted(() => ({
  mgetMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    mget = mgetMock;
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { readEntitlement } from "../readEntitlement";
import { isQuotaExhausted } from "../types";

// ────────────────────────────── Số liệu cố định ──────────────────────────────
// Tất cả tính bằng `Date.UTC` ngay tại đây; KHÔNG import hằng nào từ module
// đang được test — một hằng đi chung với implementation thì không kiểm được
// implementation (cùng kỷ luật với quota.test.ts:21-24).

const USER_ID = "11111111-1111-4111-8111-111111111111";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 2_592_000_000
const GRACE_MS = 3 * 24 * 60 * 60 * 1000; //          259_200_000

/** `user_profiles.created_at`. 2026-01-15T09:17:33.123Z — CỐ Ý không phải nửa
 *  đêm ở cả UTC lẫn Asia/Saigon, nên mọi implementation cắt về mốc NGÀY đều
 *  lệch, ở bất kỳ múi giờ nào CI đang chạy. */
const CREATED_AT_MS = Date.UTC(2026, 0, 15, 9, 17, 33, 123); // 1768468653123
/** `subscriptions.period_anchor_at`. 2026-03-03T14:45:10.500Z. */
const ANCHOR_MS = Date.UTC(2026, 2, 3, 14, 45, 10, 500); //     1772549110500
/** `subscriptions.expires_at` = anchor + 30 ngày. 2026-04-02T14:45:10.500Z. */
const EXPIRES_AT_MS = ANCHOR_MS + THIRTY_DAYS_MS; //            1775141110500
/** Mốc HẾT ân hạn = expires_at + 3 ngày. 2026-04-05T14:45:10.500Z. */
const GRACE_END_MS = EXPIRES_AT_MS + GRACE_MS; //               1775400310500

const CREATED_AT_ISO = "2026-01-15T09:17:33.123Z";
const ANCHOR_ISO = "2026-03-03T14:45:10.500Z";
const EXPIRES_AT_ISO = "2026-04-02T14:45:10.500Z";

const key = (kind: "tutor" | "upload", periodStartEpoch: number) =>
  `quota:${kind}:${USER_ID}:${periodStartEpoch}`;

// ──────────────────────────── Biên I/O được mock ─────────────────────────────

type SubRow = { expires_at: string; period_anchor_at: string } | null;
type ProfileRow = { created_at: string } | null;
type PgError = { code: string } | null;

/** Mọi phép GHI qua Supabase đổ về đây. AC-005 đòi 0 lượt ghi giữa hai lượt
 *  đọc — nên nó phải là một spy có thật, không phải một lời hứa. */
const writeSpy = vi.fn();

let subRow: SubRow;
let subError: PgError;
let profileRow: ProfileRow;
let profileError: PgError;
let supabaseThrows: boolean;

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
  throw new Error(`readEntitlement đọc bảng ngoài dự kiến: ${table}`);
});

function configureRedis(on: boolean) {
  vi.stubEnv("KV_REST_API_URL", on ? "https://x.upstash.io" : "");
  vi.stubEnv("KV_REST_API_TOKEN", on ? "tok" : "");
}

/** Khoá nào đã được truyền vào Redis ở lượt gọi `mget` gần nhất. */
const keysRead = () => mgetMock.mock.calls.at(-1) as string[] | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  mgetMock.mockReset();
  mgetMock.mockResolvedValue([null, null]);
  fromSpy.mockClear();
  writeSpy.mockClear();
  createClientMock.mockReset();
  createClientMock.mockImplementation(async () => {
    if (supabaseThrows) throw new Error("Supabase không kết nối được");
    return { from: fromSpy, rpc: writeSpy };
  });
  subRow = null;
  subError = null;
  profileRow = { created_at: CREATED_AT_ISO };
  profileError = null;
  supabaseThrows = false;
  configureRedis(true);
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Đặt đồng hồ tới đúng mili giây `ms` rồi đọc. Đồng hồ là THAM SỐ ẩn duy nhất
 *  của hàm này (chữ ký đóng băng, không nhận `now`), nên mọi ca biên đều đi qua
 *  đây và mọi kỳ vọng đều tính từ cùng một số. */
async function readAt(ms: number) {
  vi.setSystemTime(new Date(ms));
  return readEntitlement(USER_ID);
}

function seedPremium() {
  subRow = { expires_at: EXPIRES_AT_ISO, period_anchor_at: ANCHOR_ISO };
}

// ═══════════════════════════════════════════════════════════════════════════

describe("readEntitlement — khách chưa đăng nhập", () => {
  it("trả FREE_FALLBACK và KHÔNG chạm database (hai trang công khai render qua layout này)", async () => {
    vi.setSystemTime(new Date(EXPIRES_AT_MS));
    const ent = await readEntitlement(null);

    expect(ent).toEqual({
      plan: "free",
      expiresAt: null,
      inGracePeriod: false,
      tutor: { state: "unknown" },
      upload: { state: "unknown" },
    });
    expect(createClientMock).not.toHaveBeenCalled();
    expect(mgetMock).not.toHaveBeenCalled();
  });
});

describe("readEntitlement — AC-001: không có dòng subscriptions ⇒ free", () => {
  it("tài khoản mới đọc ra free, expiresAt null, không ân hạn", async () => {
    const ent = await readAt(CREATED_AT_MS + 15 * 86_400_000);

    expect(ent.plan).toBe("free");
    expect(ent.expiresAt).toBeNull();
    expect(ent.inGracePeriod).toBe(false);
  });

  it("KHÔNG đọc cột boolean nào — truy vấn subscriptions chỉ lấy expires_at + period_anchor_at", async () => {
    await readAt(CREATED_AT_MS + 15 * 86_400_000);

    const subIndex = fromSpy.mock.calls.findIndex(([table]) => table === "subscriptions");
    expect(subIndex).toBeGreaterThanOrEqual(0);
    const builder = fromSpy.mock.results[subIndex].value as {
      select: ReturnType<typeof vi.fn>;
    };
    const selected = builder.select.mock.calls[0][0] as string;
    expect(selected).toContain("expires_at");
    expect(selected).toContain("period_anchor_at");
    expect(selected).not.toMatch(/is_premium|is_active|status|plan_active/);
  });
});

describe("readEntitlement — AC-005: hạ cấp là phép SO SÁNH lúc đọc, không phải một job", () => {
  it("quá ân hạn ⇒ free, và KHÔNG có lượt ghi nào giữa hai lượt đọc", async () => {
    seedPremium();

    const before = await readAt(GRACE_END_MS - 1000);
    const after = await readAt(GRACE_END_MS + 1000);

    expect(before.plan).toBe("premium");
    expect(after.plan).toBe("free");
    // Cùng MỘT dòng dữ liệu, không thứ gì chạy ở giữa: chỉ đồng hồ đổi.
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("không có cron/scheduled job nào trong repository (0 tiến trình nền)", () => {
    const vercelJson = JSON.parse(
      readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")
    ) as Record<string, unknown>;
    expect(Object.keys(vercelJson)).not.toContain("crons");
  });
});

describe("readEntitlement — AC-010: biên ân hạn 3 ngày, kẹp một mili giây", () => {
  beforeEach(seedPremium);

  it.each([
    ["một giây TRƯỚC expires_at ⇒ premium, CHƯA ân hạn", EXPIRES_AT_MS - 1000, "premium", false],
    ["đúng expires_at ⇒ premium, ân hạn BẮT ĐẦU tại đây", EXPIRES_AT_MS, "premium", true],
    ["giữa ân hạn (ngày 3) ⇒ premium, đang ân hạn", GRACE_END_MS - 86_400_000, "premium", true],
    ["một mili giây TRƯỚC hết ân hạn ⇒ vẫn premium", GRACE_END_MS - 1, "premium", true],
    ["ĐÚNG mốc hết ân hạn ⇒ free — biên là `<`, không phải `<=`", GRACE_END_MS, "free", false],
    ["một giây SAU hết ân hạn ⇒ free", GRACE_END_MS + 1000, "free", false],
    ["ngày thứ 4 sau hết hạn ⇒ free", EXPIRES_AT_MS + 4 * 86_400_000, "free", false],
  ])("%s", async (_label, at, plan, inGrace) => {
    const ent = await readAt(at as number);
    expect(ent.plan).toBe(plan);
    expect(ent.inGracePeriod).toBe(inGrace);
  });

  it("expiresAt là ISO 8601 chuẩn hoá về `Z`, không phải `+00:00` của PostgREST", async () => {
    subRow = {
      expires_at: "2026-04-02T14:45:10.5+00:00",
      period_anchor_at: "2026-03-03T14:45:10.5+00:00",
    };
    const ent = await readAt(EXPIRES_AT_MS - 1000);
    expect(ent.expiresAt).toBe("2026-04-02T14:45:10.500Z");
  });

  it("expiresAt về null khi đã về free — hợp đồng types.ts (null ⇔ plan free)", async () => {
    const ent = await readAt(GRACE_END_MS);
    expect(ent.plan).toBe("free");
    expect(ent.expiresAt).toBeNull();
  });
});

describe("readEntitlement — AC-011: ân hạn cấp QUYỀN, không bao giờ cấp HẠN MỨC", () => {
  it("khoá bộ đếm TRONG ân hạn byte-identical với khoá TRƯỚC mốc hết hạn", async () => {
    seedPremium();

    await readAt(EXPIRES_AT_MS - 1000);
    const beforeExpiry = keysRead();

    await readAt(EXPIRES_AT_MS + 2 * 86_400_000);
    const insideGrace = keysRead();

    // Literal, không phải "bằng nhau" suông: hai lượt trả CÙNG MỘT khoá SAI
    // vẫn phải đỏ.
    expect(beforeExpiry).toEqual([key("tutor", ANCHOR_MS), key("upload", ANCHOR_MS)]);
    expect(insideGrace).toEqual([key("tutor", ANCHOR_MS), key("upload", ANCHOR_MS)]);
  });

  it("vào ân hạn với 0 lượt còn lại ⇒ hết HẠN MỨC, không phải hết HẠN GÓI (hai lý do khác nhau)", async () => {
    seedPremium();
    mgetMock.mockResolvedValue([500, 0]);

    const ent = await readAt(EXPIRES_AT_MS + 86_400_000);

    // Lý do KHÔNG phải hết hạn gói:
    expect(ent.plan).toBe("premium");
    expect(ent.inGracePeriod).toBe(true);
    // Lý do LÀ hết hạn mức — và bộ đếm vẫn tính vào kỳ TRƯỚC:
    expect(isQuotaExhausted(ent.tutor)).toBe(true);
    expect(isQuotaExhausted(ent.upload)).toBe(false);
  });
});

describe("readEntitlement — AC-052: mốc reset của người dùng Free là created_at + 30d × k", () => {
  it.each([
    ["ngày 15 — floor = 0", 15, 1768468653123, "2026-02-14T09:17:33.123Z"],
    ["ngày 29 — floor = 0, KHÔNG phải round", 29, 1768468653123, "2026-02-14T09:17:33.123Z"],
    ["ngày 31 — kỳ thứ hai", 31, 1771060653123, "2026-03-16T09:17:33.123Z"],
  ])("%s", async (_label, days, periodStart, resetsAt) => {
    const ent = await readAt(CREATED_AT_MS + (days as number) * 86_400_000);

    expect(keysRead()).toEqual([
      key("tutor", periodStart as number),
      key("upload", periodStart as number),
    ]);
    expect(ent.tutor).toEqual({ state: "known", used: 0, limit: 5, resetsAt });
    expect(ent.upload).toEqual({ state: "known", used: 0, limit: 3, resetsAt });
  });

  it("KHÔNG phải ngày 1 của tháng dương lịch kế tiếp", async () => {
    const ent = await readAt(CREATED_AT_MS + 15 * 86_400_000);
    if (ent.tutor.state !== "known") throw new Error("kỳ vọng state known");
    expect(ent.tutor.resetsAt).not.toBe("2026-02-01T00:00:00.000Z");
    expect(ent.tutor.resetsAt).not.toBe("2026-03-01T00:00:00.000Z");
  });
});

describe("readEntitlement — AC-016 (nửa ĐỌC): reset là một khoá MỚI, không phải một phép ghi đè", () => {
  it("trước mốc kỳ MỘT GIÂY: vẫn khoá cũ, vẫn số cũ", async () => {
    mgetMock.mockResolvedValue([4, 2]);

    const ent = await readAt(CREATED_AT_MS + THIRTY_DAYS_MS - 1000);

    expect(keysRead()).toEqual([key("tutor", CREATED_AT_MS), key("upload", CREATED_AT_MS)]);
    expect(ent.tutor).toEqual({
      state: "known",
      used: 4,
      limit: 5,
      resetsAt: "2026-02-14T09:17:33.123Z",
    });
  });

  it("ĐÚNG mốc kỳ (mili giây thứ 2 592 000 000): khoá MỚI ⇒ chưa có gì ⇒ đầy lại", async () => {
    // Khoá mới chưa tồn tại trên Redis ⇒ mget trả null ⇒ used = 0. Không có
    // job nào chạy ở biên; "reset" chỉ là một chuỗi khoá khác.
    mgetMock.mockResolvedValue([null, null]);

    const ent = await readAt(CREATED_AT_MS + THIRTY_DAYS_MS);

    expect(keysRead()).toEqual([
      key("tutor", CREATED_AT_MS + THIRTY_DAYS_MS),
      key("upload", CREATED_AT_MS + THIRTY_DAYS_MS),
    ]);
    expect(ent.tutor).toEqual({
      state: "known",
      used: 0,
      limit: 5,
      resetsAt: "2026-03-16T09:17:33.123Z",
    });
  });
});

describe("readEntitlement — hạn mức lấy từ PLAN_LIMITS, mốc kỳ Premium neo ở anchor", () => {
  it("premium ⇒ 500 / 15, khoá neo ở period_anchor_at chứ không phải created_at", async () => {
    seedPremium();
    mgetMock.mockResolvedValue([12, 3]);

    const ent = await readAt(ANCHOR_MS + 5 * 86_400_000);

    expect(keysRead()).toEqual([key("tutor", ANCHOR_MS), key("upload", ANCHOR_MS)]);
    expect(ent.tutor).toEqual({
      state: "known",
      used: 12,
      limit: 500,
      resetsAt: EXPIRES_AT_ISO,
    });
    expect(ent.upload).toEqual({
      state: "known",
      used: 3,
      limit: 15,
      resetsAt: EXPIRES_AT_ISO,
    });
  });
});

describe("readEntitlement — hai hướng hỏng NGƯỢC NHAU, cố ý", () => {
  it("Redis không trả lời ⇒ hạn mức `unknown` (KHÔNG phải 0) và plan vẫn thật — UI-D2 fail-OPEN", async () => {
    seedPremium();
    mgetMock.mockRejectedValue(new Error("ECONNRESET"));

    const ent = await readAt(ANCHOR_MS + 5 * 86_400_000);

    expect(ent.plan).toBe("premium");
    expect(ent.expiresAt).toBe(EXPIRES_AT_ISO);
    expect(ent.tutor).toEqual({ state: "unknown" });
    expect(ent.upload).toEqual({ state: "unknown" });
  });

  it("Redis chưa cấu hình ⇒ cũng `unknown`, và không gọi Redis lần nào", async () => {
    seedPremium();
    configureRedis(false);

    const ent = await readAt(ANCHOR_MS + 5 * 86_400_000);

    expect(ent.plan).toBe("premium");
    expect(ent.tutor).toEqual({ state: "unknown" });
    expect(mgetMock).not.toHaveBeenCalled();
  });

  it("premium nhưng thiếu period_anchor_at (dữ liệu hỏng) ⇒ `unknown`, KHÔNG rơi về công thức Free", async () => {
    // Rơi lặng lẽ về created_at sẽ đẻ ra một khoá THỨ HAI cho cùng một người —
    // đúng thứ periodStartEpoch() ném lỗi để chặn (quota.ts:71-77).
    subRow = { expires_at: EXPIRES_AT_ISO, period_anchor_at: null as unknown as string };

    const ent = await readAt(ANCHOR_MS + 5 * 86_400_000);

    expect(ent.plan).toBe("premium");
    expect(ent.tutor).toEqual({ state: "unknown" });
    expect(mgetMock).not.toHaveBeenCalled();
  });

  it("Supabase hỏng ⇒ plan fail-CLOSED về free, layout vẫn render (không ném)", async () => {
    supabaseThrows = true;

    const ent = await readAt(ANCHOR_MS);

    expect(ent).toEqual({
      plan: "free",
      expiresAt: null,
      inGracePeriod: false,
      tutor: { state: "unknown" },
      upload: { state: "unknown" },
    });
  });

  it("truy vấn subscriptions lỗi (bảng chưa apply ở môi trường đó) ⇒ free, không ném", async () => {
    subError = { code: "42P01" };

    const ent = await readAt(ANCHOR_MS);

    expect(ent.plan).toBe("free");
    expect(ent.tutor).toEqual({ state: "unknown" });
  });

  it("thiếu dòng user_profiles ⇒ không đoán mốc kỳ, hạn mức `unknown`", async () => {
    profileRow = null;

    const ent = await readAt(CREATED_AT_MS + 15 * 86_400_000);

    expect(ent.plan).toBe("free");
    expect(ent.tutor).toEqual({ state: "unknown" });
    expect(mgetMock).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Quét mã nguồn — nghĩa vụ chứng minh "shared-state dependency" của task này.

const SOURCE_ROOT = process.cwd();

/** Bỏ dòng chú thích (`//`, `*`, `/*`) để phép quét đếm CHỖ DỰNG chuỗi, chứ
 *  không đếm chỗ NHẮC TỚI nó — quota.ts nhắc tới khoá ở 2 dòng chú thích. */
function codeLines(source: string): string[] {
  return source.split("\n").filter((line) => {
    const trimmed = line.trim();
    return !(
      trimmed.startsWith("//") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("/*")
    );
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

describe("một chỗ dựng khoá duy nhất (I004)", () => {
  const readEntitlementSource = readFileSync(
    path.join(SOURCE_ROOT, "lib/billing/readEntitlement.ts"),
    "utf8"
  );

  it("readEntitlement.ts KHÔNG chứa mẫu khoá `quota:` của riêng nó", () => {
    const offenders = codeLines(readEntitlementSource).filter((l) => /["'`]quota:/.test(l));
    expect(offenders).toEqual([]);
  });

  it("readEntitlement.ts KHÔNG chứa công thức mốc kỳ thứ hai", () => {
    const code = codeLines(readEntitlementSource).join("\n");
    // 30 ngày viết tay, hay một phép floor((now − created)/…) chép lại — cả hai
    // là lời khai THỨ HAI của thứ periodStartEpoch()/PERIOD_MS đã khai.
    expect(code).not.toMatch(/30\s*\*\s*24\s*\*\s*60/);
    expect(code).not.toMatch(/2_?592_?000_?000/);
    expect(code).not.toMatch(/Math\.floor/);
  });

  it("toàn repo có ĐÚNG MỘT chỗ dựng chuỗi khoá `quota:`", () => {
    const sites = walk(SOURCE_ROOT)
      .filter((f) => codeLines(readFileSync(f, "utf8")).some((l) => /["'`]quota:/.test(l)))
      .map((f) => path.relative(SOURCE_ROOT, f).split(path.sep).join("/"));

    expect(sites).toEqual(["lib/billing/quota.ts"]);
  });
});
