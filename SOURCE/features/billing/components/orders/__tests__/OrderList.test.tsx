// @vitest-environment jsdom

// OrderList — danh sách đơn của chính người dùng. KHÔNG tự sắp xếp hay lọc: thứ
// tự thuộc về listMyOrders() (SQL, mới nhất trước); danh sách chứng từ thanh toán
// không được giấu đơn cũ.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MyOrderRow } from "@/features/billing/queries";

vi.mock("@/lib/billing/orderActions", () => ({ recheckOrder: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/billing/queries", () => ({}));

import { OrderList } from "@/features/billing/components/orders/OrderList";

afterEach(cleanup);

const row = (orderCode: number, status = "paid"): MyOrderRow => ({
  orderCode,
  amountVnd: 39000,
  status,
  createdAt: "2026-10-01T03:00:00.000Z",
  pendingUntil: "2026-10-01T03:30:00.000Z",
});

describe("danh sách rỗng", () => {
  it("hiện trạng thái rỗng kèm đường sang bảng giá, không có <ul>", () => {
    const { container } = render(<OrderList orders={[]} />);
    expect(container.querySelector("h2")?.textContent).toBe("Bạn chưa đặt đơn nào.");
    expect(container.textContent).toContain("Đơn sẽ hiện ở đây ngay khi bạn mua một kỳ Premium.");
    expect(container.querySelector("ul")).toBeNull();
    expect(container.querySelector('a[href="/pricing"]')?.textContent).toBe("Xem các gói");
  });
});

describe("có đơn", () => {
  it("mỗi đơn một dòng, GIỮ NGUYÊN thứ tự đầu vào (không tự sắp xếp)", () => {
    const { container } = render(<OrderList orders={[row(30), row(10), row(20)]} />);
    const items = Array.from(container.querySelectorAll("ul > li"));
    expect(items).toHaveLength(3);
    const codes = items.map((li) => /Mã đơn (\d+)/.exec(li.textContent ?? "")?.[1]);
    expect(codes).toEqual(["30", "10", "20"]);
  });

  it("không hiện trạng thái rỗng và không giới hạn số dòng (không giấu đơn cũ)", () => {
    const orders = Array.from({ length: 40 }, (_, i) => row(1000 + i));
    const { container } = render(<OrderList orders={orders} />);
    expect(container.querySelectorAll("ul > li")).toHaveLength(40);
    expect(container.textContent).not.toContain("Bạn chưa đặt đơn nào.");
    expect(container.querySelector("h2")).toBeNull();
  });
});
