// @vitest-environment jsdom

// (layer2)/layout.tsx — EntitlementProvider mount (backend DD D005 / I1, ADR-0013
// § Architecture Impact, UI Spec C-01).
//
// VÌ SAO FILE NÀY TỒN TẠI. Không có nó thì lỗi mà task này sửa là lỗi KHÔNG AI
// THẤY: `useEntitlement()` trả `FREE_FALLBACK` khi thiếu provider
// (entitlement.tsx:44), nên một cây route không có provider biên dịch sạch, lint
// sạch, mọi unit test cũ vẫn xanh — và màn hình chỉ đơn giản là luôn nói "Free".
// TutorQuotaNote trả null vĩnh viễn, nhánh blocked-quota của ExplainStepAffordance
// không bao giờ với tới được. Đây là ca kiểm ★ sớm của cả tính năng (backend DD
// :1182): nó là thứ đầu tiên làm hệ thống QUAN SÁT ĐƯỢC.
//
// RANH GIỚI MOCK (backend DD Test Boundaries, dòng "Provider coverage (I1)":
// "nothing — render the real layout tree ... a mocked provider would assert the
// mock"):
//   · `readEntitlement()` KHÔNG bị mock — NGUỒN DỮ LIỆU của nó bị stub
//     (`@/lib/supabase/server`, `@upstash/redis`), đúng harness mà
//     `lib/billing/__tests__/readEntitlement.test.ts:39-56` đã dựng.
//   · `EntitlementProvider` KHÔNG bị mock. Layout, provider, hook và component
//     bị gate đều chạy thật.
//   · `getCurrentUserProfile()` bị stub: nó là NGUỒN DỮ LIỆU của layout (cung
//     cấp `user.id`), không phải thứ đang được kiểm.
//   · `next/navigation` + ba module Server Action bị stub vì SiteHeader/
//     BottomNav/SupportWidget là client component chạy trong jsdom.
//
// BẪY QUAN TRỌNG NHẤT, VIẾT RA ĐỂ KHÔNG AI "DỌN GỌN" NÓ. `readEntitlement()`
// hỏng-ĐÓNG về ĐÚNG `FREE_FALLBACK` (readEntitlement.ts:61,64) — cùng một giá
// trị mà một provider KHÔNG ĐƯỢC MOUNT tạo ra. Nên một stub Supabase làm sai
// (thiếu `created_at`, sai tên bảng, quên bật Redis) sẽ cho ra `FREE_FALLBACK`
// và ca kiểm XANH y hệt như khi không có provider — nó không phân biệt được gì.
// Vì thế stub dưới đây dựng một giá trị Premium THẬT với hạn mức `known`, và
// khẳng định là so khớp TOÀN BỘ object, không phải "khác FREE_FALLBACK".
//
// Không có setupFiles trong vitest.config.ts ⇒ không có matcher jest-dom, và
// `render()` không tự cleanup; mọi truy vấn bám `container` của chính lần render
// đó (tiền lệ ExplainStepAffordance.test.tsx).

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// readEntitlement.ts `import "server-only"` — module đó ném ngoài bundle server
// của Next. Stub theo lối 14 file test khác trong repo.
vi.mock("server-only", () => ({}));

const { mgetMock, createClientMock, getCurrentUserProfileMock } = vi.hoisted(() => ({
  mgetMock: vi.fn(),
  createClientMock: vi.fn(),
  getCurrentUserProfileMock: vi.fn(),
}));

vi.mock("@upstash/redis", () => ({
  Redis: class {
    mget = mgetMock;
  },
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: createClientMock }));
vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUserProfile: getCurrentUserProfileMock,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/exams" }));
// SkipLink là async Server Component (`getTranslate()` từ lib/i18n/server). Bộ
// render client của React 19 từ chối thẳng component async — nó suspend và CẢ
// CÂY ra rỗng, tức là ca kiểm sẽ đỏ vì lý do sai. Đây là giới hạn môi trường
// jsdom, cùng loại với việc phải stub `next/navigation`; SkipLink nằm NGOÀI
// provider nên không đứng giữa khẳng định nào của file này.
vi.mock("@/components/shared/SkipLink", () => ({ SkipLink: () => null }));
vi.mock("@/lib/support/actions", () => ({ submitSupportTicket: vi.fn() }));
vi.mock("@/lib/i18n/actions", () => ({ setLocale: vi.fn() }));
vi.mock("@/app/(layer1)/actions", () => ({ signOut: vi.fn() }));

import Layer2Layout from "../layout";
import { TutorQuotaNote } from "@/components/billing/TutorQuotaNote";
import { useEntitlement } from "@/lib/billing/entitlement";
import { FREE_FALLBACK, type Entitlement, type Quota } from "@/lib/billing/types";

// Phân giải theo THƯ MỤC CỦA CHÍNH FILE NÀY, không theo process.cwd() — tiền lệ
// ExplainStepAffordance.test.tsx:399.
const HERE = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────── Số liệu cố định ────────────────────────────────
// Không import hằng nào từ module đang được kiểm; mọi mốc tính bằng Date.UTC
// ngay tại đây, và mọi chuỗi kỳ vọng là LITERAL gõ tay.

const USER = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "premium@example.com",
  displayName: "Premium Tester",
  avatarUrl: null,
};

const NOW_MS = Date.UTC(2026, 7, 18, 12, 0, 0); // 2026-08-18T12:00:00.000Z

// Nguồn Supabase trả chuỗi kiểu PostgREST (`+00:00`), KHÔNG phải `Z`. Hợp đồng
// đóng băng đòi ISO 8601 chuẩn hoá qua `toISOString()`; hai chuỗi cùng chỉ một
// thời điểm mà so sánh chuỗi thì khác nhau.
const EXPIRES_AT_PGRST = "2026-08-28T12:00:00+00:00"; // NOW + 10 ngày
const ANCHOR_PGRST = "2026-07-27T12:00:00+00:00"; //     NOW − 22 ngày
const CREATED_AT_PGRST = "2026-01-15T09:17:33.123+00:00";

// CỐ Ý KHÁC NHAU. Mốc reset = anchor + 30 ngày = 2026-08-26, còn hạn gói =
// 2026-08-28. Nếu hai giá trị bằng nhau thì một implementation hoán đổi chúng
// vẫn xanh — ở đây thì không.
const EXPECTED_EXPIRES_AT = "2026-08-28T12:00:00.000Z";
const EXPECTED_RESETS_AT = "2026-08-26T12:00:00.000Z";

// Bốn con số KHÔNG đối xứng (7≠2, 500≠15) để một lượt `mget` trả sai thứ tự,
// hay một bảng hạn mức lấy nhầm gói, không thể sống sót.
const TUTOR_USED = 7;
const UPLOAD_USED = 2;
const PREMIUM_TUTOR_LIMIT = 500;
const PREMIUM_UPLOAD_LIMIT = 15;

/** Giá trị Premium THẬT mà cây layout phải giao tới đứa con bị gate. */
const EXPECTED_PROBE = [
  "premium",
  EXPECTED_EXPIRES_AT,
  "false",
  `known:${TUTOR_USED}/${PREMIUM_TUTOR_LIMIT}@${EXPECTED_RESETS_AT}`,
  `known:${UPLOAD_USED}/${PREMIUM_UPLOAD_LIMIT}@${EXPECTED_RESETS_AT}`,
].join("|");

/** billing.quota.remaining + billing.quota.resetsAt (en) với used/limit ở trên.
 *
 *  Vế "Resets on …" CÓ MẶT dù mount KHÔNG truyền prop nào: theo UI Spec v1.4
 *  (UI-D17, sửa bởi plan Task 0.3) TutorQuotaNote tự format `tutor.resetsAt`
 *  LẤY TỪ CONTEXT. Ngày được ghi BẰNG CHỮ THẬT chứ không gọi lại
 *  formatDate(EXPECTED_RESETS_AT, …): một vế phải suy từ bộ format sẽ lệch
 *  CÙNG CHIỀU với chính bộ format đó, tức không chứng minh được gì.
 *  26/08/2026 = 2026-08-26T12:00:00.000Z đọc theo Asia/Ho_Chi_Minh. */
const EXPECTED_NOTE = `${TUTOR_USED}/${PREMIUM_TUTOR_LIMIT} tutor hints used this period. Resets on 26/08/2026.`;

// ───────────────────────── Nguồn dữ liệu bị stub ─────────────────────────────

type Row = Record<string, unknown> | null;

const fromCalls: string[] = [];
const eqCalls: Array<[string, unknown]> = [];
const writeSpy = vi.fn();

let subRow: Row;
let profileRow: Row;

function tableStub(data: Row) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      eqCalls.push([column, value]);
      return builder;
    }),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
    insert: writeSpy,
    update: writeSpy,
    upsert: writeSpy,
    delete: writeSpy,
  };
  return builder;
}

const fromSpy = vi.fn((table: string) => {
  fromCalls.push(table);
  if (table === "subscriptions") return tableStub(subRow);
  if (table === "user_profiles") return tableStub(profileRow);
  throw new Error(`layout đọc bảng ngoài dự kiến: ${table}`);
});

/** Số lượt `readEntitlement()` trong một request — ĐO, không phải khẳng định
 *  trên spy của một hàm đã bị mock. Mỗi lượt gọi phát đúng một truy vấn
 *  `subscriptions` (readEntitlement.ts:119-126), nên đếm truy vấn là đếm lượt
 *  gọi. Một `readEntitlement()` thứ hai ở bất kỳ đâu dưới layout hiện ra ở đây
 *  thành 2. */
const readEntitlementCallCount = () => fromCalls.filter((t) => t === "subscriptions").length;

// ───────────────────────────── Đứa con bị gate ───────────────────────────────

const describeQuota = (q: Quota) =>
  q.state === "known" ? `known:${q.used}/${q.limit}@${q.resetsAt}` : "unknown";

const describeEntitlement = (e: Entitlement) =>
  [
    e.plan,
    String(e.expiresAt),
    String(e.inGracePeriod),
    describeQuota(e.tutor),
    describeQuota(e.upload),
  ].join("|");

/** Đọc qua hook THẬT `useEntitlement()`, không qua bất kỳ lớp bọc nào của test.
 *  Nó đứng ở vị trí một `page.tsx` của (layer2) — nghĩa là `children` của
 *  layout, đúng chỗ production đặt mọi component bị gate. */
function EntitlementProbe() {
  const entitlement = useEntitlement();
  return <span data-testid="probe">{describeEntitlement(entitlement)}</span>;
}

async function renderLayer2() {
  // Layout THẬT, không phải lớp bọc cấp sẵn provider: một test tự cấp provider
  // sẽ cấp đúng thứ mà cây production đang thiếu (frontend DD Risk R-12).
  return render(
    await Layer2Layout({
      children: (
        <>
          <EntitlementProbe />
          <TutorQuotaNote />
        </>
      ),
    })
  );
}

/** Đọc nội dung probe. SỰ VẮNG MẶT của probe là một ca ĐỎ, không phải chuỗi
 *  rỗng lặng lẽ: một `?? ""` ở đây làm MỌI khẳng định dựng trên nó xanh trên
 *  một cây render ra RỖNG (một Server Component async lọt vào trên
 *  `#main-content`, một dependency chưa stub suspend, một provider mà children
 *  không bao giờ mount). `getByTestId` ném khi không thấy. */
function probeText(container: HTMLElement): string {
  const probe = within(container).getByTestId("probe");
  const text = probe.textContent;
  if (text === null) throw new Error('probe tồn tại nhưng textContent là null');
  return text;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(NOW_MS));

  fromCalls.length = 0;
  eqCalls.length = 0;
  writeSpy.mockClear();
  fromSpy.mockClear();

  subRow = { expires_at: EXPIRES_AT_PGRST, period_anchor_at: ANCHOR_PGRST };
  profileRow = { created_at: CREATED_AT_PGRST };

  createClientMock.mockReset();
  createClientMock.mockImplementation(async () => ({ from: fromSpy, rpc: writeSpy }));
  getCurrentUserProfileMock.mockReset();
  getCurrentUserProfileMock.mockResolvedValue(USER);

  mgetMock.mockReset();
  mgetMock.mockResolvedValue([TUTOR_USED, UPLOAD_USED]);
  vi.stubEnv("KV_REST_API_URL", "https://x.upstash.io");
  vi.stubEnv("KV_REST_API_TOKEN", "tok");
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

// ═════════════════════════════════════════════════════════════════════════════

describe("(layer2)/layout.tsx — đứa con bị gate KHÔNG nhận FREE_FALLBACK (I1)", () => {
  it("giao đúng giá trị Premium thật, so khớp TOÀN BỘ object", async () => {
    const { container } = await renderLayer2();

    // So khớp từng trường. `.not.toBe(FREE_FALLBACK)` một mình là quá yếu: mọi
    // giá trị sai khác cũng thoả nó.
    expect(probeText(container)).toBe(EXPECTED_PROBE);
  });

  it("giá trị nhận được KHÁC hẳn FREE_FALLBACK — khẳng định mà D005 đặt tên", async () => {
    const { container } = await renderLayer2();

    // Ca này là ca DUY NHẤT mang tên D005, nên nó phải chết trước tiên khi cây
    // không render gì. Một `.not.toBe(FREE_FALLBACK)` trên chuỗi rỗng vẫn XANH:
    // cây rỗng cũng "khác FREE_FALLBACK". Vì thế sự hiện diện của probe được
    // khẳng định TRƯỚC, tách khỏi giá trị của nó.
    expect(container.querySelector('[data-testid="probe"]')).not.toBeNull();

    expect(probeText(container)).not.toBe(describeEntitlement(FREE_FALLBACK));
    expect(probeText(container).startsWith("free|")).toBe(false);
  });

  it("TutorQuotaNote — component bị gate CÓ THẬT — thôi trả null vĩnh viễn (AC-042 nửa render)", async () => {
    const { container } = await renderLayer2();
    const q = within(container);

    // Đây là chế độ hỏng nguyên bản, đọc được bằng mắt: thiếu provider thì
    // `tutor.state === "unknown"` và TutorQuotaNote.tsx:30 trả null cho MỌI
    // người dùng, mãi mãi, trong khi mọi cổng tĩnh vẫn xanh.
    expect(q.getByText(EXPECTED_NOTE)).toBeTruthy();
  });

  it("đọc quyền lợi bằng ĐÚNG user id mà layout vừa phân giải", async () => {
    await renderLayer2();

    expect(eqCalls).toContainEqual(["user_id", USER.id]);
  });
});

describe("(layer2)/layout.tsx — đúng MỘT lượt đọc mỗi request (UI-D1)", () => {
  it("một lượt render với hai component đọc context ⇒ 1 lượt readEntitlement()", async () => {
    await renderLayer2();

    // Không phải "có gọi": một CON SỐ. Route group là anh em (không lồng nhau)
    // nên đúng một layout phân giải mỗi request; thêm một lượt đọc thứ hai là
    // một round-trip thừa nằm sau mỗi lần render.
    expect(readEntitlementCallCount()).toBe(1);
  });

  it("KHÔNG có phép ghi nào phát ra từ đường render", async () => {
    await renderLayer2();

    expect(writeSpy).not.toHaveBeenCalled();
  });
});

/** Bỏ dòng comment. Dùng chung cho ca đọc mã nguồn của layout VÀ ca quét phạm
 *  vi repo — văn xuôi nhắc tên một hàm không phải một lời gọi hàm. */
const codeLines = (src: string) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));

describe("(layer2)/layout.tsx — mã nguồn: không memo hoá, không đường đọc thứ hai", () => {
  const layoutSource = readFileSync(path.join(HERE, "..", "layout.tsx"), "utf8");

  it("KHÔNG có React.cache() — sự vắng mặt đó là một quyết định, không phải sơ suất", () => {
    // entitlement.tsx:11 nói thẳng repo không có `React.cache()` ở bất kỳ đâu.
    // "Đúng một lượt đọc mỗi request" ở đây suy ra từ cách Next phân giải route
    // group, KHÔNG phải từ memo hoá — thêm cache() vào là thay một lập luận
    // đúng bằng một cơ chế không cần thiết.
    const code = codeLines(layoutSource).join("\n");
    expect(/\bcache\s*\(/.test(code)).toBe(false);
  });

  it("gọi readEntitlement() ĐÚNG một lần trong file", () => {
    const calls = codeLines(layoutSource).filter((l) => /\breadEntitlement\s*\(/.test(l));
    expect(calls).toHaveLength(1);
  });
});

// Khẳng định PHẠM VI REPO — đặt ở đúng một chỗ (file này) thay vì nhân đôi sang
// (layer4), vì nó nói về toàn bộ cây chứ không về một route group.
describe("Binding decision ADR-0013 — một phép tính quyền lợi, KHÔNG có đường đọc thứ hai", () => {
  const sourceRoot = path.join(HERE, "..", "..", "..");

  /** Ba layout route group được phép gọi, cộng chính module định nghĩa hàm.
   *  Mọi file khác dưới app/, components/ VÀ lib/ chỉ được đọc context qua
   *  `useEntitlement()`. */
  const ALLOWED = [
    "app/(billing)/layout.tsx",
    "app/(layer2)/layout.tsx",
    "app/(layer4)/layout.tsx",
    "lib/billing/readEntitlement.ts",
  ];

  function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
    }
    return out;
  }

  it("không page/component/helper nào dưới các layout gọi readEntitlement() — họ đọc context", () => {
    // `lib/` PHẢI nằm trong phạm vi quét: một đường đọc thứ hai đặt trong một
    // helper dưới lib/ mà một page import là VÔ HÌNH với cả hai lớp bảo vệ còn
    // lại — vô hình với ca quét (nếu chỉ quét app/ + components/) và vô hình
    // với bộ đếm `subscriptions` lúc chạy, vì bộ đếm đó chỉ quan sát các lời
    // gọi phát ra trong lượt render layout với `children` do test cấp.
    const offenders = walk(path.join(sourceRoot, "app"))
      .concat(walk(path.join(sourceRoot, "components")))
      .concat(walk(path.join(sourceRoot, "lib")))
      // Chỉ xét dòng MÃ: `quota.ts` nhắc tên `readEntitlement()` trong văn xuôi
      // ba lần và không lời nào là một đường đọc.
      .filter((f) => /\breadEntitlement\b/.test(codeLines(readFileSync(f, "utf8")).join("\n")))
      .map((f) => path.relative(sourceRoot, f).split(path.sep).join("/"))
      .filter((rel) => !ALLOWED.includes(rel));

    // Tiền lệ có thật của kiểu trôi này: profile/page.tsx:37 gọi lại
    // getCurrentUserProfile() ngay dưới layout đã gọi nó (backend DD :870).
    expect(offenders).toEqual([]);
  });
});
