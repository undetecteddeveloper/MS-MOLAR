// @vitest-environment jsdom

// Gói Premium [fixture-e2e] — hành trình mua trên CÂY COMPONENT THẬT của tab
// "Gói" (/profile?tab=plans) và trang /pricing/checkout, backend là fixture.
//
// Viết lại 2026-10-25 thay cho bản FE-1/FE-2/FE-3 bị gỡ cùng giao diện billing ở
// f119e86: từ đó /pricing và /me/orders chỉ còn là chuyển hướng về tab Gói,
// TutorQuotaNote nhường chỗ cho dòng báo lượt gợi ý ở màn làm bài (kiểm ở
// ExamPlayer.test.tsx), nên hành trình cũ không còn màn nào để đi.
//
// Ranh giới mock: hai Server Action (`createOrder`, `recheckOrder`) và hai truy
// vấn (`listMyOrders`, `getMyOrder`) — đúng các lời gọi chạm Supabase/payOS.
// Cờ bán `GEMINI_PAID_TIER_ENABLED` đi qua `isPaidTierEnabled()` THẬT (stub env),
// EntitlementProvider, thẻ mua, danh sách đơn, trang thanh toán và nút kiểm tra
// lại đều chạy thật. Thứ test này bắt được mà test component không bắt: mã đơn
// đi lạc giữa các bước (nút mua đẩy sang một URL, trang thanh toán đọc một mã
// khác, nút kiểm tra hỏi payOS về một đơn thứ ba) — từng mảnh tự nó vẫn xanh.
//
// Chuyển khoản thật, webhook payOS và đơn chuyển sang "Đã thanh toán" chỉ kiểm
// được trên prod bằng tiền thật (PROGRESS.md), không thuộc làn này.

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutOrder } from "@/lib/billing/checkoutOrder";
import type { MyOrderRow } from "@/features/billing/queries";
import type { Entitlement } from "@/lib/billing/types";
import { copy, t } from "@/lib/copy";

const m = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  createOrder: vi.fn(),
  recheckOrder: vi.fn(),
  listMyOrders: vi.fn(),
  getMyOrder: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: m.push, refresh: m.refresh }),
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));
vi.mock("@/lib/billing/orderActions", () => ({
  createOrder: m.createOrder,
  recheckOrder: m.recheckOrder,
}));
vi.mock("@/features/billing/queries", () => ({
  listMyOrders: m.listMyOrders,
  getMyOrder: m.getMyOrder,
}));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: m.getCurrentUser }));

import { EntitlementProvider } from "@/lib/billing/entitlement";
import { PlansTab } from "@/features/billing/components/plans/PlansTab";
import CheckoutPage from "@/app/(billing)/pricing/checkout/page";

// ── Dữ liệu fixture ────────────────────────────────────────────────────────────

/** Đơn CŨ đang chờ trong "Lịch sử mua" — mã khác hẳn đơn mới, để một bước đọc
 *  nhầm đơn nào cũng lộ ra. */
const OLD_ORDER: MyOrderRow = {
  orderCode: 1792503843145,
  amountVnd: 39_000,
  status: "pending",
  createdAt: "2026-10-20T13:40:00.000Z",
  pendingUntil: "2026-10-20T14:10:00.000Z",
};

const NEW_ORDER: CheckoutOrder = {
  orderCode: 1792937400001,
  amountVnd: 39_000,
  status: "pending",
  pendingUntil: "2099-01-01T00:30:00.000Z",
  qrPayload: "00020101021238570010A000000727FIXTURE",
  accountNumber: "0123456789",
  accountName: "MS MOLAR FIXTURE",
  memo: "MSM1792937400001",
};

const FREE: Entitlement = {
  plan: "free",
  expiresAt: null,
  inGracePeriod: false,
  tutor: { state: "known", used: 1, limit: 5, resetsAt: "2026-11-24T02:00:00.000Z" },
  upload: { state: "known", used: 0, limit: 3, resetsAt: "2026-11-24T02:00:00.000Z" },
};

async function renderPlansTab() {
  return render(<EntitlementProvider value={FREE}>{await PlansTab()}</EntitlementProvider>);
}

/** `aria-disabled`/`aria-busy` của nút mua ổn định sau khi promise của action
 *  resolve; flush microtask trong act() để React áp các lượt setState đó. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.listMyOrders.mockResolvedValue([OLD_ORDER]);
  m.getCurrentUser.mockResolvedValue({ id: "user-fixture" });
});

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("J1 — người Miễn phí mua Premium: tab Gói → trang chuyển khoản → kiểm tra lại khi chưa trả", () => {
  it("mã đơn đi nguyên vẹn qua ba bước, và một lần kiểm tra chưa trả không đổi gì", async () => {
    vi.stubEnv("GEMINI_PAID_TIER_ENABLED", "true");
    m.createOrder.mockResolvedValue(NEW_ORDER);
    m.getMyOrder.mockImplementation(async (code: number) =>
      code === NEW_ORDER.orderCode ? NEW_ORDER : null
    );
    m.recheckOrder.mockResolvedValue({ settled: false, reason: "not_paid_yet" });

    // ── Bước 1: tab Gói. Đơn cũ nằm trong Lịch sử mua; nút mua dùng được. ──
    const plans = await renderPlansTab();
    expect(plans.container.textContent).toContain(t("billing.orders.title"));
    expect(plans.container.textContent).toContain(String(OLD_ORDER.orderCode));
    const buy = within(plans.container).getByRole("button", { name: copy["billing.cta.buy"] });
    expect(buy.getAttribute("aria-disabled")).toBe("false");

    fireEvent.click(buy);
    await flush();

    expect(m.createOrder).toHaveBeenCalledTimes(1);
    expect(m.push).toHaveBeenCalledTimes(1);
    const pushed = new URL(m.push.mock.calls[0][0] as string, "https://fixture.local");
    expect(pushed.pathname).toBe("/pricing/checkout");
    expect(pushed.searchParams.get("order")).toBe(String(NEW_ORDER.orderCode));
    cleanup();

    // ── Bước 2: trang thanh toán, đọc CHÍNH tham số URL mà bước 1 đẩy sang. ──
    const checkout = render(
      await CheckoutPage({
        searchParams: Promise.resolve({ order: pushed.searchParams.get("order") ?? undefined }),
      })
    );
    expect(m.getMyOrder).toHaveBeenCalledWith(NEW_ORDER.orderCode);
    const text = checkout.container.textContent ?? "";
    expect(text).toContain(t("billing.checkout.title"));
    expect(text).toContain("39.000");
    expect(text).toContain(NEW_ORDER.memo);
    expect(text).toContain(NEW_ORDER.accountNumber);

    const confirm = within(checkout.container).getByRole("button", {
      name: copy["billing.confirm.action"],
    });
    // AC-039: liên kết pháp lý đứng TRƯỚC nút xác nhận trong DOM.
    const legal = within(checkout.container).getByRole("link", { name: /hoàn tiền/i });
    expect(legal.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();

    // ── Bước 3: "Tôi đã chuyển khoản" khi tiền chưa về. ──
    fireEvent.click(confirm);
    await flush();

    expect(m.recheckOrder).toHaveBeenCalledTimes(1);
    expect(m.recheckOrder).toHaveBeenCalledWith(NEW_ORDER.orderCode);
    expect(screen.getByRole("alert").textContent).toBe(t("billing.recheck.stillPending"));
    // Đơn chưa trả: khối chuyển khoản và nút xác nhận vẫn nguyên; trang được làm
    // mới đúng một lần để server đọc lại đơn (ở đây vẫn pending).
    expect(checkout.container.textContent).toContain(NEW_ORDER.memo);
    expect(
      within(checkout.container).getByRole("button", { name: copy["billing.confirm.action"] })
    ).toBe(confirm);
    expect(m.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("J2 — đang tắt bán (cờ false): không tạo được đơn từ giao diện", () => {
  it("nút mua aria-disabled, bấm chỉ hiện lý do, không gọi createOrder", async () => {
    vi.stubEnv("GEMINI_PAID_TIER_ENABLED", "false");

    const plans = await renderPlansTab();
    const buy = within(plans.container).getByRole("button", { name: copy["billing.cta.buy"] });
    expect(buy.getAttribute("aria-disabled")).toBe("true");
    // Không bao giờ `disabled` gốc: nút phải còn trong thứ tự tab để đọc được lý do.
    expect(buy.hasAttribute("disabled")).toBe(false);

    fireEvent.click(buy);
    await flush();

    expect(m.createOrder).not.toHaveBeenCalled();
    expect(m.push).not.toHaveBeenCalled();
    expect(plans.container.textContent).toContain(t("billing.cta.unavailableReason"));
  });

  it("tab mở từ lúc còn bán, server đã tắt: câu 'chưa mở bán', không chuyển trang", async () => {
    vi.stubEnv("GEMINI_PAID_TIER_ENABLED", "true");
    m.createOrder.mockResolvedValue({ error: "not_on_sale" });

    const plans = await renderPlansTab();
    fireEvent.click(within(plans.container).getByRole("button", { name: copy["billing.cta.buy"] }));
    await flush();

    expect(m.createOrder).toHaveBeenCalledTimes(1);
    expect(m.push).not.toHaveBeenCalled();
    expect(plans.container.textContent).toContain(t("billing.cta.unavailableReason"));
  });
});
