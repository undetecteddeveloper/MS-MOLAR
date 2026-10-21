// @vitest-environment jsdom

// /me/orders — đơn hàng của tôi. Chốt đăng nhập chạy TRƯỚC mọi lượt đọc; lượt đọc
// HỎNG thì lỗi lan tới error.tsx, không được dịch thành "bạn chưa có đơn nào"
// (người đã trả tiền sẽ tưởng đơn của mình biến mất).

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MyOrderRow } from "@/features/billing/queries";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  listMyOrders: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/features/billing/queries", () => ({ listMyOrders: mocks.listMyOrders }));
vi.mock("@/lib/billing/orderActions", () => ({ recheckOrder: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ refresh: vi.fn() }),
}));

import MyOrdersPage, { metadata } from "../page";

const row = (orderCode: number, status = "paid"): MyOrderRow => ({
  orderCode,
  amountVnd: 39000,
  status,
  createdAt: "2026-10-01T03:00:00.000Z",
  pendingUntil: "2026-10-01T03:30:00.000Z",
});

beforeEach(() => {
  mocks.getCurrentUser.mockReset().mockResolvedValue({ id: "u1" });
  mocks.listMyOrders.mockReset().mockResolvedValue([]);
  mocks.redirect.mockClear();
});
afterEach(cleanup);

async function renderPage() {
  return render(await MyOrdersPage());
}

describe("chốt đăng nhập", () => {
  it("chưa đăng nhập → chuyển về form đăng nhập và KHÔNG đọc danh sách đơn", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(renderPage()).rejects.toThrow("NEXT_REDIRECT:/?auth=signin");
    expect(mocks.listMyOrders).not.toHaveBeenCalled();
  });
});

describe("nội dung", () => {
  it("có tiêu đề, nút sang bảng giá, tóm tắt gói và danh sách đơn", async () => {
    mocks.listMyOrders.mockResolvedValue([row(2), row(1)]);
    const { container } = await renderPage();
    expect(container.querySelector("h1")?.textContent).toBe("Đơn hàng của bạn");
    expect(container.querySelector('a[href="/pricing"]')?.textContent).toBe("Xem các gói");
    expect(container.textContent).toContain("Gói hiện tại");
    expect(container.querySelectorAll("ul > li")).toHaveLength(2);
  });

  it("chưa có đơn → trạng thái rỗng (nhưng vẫn có tóm tắt gói)", async () => {
    const { container } = await renderPage();
    expect(container.textContent).toContain("Bạn chưa đặt đơn nào.");
    expect(container.textContent).toContain("Gói hiện tại");
  });

  it("đọc danh sách HỎNG thì lỗi lan ra, không hiện 'chưa đặt đơn nào'", async () => {
    mocks.listMyOrders.mockRejectedValue(new Error("db down"));
    await expect(renderPage()).rejects.toThrow("db down");
  });
});

describe("metadata", () => {
  it("tiêu đề tab", () => {
    expect(metadata.title).toBe("Đơn hàng của tôi");
  });
});
