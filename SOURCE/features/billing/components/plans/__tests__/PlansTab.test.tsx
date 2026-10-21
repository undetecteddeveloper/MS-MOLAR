// @vitest-environment jsdom

// PlansTab — nội dung tab "Gói" của /profile. Điều phải đúng: (1) cờ mở bán đi từ
// máy chủ vào nút mua, (2) "Lịch sử mua" hiện đơn đúng thứ tự `listMyOrders()`,
// (3) lượt đọc đơn HỎNG chỉ làm hỏng phần Lịch sử mua — KHÔNG dịch thành "chưa có
// đơn nào" (người đã trả tiền sẽ tưởng đơn biến mất) và không kéo cả tab xuống.

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import type { MyOrderRow } from "@/features/billing/queries";

const mocks = vi.hoisted(() => ({ isPaidTierEnabled: vi.fn(), listMyOrders: vi.fn() }));

vi.mock("@/lib/billing/paidTier", () => ({ isPaidTierEnabled: mocks.isPaidTierEnabled }));
vi.mock("@/features/billing/queries", () => ({ listMyOrders: mocks.listMyOrders }));
vi.mock("@/lib/billing/orderActions", () => ({ createOrder: vi.fn(), recheckOrder: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { PlansTab } from "@/features/billing/components/plans/PlansTab";

const row = (orderCode: number, status = "paid"): MyOrderRow => ({
  orderCode,
  amountVnd: 39000,
  status,
  createdAt: "2026-10-01T03:00:00.000Z",
  pendingUntil: "2026-10-01T03:30:00.000Z",
});

beforeEach(() => {
  mocks.isPaidTierEnabled.mockReset().mockReturnValue(true);
  mocks.listMyOrders.mockReset().mockResolvedValue([]);
});
afterEach(cleanup);

async function renderTab() {
  return render(await PlansTab());
}

const buy = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("button")).find((b) => b.textContent === "Mua Premium") as HTMLElement;

describe("bố cục", () => {
  it("dải gói đang dùng, thẻ mua, rồi Lịch sử mua — theo thứ tự đó", async () => {
    const { container } = await renderTab();
    const names = Array.from(container.querySelectorAll("section")).map(
      (s) => s.getAttribute("aria-label") ?? s.querySelector("h2")?.textContent
    );
    expect(names).toEqual(["Gói đang dùng", "Premium", "Lịch sử mua"]);
  });

  it("người Premium: dải gói, thẻ gia hạn gọn (nút 'Gia hạn thêm 30 ngày'), rồi Lịch sử mua", async () => {
    const { container } = render(
      <EntitlementProvider
        value={{
          plan: "premium",
          expiresAt: "2099-11-30T23:59:59.000Z",
          inGracePeriod: false,
          tutor: { state: "unknown" },
          upload: { state: "unknown" },
        }}
      >
        {await PlansTab()}
      </EntitlementProvider>
    );
    const names = Array.from(container.querySelectorAll("section")).map(
      (s) => s.getAttribute("aria-label") ?? s.querySelector("h2")?.textContent
    );
    expect(names).toEqual(["Gói đang dùng", "Gia hạn thêm 30 ngày", "Lịch sử mua"]);
    expect(buy(container)).toBeUndefined();
    expect(
      Array.from(container.querySelectorAll("button")).some((b) => b.textContent === "Gia hạn thêm 30 ngày")
    ).toBe(true);
  });

  it("cờ bật → nút mua dùng được; cờ tắt → khoá kèm lý do", async () => {
    expect(buy((await renderTab()).container).getAttribute("aria-disabled")).toBe("false");
    cleanup();

    mocks.isPaidTierEnabled.mockReturnValue(false);
    const { container } = await renderTab();
    expect(buy(container).getAttribute("aria-disabled")).toBe("true");
    expect(container.textContent).toContain("Premium chưa mở bán");
  });
});

describe("Lịch sử mua", () => {
  it("chưa có đơn → trạng thái rỗng, không có <ul>", async () => {
    const { container } = await renderTab();
    expect(container.textContent).toContain("Bạn chưa đặt đơn nào.");
    expect(container.querySelector("ul ul, section:last-of-type ul")).toBeNull();
  });

  it("có đơn → mỗi đơn một dòng, giữ nguyên thứ tự listMyOrders()", async () => {
    mocks.listMyOrders.mockResolvedValue([row(30), row(10), row(20)]);
    const { container } = await renderTab();
    const items = Array.from(container.querySelectorAll("section:last-of-type ul > li"));
    const codes = items.map((li) => /Mã đơn (\d+)/.exec(li.textContent ?? "")?.[1]);
    expect(codes).toEqual(["30", "10", "20"]);
    expect(container.textContent).not.toContain("Bạn chưa đặt đơn nào.");
  });

  it("đọc đơn HỎNG → chỉ phần này báo lỗi; dải gói và nút mua vẫn còn; không nói 'chưa đặt đơn'", async () => {
    mocks.listMyOrders.mockRejectedValue(new Error("db down"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = await renderTab();

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      "Chưa tải được danh sách đơn của bạn. Bạn thử lại nhé."
    );
    expect(container.textContent).not.toContain("Bạn chưa đặt đơn nào.");
    expect(buy(container)).toBeTruthy();
    expect(container.textContent).toContain("Gói đang dùng");
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
