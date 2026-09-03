// @vitest-environment jsdom

// S-06 composition — plan Task 4.3.
// UI Spec:  docs/ui-spec/subscription-ui-spec.md § Screen tree (S-06), C-13, C-15
// Design:   docs/design/subscription-frontend-design.md § Main Components,
//           § Affordances, FE-AC-17 / FE-AC-19 / FE-AC-20
//
// Task 4.2's `page.test.tsx` owns the `?order=` accept-list and the byte-identity
// of the four Empty causes; this file owns what the page now MOUNTS around that
// decision, and nothing in it re-litigates the parse.
//
// AC-039 IS READING ORDER, NOT A VISUAL ARRANGEMENT. So the links-before-control
// claim is asserted with `compareDocumentPosition` on the real rendered tree —
// a CSS-order or flex-order arrangement would satisfy a screenshot and fail
// here, which is the point.

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { getMyOrderMock, getCurrentUserMock, redirectMock, cookieGetMock } = vi.hoisted(() => ({
  getMyOrderMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  redirectMock: vi.fn(),
  cookieGetMock: vi.fn(),
}));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: cookieGetMock }) }));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/features/billing/queries", () => ({ getMyOrder: getMyOrderMock }));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: vi.fn(),
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { renderServerTree } from "@/app/(billing)/me/orders/__tests__/renderServerTree";
import type { CheckoutOrder } from "@/lib/billing/checkoutOrder";
import { en } from "@/lib/i18n/dictionaries/en";
import CheckoutPage from "../page";

const ORDER: CheckoutOrder = {
  orderCode: 3100000000002,
  amountVnd: 39000,
  status: "pending",
  pendingUntil: "2026-08-18T17:30:00.000Z",
  qrPayload: "00020101021238QRPAYLOAD5802VN",
  accountNumber: "19001234567890",
  accountName: "CONG TY MS MOLAR",
  memo: "MSMOLAR3100000000002",
};

async function renderPage(order: CheckoutOrder | null) {
  getMyOrderMock.mockResolvedValue(order);
  const searchParams = Promise.resolve({ order: "3100000000002" });
  const { container } = await renderServerTree(await CheckoutPage({ searchParams }));
  return { container, text: container.textContent ?? "" };
}

beforeEach(() => {
  vi.clearAllMocks();
  cookieGetMock.mockReturnValue(undefined); // no locale cookie ⇒ DEFAULT_LOCALE "en"
  getCurrentUserMock.mockResolvedValue({ id: "u-1" });
});

describe("S-06 — a pending order", () => {
  // ==========================================================================
  // The page really mounts C-13 now, and C-13 really carries the payment path.
  // Rejects: the Task 4.2 placeholder left in place (an order code and nothing
  // a user could pay with).
  // ==========================================================================
  it("mounts the payment panel with the whole transfer block", async () => {
    const { text } = await renderPage(ORDER);

    for (const value of ["19001234567890", "CONG TY MS MOLAR", "39,000 VND", "MSMOLAR3100000000002"]) {
      expect(text).toContain(value);
    }
    expect(text).toContain("3100000000002");
    expect(text).toContain(en["billing.checkout.title"]);
  });

  // ==========================================================================
  // FE-AC-17 / AC-039. Rejects: links rendered AFTER the control; links copied
  // into a second component instead of reusing C-04b (the hrefs prove which
  // file rendered them only in the sense that both must be present and both
  // must precede — a second copy would still have to satisfy this, which is
  // why the scope-boundary claim is carried by the diff, not by this case).
  // ==========================================================================
  it("puts both legal links before the confirm control in DOM order", async () => {
    const { container } = await renderPage(ORDER);

    const terms = container.querySelector('a[href="/terms"]');
    const refund = container.querySelector('a[href="/refund-policy"]');
    const control = container.querySelector("button");
    if (terms === null || refund === null) throw new Error("a legal link is missing from S-06");
    if (control === null) throw new Error("S-06 rendered no confirm control");

    // DOCUMENT_POSITION_FOLLOWING === 4: the control comes AFTER each link.
    expect(terms.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4);
    expect(refund.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(4);
  });

  // ==========================================================================
  // The gate as the page ships it TODAY — và hôm nay nó MỞ: nội dung pháp lý
  // thật đã hạ cánh (BU-1), nên C-15 mount C-10 và nút thao tác được.
  //
  // Ca này trước đây khẳng định chiều ngược lại (nút trơ + câu lý do pháp lý).
  // Nó KHÔNG bị xoá, nó bị LẬT: vẫn đúng một khẳng định về việc trang truyền
  // prop THẬT cho C-15 chứ không phải một hằng. Rejects: một trang hardcode
  // `false` (nút trơ trong khi hai trang pháp lý đã có nội dung), một trang
  // quên prop, và — như trước — bất kỳ `disabled` gốc nào.
  //
  // NOTE: ca kết hợp "vị từ đúng VÀ hai trang pháp lý render nội dung thật" là
  // của plan Task 4.5, cố ý không nhân bản ở đây.
  // ==========================================================================
  it("ships the confirm control operable, with no legal-pending reason", async () => {
    const { container, text } = await renderPage(ORDER);

    const control = container.querySelector("button");
    if (control === null) throw new Error("S-06 rendered no confirm control");
    // Chuỗi "false", không phải thiếu thuộc tính: C-10 luôn KHAI BÁO trạng thái.
    expect(control.getAttribute("aria-disabled")).toBe("false");
    // Bất biến không đổi theo cổng: không bao giờ `disabled` gốc.
    expect(control.hasAttribute("disabled")).toBe(false);
    expect(text).not.toContain(en["billing.confirm.legalPending.reason"]);
  });
});

describe("S-06 — a non-payable order", () => {
  // ==========================================================================
  // FE-AC-19 + the frontend DD's affordance table: the confirm control is gated
  // on `status === "pending"` and on nothing else. Rejects: a page that keeps
  // offering "I have transferred — check now" beside a settled order, which is
  // an invitation to pay twice.
  // ==========================================================================
  for (const status of ["paid", "expired", "cancelled", "refunded"]) {
    it(`renders no confirm control and no legal links for "${status}"`, async () => {
      const { container, text } = await renderPage({ ...ORDER, status });

      expect(text).not.toContain(en["billing.confirm.action"]);
      expect(text).not.toContain(en["billing.confirm.legalPending.reason"]);
      expect(container.querySelector('a[href="/terms"]')).toBeNull();
      expect(container.querySelector('a[href="/refund-policy"]')).toBeNull();

      // …but the way onward is still there.
      expect(container.querySelector('a[href="/me/orders"]')).not.toBeNull();
    });
  }
});

describe("S-06 — the Empty state", () => {
  // ==========================================================================
  // Rejects: an Empty state that is a bare link with no sentence — a user who
  // arrives from a stale bookmark is told nothing about why the screen is
  // empty. The sentence must sit BEFORE the link (it explains it).
  // ==========================================================================
  it("states that no payment is in progress, above the way back to /pricing", async () => {
    const { container, text } = await renderPage(null);

    expect(text).toContain(en["billing.checkout.noActiveOrder"]);

    const back = container.querySelector('a[href="/pricing"]');
    if (back === null) throw new Error("the Empty state offers no link back to /pricing");
    const sentenceIndex = text.indexOf(en["billing.checkout.noActiveOrder"]);
    const linkIndex = text.indexOf((back.textContent ?? "").trim());
    expect(sentenceIndex).toBeGreaterThanOrEqual(0);
    expect(sentenceIndex).toBeLessThan(linkIndex);

    // Empty is not an error surface, and it offers nothing to pay.
    expect(container.querySelectorAll("[role='alert']")).toHaveLength(0);
    expect(container.querySelectorAll("dl")).toHaveLength(0);
    expect(text).not.toContain(en["billing.confirm.action"]);
  });
});
