// @vitest-environment jsdom

// (authoring)/layout.tsx — EntitlementProvider mount (backend DD D005 / I1, ADR-0013
// § Architecture Impact, UI Spec C-01).
//
// File song sinh với `app/(exams)/__tests__/layout.test.tsx`, và nó phải là hai
// file chứ không phải một: khẳng định ở đây là *route group NÀO mount provider*,
// nên một ca kiểm chung chạy qua một layout duy nhất sẽ xanh trong khi group kia
// vẫn trống. Gỡ provider khỏi đúng một trong hai file phải làm đúng một file test
// đỏ — đó là toàn bộ lý do tồn tại của sự trùng lặp này (Rule of Three không áp
// dụng: đây là hai khẳng định khác nhau về hai file khác nhau).
//
// Khẳng định phạm vi repo ("không page/component nào dưới layout gọi
// readEntitlement()") KHÔNG lặp lại ở đây — nó nói về cả cây, và sống đúng một
// chỗ, trong file (exams).
//
// RANH GIỚI MOCK — giống hệt file (exams): nguồn dữ liệu của `readEntitlement()`
// bị stub, còn `readEntitlement()` và `EntitlementProvider` thì KHÔNG. Một
// provider bị mock sẽ chỉ khẳng định chính cái mock đó.
//
// BẪY: `readEntitlement()` hỏng-ĐÓNG về ĐÚNG `FREE_FALLBACK` — cùng giá trị mà
// một provider KHÔNG mount tạo ra. Nên stub dưới đây dựng một giá trị Premium
// THẬT với hạn mức `known`, và khẳng định so khớp TOÀN BỘ object.
//
// Không có setupFiles ⇒ không có matcher jest-dom; `render()` không tự cleanup.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
vi.mock("next/navigation", () => ({ usePathname: () => "/upload" }));
// SkipLink là async Server Component (`getTranslate()` từ lib/i18n/server). Bộ
// render client của React 19 từ chối component async — nó suspend và CẢ CÂY ra
// rỗng, tức ca kiểm sẽ đỏ vì lý do sai. Giới hạn môi trường jsdom, cùng loại với
// việc phải stub `next/navigation`; SkipLink nằm NGOÀI provider.
vi.mock("@/components/shared/SkipLink", () => ({ SkipLink: () => null }));
vi.mock("@/lib/support/actions", () => ({ submitSupportTicket: vi.fn() }));
vi.mock("@/lib/i18n/actions", () => ({ setLocale: vi.fn() }));
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));

import Layer4Layout from "@/app/(authoring)/layout";
import { TutorQuotaNote } from "@/components/billing/TutorQuotaNote";
import { useEntitlement } from "@/lib/billing/entitlement";
import { FREE_FALLBACK, type Entitlement, type Quota } from "@/lib/billing/types";

// Phân giải theo THƯ MỤC CỦA CHÍNH FILE NÀY, không theo process.cwd() — tiền lệ
// ExplainStepAffordance.test.tsx:399.
const HERE = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────── Số liệu cố định ────────────────────────────────
// CỐ Ý KHÁC bộ số của file (exams): hai file kỳ vọng hai giá trị khác nhau,
// nên một lời sao chép nhầm giữa hai layout không thể xanh ở cả hai chỗ.

const USER = {
  id: "44444444-4444-4444-8444-444444444444",
  email: "uploader@example.com",
  displayName: "Uploader Tester",
  avatarUrl: null,
};

const NOW_MS = Date.UTC(2026, 7, 18, 12, 0, 0); // 2026-08-18T12:00:00.000Z

// Nguồn Supabase trả chuỗi kiểu PostgREST (`+00:00`), KHÔNG phải `Z`.
const EXPIRES_AT_PGRST = "2026-09-02T06:30:00+00:00"; // NOW + 14 ngày 18h30
const ANCHOR_PGRST = "2026-07-25T06:30:00+00:00"; //     NOW − 24 ngày 5h30
const CREATED_AT_PGRST = "2026-02-03T22:41:07.007+00:00";

// Mốc reset (anchor + 30 ngày) CỐ Ý khác hạn gói: 08-24 ≠ 09-02. Hoán đổi hai
// trường là đỏ, không phải xanh.
const EXPECTED_EXPIRES_AT = "2026-09-02T06:30:00.000Z";
const EXPECTED_RESETS_AT = "2026-08-24T06:30:00.000Z";

// Không đối xứng (11 ≠ 4, 500 ≠ 15): một lượt `mget` trả sai thứ tự không sống sót.
const TUTOR_USED = 11;
const UPLOAD_USED = 4;
const PREMIUM_TUTOR_LIMIT = 500;
const PREMIUM_UPLOAD_LIMIT = 15;

const EXPECTED_PROBE = [
  "premium",
  EXPECTED_EXPIRES_AT,
  "false",
  `known:${TUTOR_USED}/${PREMIUM_TUTOR_LIMIT}@${EXPECTED_RESETS_AT}`,
  `known:${UPLOAD_USED}/${PREMIUM_UPLOAD_LIMIT}@${EXPECTED_RESETS_AT}`,
].join("|");

/** billing.quota.remaining (en) với used/limit ở trên.
 *
 *  KHÔNG có vế "Resets on …", và đó là hành vi ĐÚNG chứ không phải thiếu sót:
 *  TutorQuotaNote chỉ in ngày đặt lại khi đã HẾT lượt (`isQuotaExhausted`), còn
 *  fixture ở đây là 11/500 — còn nguyên lượt. Xem TutorQuotaNote.test.tsx cho
 *  cặp ca đối chứng còn-lượt / hết-lượt.
 *
 *  Việc bỏ vế ngày KHÔNG làm yếu file này: `resetsAt` đi tới context vẫn được
 *  khẳng định đầy đủ, và mạnh hơn, ở `EXPECTED_PROBE` (`@${EXPECTED_RESETS_AT}`,
 *  so khớp mốc ISO chính xác thay vì một chuỗi ngày đã format). Vai trò còn lại
 *  của ca dùng hằng này là chứng minh một component ĐÃ SHIP nhận được giá trị
 *  thật — bộ đếm `11/500` (không thể ra từ FREE_FALLBACK) đủ cho điều đó. */
const EXPECTED_NOTE = `${TUTOR_USED}/${PREMIUM_TUTOR_LIMIT} tutor hints used this period.`;

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

/** Số lượt `readEntitlement()` mỗi request — ĐO qua số truy vấn `subscriptions`
 *  (mỗi lượt gọi phát đúng một truy vấn, readEntitlement.ts:119-126), không
 *  phải khẳng định trên spy của một hàm đã bị mock. */
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

/** Đọc qua hook THẬT, ở đúng vị trí một `page.tsx` của (authoring) chiếm giữ. */
function EntitlementProbe() {
  const entitlement = useEntitlement();
  return <span data-testid="probe">{describeEntitlement(entitlement)}</span>;
}

async function renderLayer4() {
  // Layout THẬT. Một lớp bọc tự cấp provider sẽ cấp đúng thứ mà cây production
  // đang thiếu (frontend DD Risk R-12), nên ở đây không có lớp bọc nào.
  //
  // TutorQuotaNote đứng đây với vai trò MỘT COMPONENT `useEntitlement()` CÓ
  // THẬT ĐÃ SHIP — không phải một lời khai rằng nó mount dưới (authoring) trong
  // production (UI Spec C-06 đặt nó ở result-detail của (exams)). Bề mặt bị
  // gate của riêng (authoring) là hạn mức upload, và nó chưa có component nào;
  // trường `upload` vì thế được khẳng định qua probe ở dưới.
  return render(
    await Layer4Layout({
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

describe("(authoring)/layout.tsx — đứa con bị gate KHÔNG nhận FREE_FALLBACK (I1)", () => {
  it("giao đúng giá trị Premium thật, so khớp TOÀN BỘ object", async () => {
    const { container } = await renderLayer4();

    expect(probeText(container)).toBe(EXPECTED_PROBE);
  });

  it("giá trị nhận được KHÁC hẳn FREE_FALLBACK — khẳng định mà D005 đặt tên", async () => {
    const { container } = await renderLayer4();

    // Ca này là ca DUY NHẤT mang tên D005, nên nó phải chết trước tiên khi cây
    // không render gì. Một `.not.toBe(FREE_FALLBACK)` trên chuỗi rỗng vẫn XANH:
    // cây rỗng cũng "khác FREE_FALLBACK". Vì thế sự hiện diện của probe được
    // khẳng định TRƯỚC, tách khỏi giá trị của nó.
    expect(container.querySelector('[data-testid="probe"]')).not.toBeNull();

    expect(probeText(container)).not.toBe(describeEntitlement(FREE_FALLBACK));
    expect(probeText(container).startsWith("free|")).toBe(false);
  });

  it("hạn mức UPLOAD — bề mặt bị gate của chính (authoring) — đọc được là `known`", async () => {
    const { container } = await renderLayer4();

    // Nửa quan trọng của route group này. `unknown` là fail-OPEN nên cổng phía
    // server vẫn chặn trong khi màn hình không cảnh báo gì — đúng chế độ hỏng
    // mà D005 mô tả.
    expect(probeText(container)).toContain(
      `known:${UPLOAD_USED}/${PREMIUM_UPLOAD_LIMIT}@${EXPECTED_RESETS_AT}`
    );
  });

  it("một component useEntitlement() ĐÃ SHIP cũng nhận được giá trị thật", async () => {
    const { container } = await renderLayer4();
    const q = within(container);

    expect(q.getByText(EXPECTED_NOTE)).toBeTruthy();
  });

  it("đọc quyền lợi bằng ĐÚNG user id mà layout vừa phân giải", async () => {
    await renderLayer4();

    expect(eqCalls).toContainEqual(["user_id", USER.id]);
  });
});

describe("(authoring)/layout.tsx — đúng MỘT lượt đọc mỗi request (UI-D1)", () => {
  it("một lượt render với hai component đọc context ⇒ 1 lượt readEntitlement()", async () => {
    await renderLayer4();

    expect(readEntitlementCallCount()).toBe(1);
  });

  it("KHÔNG có phép ghi nào phát ra từ đường render", async () => {
    await renderLayer4();

    expect(writeSpy).not.toHaveBeenCalled();
  });
});

describe("(authoring)/layout.tsx — mã nguồn: không memo hoá, không đường đọc thứ hai", () => {
  const layoutSource = readFileSync(path.join(HERE, "..", "layout.tsx"), "utf8");
  // B1 (2026-09-03): lượt đọc quyền lợi nay sống trong khung dùng chung
  // components/layout/AppShell.tsx; layout chỉ uỷ quyền. Hai ca dưới soi KHUNG,
  // và một ca mới ghim rằng layout không tự mở một đường đọc thứ hai.
  const shellSource = readFileSync(
    path.join(HERE, "..", "..", "..", "components", "layout", "AppShell.tsx"),
    "utf8"
  );

  it("layout.tsx uỷ quyền cho AppShell và KHÔNG tự gọi readEntitlement()", () => {
    const code = codeLines(layoutSource).join("\n");
    expect(/\bAppShell\s*\(/.test(code)).toBe(true);
    expect(/\breadEntitlement\s*\(/.test(code)).toBe(false);
  });

  const codeLines = (src: string) => src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));

  it("KHÔNG có React.cache() — sự vắng mặt đó là một quyết định, không phải sơ suất", () => {
    const code = codeLines(shellSource).join("\n");
    expect(/\bcache\s*\(/.test(code)).toBe(false);
  });

  it("AppShell gọi readEntitlement() ĐÚNG một lần trong file", () => {
    const calls = codeLines(shellSource).filter((l) => /\breadEntitlement\s*\(/.test(l));
    expect(calls).toHaveLength(1);
  });
});
