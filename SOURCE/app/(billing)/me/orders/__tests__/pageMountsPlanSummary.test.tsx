// @vitest-environment jsdom

// S-05 `/me/orders` — C-11 `PlanSummary` LÀ MỘT PHẦN CỦA TRANG, không chỉ là
// một component tồn tại trong `_components/`. Plan Task 3.8 (★ điểm nghiệm thu
// sớm của frontend).
//
// UI Spec:  § UI-D11, § Component: `PlanSummary` — C-11 ("A `<dl>` inside a
//           single `BentoCell`, above the order list … C-11 sits OUTSIDE C-07
//           so a user with no orders still sees all four items")
// Design:   docs/design/subscription-frontend-design.md § Main Components —
//           cây thành phần: PageContainer › PageHeader › PlanSummary › OrderList
//
// VÌ SAO FILE NÀY TỒN TẠI. Task 3.7 dựng C-11 và chứng minh nó render đúng
// (PlanSummary.test.tsx), nhưng Target Files của 3.7 KHÔNG có `page.tsx`, nên
// component đó chưa được gắn vào trang: mọi test đều xanh trong khi màn hình
// thật thiếu hẳn bốn giá trị của AC-056. Đó đúng là dạng hỏng mà Task 3.8 sinh
// ra để bắt — "một màn hình nói dối trong khi mọi test đều xanh".
//
// BỐN KHẲNG ĐỊNH, KHÔNG PHẢI MỘT "CÓ XUẤT HIỆN CHỮ NÀO ĐÓ". Một phép thử chỉ
// hỏi "có thấy chữ của C-11 không" vẫn xanh khi C-11 nằm DƯỚI danh sách, khi nó
// được mount HAI lần, hoặc khi nó rơi ra ngoài `PageContainer`. Nên ở đây:
// đếm ĐÚNG MỘT, so THỨ TỰ TÀI LIỆU với `<li>` đầu tiên, và kiểm tra vùng chứa.
//
// MOCK BOUNDARY — giống page.test.tsx: `listMyOrders()`, `getCurrentUser()` và
// lượt đọc cookie bị chặn vì chúng cần request scope. C-11, C-07, C-08, C-09,
// từ điển thật và các formatter thật đều CHẠY THẬT; mock một component thì chỉ
// còn khẳng định được cái mock.
//
// Không có setupFiles trong vitest.config.ts ⇒ không có matcher jest-dom. Cây
// được render qua renderServerTree() vào một container tách rời `document`, nên
// không có gì phải dọn giữa các ca.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { listMyOrdersMock, getCurrentUserMock, redirectMock, cookieGetMock } = vi.hoisted(() => ({
  listMyOrdersMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  redirectMock: vi.fn(),
  cookieGetMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGetMock }) }));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/features/billing/queries", () => ({ listMyOrders: listMyOrdersMock }));

// C-10 (mounted by C-08, one per row) calls `useRouter()`, which throws
// "invariant expected app router to be mounted" outside a real app-router tree.
// Stubbed with the same one-method shape the shipped client-component tests use
// (ProfileCard.test.tsx, DisplayNameEditor.test.tsx); C-10 itself is REAL.
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({ refresh: vi.fn() }),
}));

import MyOrdersPage from "../page";
import { renderServerTree } from "./renderServerTree";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import type { Entitlement } from "@/lib/billing/types";
import { I18nProvider } from "@/lib/i18n/client";

// ── Fixtures ────────────────────────────────────────────────────────────────
// Mỗi con số phân biệt được với mọi con số khác: tutor 2/5 đối với upload 1/15,
// và BA mốc thời gian khác nhau (hết hạn, reset của tutor, reset của upload).
// Hai cột cùng giá trị thì một lần hoán nhầm là VÔ HÌNH.
const PREMIUM_KNOWN: Entitlement = {
  plan: "premium",
  expiresAt: "2026-08-18T17:30:00.000Z", // 19/08/2026 ICT — 17:30Z là 00:30 ICT
  inGracePeriod: false, //                  hôm sau, nên một formatter không ghim
  tutor: { state: "known", used: 2, limit: 5, resetsAt: "2026-09-18T17:30:00.000Z" }, // múi giờ
  upload: { state: "known", used: 1, limit: 15, resetsAt: "2026-10-02T03:00:00.000Z" }, // sẽ lệch NGÀY
};

const ORDER_ROW = {
  orderCode: 5100000000001,
  amountVnd: 39000,
  status: "paid",
  createdAt: "2026-08-10T04:15:00+00:00",
  pendingUntil: "2026-08-10T04:45:00+00:00",
};

/** Trang được bọc ĐÚNG như `(billing)/layout.tsx` bọc `children`: provider là
 *  TỔ TIÊN của phần tử trang. Giá trị thì do test cấp thẳng (layout thật lấy nó
 *  từ `readEntitlement()`), vì thứ đang được chứng minh ở đây là chỗ ĐẶT của
 *  C-11 trong cây trang, không phải đường đọc quyền lợi. */
async function renderPageUnderProvider(entitlement: Entitlement = PREMIUM_KNOWN) {
  return renderServerTree(
    <I18nProvider locale="en">
      <EntitlementProvider value={entitlement}>{await MyOrdersPage()}</EntitlementProvider>
    </I18nProvider>
  );
}

/** Vị trí theo THỨ TỰ TÀI LIỆU. `querySelectorAll("*")` trả về đúng thứ tự đó,
 *  nên so sánh chỉ số là so sánh "ai đứng trước ai" trong cây đã render.
 *  Ném khi một nút không thuộc container — một chỉ số -1 sẽ lặng lẽ làm mọi
 *  phép so sánh "nhỏ hơn" trở thành đúng. */
function documentOrder(container: HTMLElement, nodes: Element[]): number[] {
  const all = [...container.querySelectorAll("*")];
  return nodes.map((node) => {
    const index = all.indexOf(node);
    if (index < 0) throw new Error("node is not inside the rendered container");
    return index;
  });
}

function requireElement(container: HTMLElement | Element, selector: string): Element {
  const found = container.querySelector(selector);
  if (!found) throw new Error(`the page rendered no ${selector}`);
  return found;
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieGetMock.mockReturnValue(undefined); // no locale cookie ⇒ DEFAULT_LOCALE "en"
  redirectMock.mockImplementation((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  });
  getCurrentUserMock.mockResolvedValue({ id: "u-1" });
});

describe("S-05 mounts C-11 PlanSummary between the heading and the list", () => {
  // ==========================================================================
  // Ca 1 — ĐÚNG MỘT C-11, đứng SAU tiêu đề và TRƯỚC dòng đơn đầu tiên, và nằm
  // TRONG PageContainer.
  // Loại bỏ: trang không mount C-11 (đúng trạng thái trước task này); mount nó
  // DƯỚI OrderList; mount HAI lần; mount ngoài `<main>`; mount lọt vào trong
  // `<ul>`/`<li>` của danh sách.
  // ==========================================================================
  it("renders exactly one PlanSummary, after the <h1> and before the first order row", async () => {
    listMyOrdersMock.mockResolvedValue([ORDER_ROW]);

    const { container } = await renderPageUnderProvider();

    // `<dl>` là dấu nhận dạng của C-11 trên màn này: C-07/C-08 không dựng danh
    // sách định nghĩa nào, nên một `<dl>` ở đây chỉ có thể đến từ PlanSummary.
    const summaries = container.querySelectorAll("dl");
    expect(summaries).toHaveLength(1);

    const summary = summaries[0];
    const main = requireElement(container, "main");
    expect(main.contains(summary)).toBe(true);
    expect(summary.closest("ul")).toBeNull();
    expect(summary.closest("li")).toBeNull();

    const heading = requireElement(container, "h1");
    const firstRow = requireElement(container, "li");
    const [headingAt, summaryAt, firstRowAt] = documentOrder(container, [
      heading,
      summary,
      firstRow,
    ]);
    expect(headingAt).toBeLessThan(summaryAt);
    expect(summaryAt).toBeLessThan(firstRowAt);
  });

  // ==========================================================================
  // Ca 2 — C-11 đọc quyền lợi do TỔ TIÊN cấp, chứ không phải FREE_FALLBACK.
  // Loại bỏ: một mount nằm NGOÀI provider (useEntitlement() rơi về
  // FREE_FALLBACK — plan `free`, quota `unknown` — không ném, không cảnh báo,
  // và không phân biệt được với một người dùng Free thật, UI-D11); một mount
  // truyền giá trị cứng; một mount chỉ render nhãn mà không render giá trị.
  // Chuỗi kỳ vọng là chuỗi CỐ ĐỊNH đã duyệt, không phải chuỗi tính lại từ
  // entitlement bằng chính formatter đang được kiểm.
  // ==========================================================================
  it("renders the four AC-056 items from the entitlement supplied above the page", async () => {
    listMyOrdersMock.mockResolvedValue([ORDER_ROW]);

    const { container } = await renderPageUnderProvider();

    const summary = requireElement(container, "dl");
    expect([...summary.querySelectorAll("dt")].map((n) => n.textContent)).toEqual([
      "Current plan",
      "Period resets",
      "Tutor hints",
      "Exam uploads",
    ]);
    expect([...summary.querySelectorAll("dd")].map((n) => n.textContent)).toEqual([
      "Premium · until 19/08/2026",
      "19/09/2026",
      "3 of 5 hints left",
      "14 of 15 uploads left",
    ]);
  });

  // ==========================================================================
  // Ca 3 — không có đơn nào thì C-11 VẪN đứng đó, phía trên hộp rỗng.
  // Loại bỏ: một mount nằm bên trong C-07 (hoặc bên trong nhánh không-rỗng của
  // nó) — chính là lý do UI Spec đặt C-11 NGOÀI C-07: "a user with no orders
  // still sees all four items".
  // ==========================================================================
  it("still renders PlanSummary above the empty-state box when the user has no orders", async () => {
    listMyOrdersMock.mockResolvedValue([]);

    const { container } = await renderPageUnderProvider();

    expect(container.querySelectorAll("li")).toHaveLength(0);
    const summaries = container.querySelectorAll("dl");
    expect(summaries).toHaveLength(1);

    // Liên kết `/pricing` chỉ tồn tại trong hộp rỗng của C-07, nên nó là mốc
    // "danh sách bắt đầu từ đây" khi không có `<li>` nào.
    const emptyBoxLink = requireElement(container, 'a[href="/pricing"]');
    const [summaryAt, emptyBoxAt] = documentOrder(container, [summaries[0], emptyBoxLink]);
    expect(summaryAt).toBeLessThan(emptyBoxAt);
  });
});

// ── Vì sao ba ca trên chưa đủ ────────────────────────────────────────────────
// Ba ca trên tự cấp provider. Trên màn hình thật thì KHÔNG AI cấp cả: provider
// đến từ layout của route group, và `useEntitlement()` ngoài provider trả
// `FREE_FALLBACK` — biên dịch trót lọt, render trót lọt, không một cảnh báo nào
// (UI-D11: "the single most expensive mistake available on this screen, and it
// is invisible"). Ca dưới đây khẳng định đúng cái mà một lượt render không quan
// sát được: TỆP TRANG NÀY nằm dưới một layout có mount provider.
describe("the route group above this page mounts EntitlementProvider", () => {
  const HERE = path.dirname(fileURLToPath(import.meta.url));
  const APP_ROOT = path.join(HERE, "..", "..", "..", ".."); // __tests__ › orders › me › (billing) › app

  it("has exactly one layout mounting EntitlementProvider on the chain, and it is (billing)", () => {
    const pageFile = path.join(HERE, "..", "page.tsx");
    expect(existsSync(pageFile)).toBe(true);

    // Đi NGƯỢC từ thư mục của trang lên `app/`, thu mọi `layout.tsx` — đúng
    // chuỗi layout mà Next lồng quanh trang này.
    const chain: string[] = [];
    for (let dir = path.dirname(pageFile); ; dir = path.dirname(dir)) {
      const layout = path.join(dir, "layout.tsx");
      if (existsSync(layout)) chain.push(layout);
      if (path.resolve(dir) === path.resolve(APP_ROOT)) break;
    }
    expect(chain.length).toBeGreaterThan(0);

    // `<EntitlementProvider` chứ không phải `EntitlementProvider`: cả trang lẫn
    // layout đều NHẮC TÊN provider trong văn xuôi, và một lời nhắc không mount
    // được gì cả.
    //
    // B1 (2026-09-03): các layout route group nay uỷ quyền cho khung dùng chung
    // `components/layout/AppShell.tsx`, và CHÍNH KHUNG mount provider (mặc
    // định), trừ khi layout gọi với `entitlement: false` — (history) là layout duy
    // nhất làm thế. Nên "mount" ở đây = tự viết `<EntitlementProvider` HOẶC gọi
    // `AppShell(` mà không tắt entitlement. Chỉ xét dòng MÃ để một lời nhắc
    // trong comment không được tính là mount.
    const codeOf = (file: string) =>
      readFileSync(file, "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join("\n");
    const mountsProvider = (code: string) =>
      code.includes("<EntitlementProvider") ||
      (/\bAppShell\s*\(/.test(code) && !/entitlement:\s*false/.test(code));
    const mounting = chain
      .filter((file) => mountsProvider(codeOf(file)))
      .map((file) => path.relative(APP_ROOT, file).split(path.sep).join("/"));

    expect(mounting).toEqual(["(billing)/layout.tsx"]);
  });
});
