// @vitest-environment jsdom

// OrderRow — một đơn thanh toán trong /me/orders.
//
// Hai luật đáng ghim: (1) nút hỏi lại có ở MỌI dòng, mọi trạng thái ("đơn trông
// như hết hạn vẫn có thể đã được trả" là lý do nút tồn tại); (2) "Tiếp tục thanh
// toán" chỉ hiện khi `pending` VÀ mốc `pendingUntil` của dòng còn ở tương lai.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MyOrderRow } from "@/features/billing/queries";
import { formatDateTime } from "@/lib/format/datetime";

vi.mock("@/lib/billing/orderActions", () => ({ recheckOrder: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
// queries.ts import "server-only"; OrderRow chỉ cần kiểu nên không nạp thật.
vi.mock("@/features/billing/queries", () => ({}));

import { OrderRow } from "@/features/billing/components/orders/OrderRow";

afterEach(cleanup);

const FUTURE = "2099-11-30T23:59:59.000Z";
const PAST = "2000-01-01T00:00:00.000Z";

const ORDER: MyOrderRow = {
  orderCode: 987654,
  amountVnd: 39000,
  status: "pending",
  createdAt: "2026-10-01T03:00:00.000Z",
  pendingUntil: FUTURE,
};

function renderRow(overrides: Partial<MyOrderRow> = {}) {
  // OrderRow là <li>: bọc <ul> cho DOM hợp lệ.
  return render(
    <ul>
      <OrderRow order={{ ...ORDER, ...overrides }} />
    </ul>
  );
}

const continueLink = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("a")).find((a) => a.textContent === "Tiếp tục thanh toán");

describe("nội dung dòng", () => {
  it("số tiền, nhãn trạng thái, thời điểm tạo và mã đơn nguyên si", () => {
    const { container } = renderRow();
    const text = container.textContent ?? "";
    expect(text).toContain("39.000 VNĐ");
    expect(text).toContain("Chờ thanh toán");
    expect(text).toContain(`Tạo lúc ${formatDateTime(ORDER.createdAt)}`);
    expect(text).toContain("Mã đơn 987654");
    expect(text).not.toContain("987.654");
  });

  it("là một <li>", () => {
    const { container } = renderRow();
    expect(container.querySelector("ul > li")).not.toBeNull();
  });
});

describe("nút hỏi lại có ở mọi dòng, mọi trạng thái", () => {
  it.each(["pending", "paid", "expired", "cancelled", "refunded"])("%s", (status) => {
    const { container } = renderRow({ status });
    const buttons = container.querySelectorAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain("Kiểm tra lại đơn này");
  });
});

describe("'Tiếp tục thanh toán'", () => {
  it("pending + hạn còn ở tương lai → có, trỏ đúng đơn", () => {
    const { container } = renderRow();
    expect(continueLink(container)?.getAttribute("href")).toBe("/pricing/checkout?order=987654");
  });

  it("pending nhưng hạn đã qua → không có (dù nút hỏi lại vẫn còn)", () => {
    const { container } = renderRow({ pendingUntil: PAST });
    expect(continueLink(container)).toBeUndefined();
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });

  it("pendingUntil không đọc được → coi như hết hạn, không mời trả tiền", () => {
    const { container } = renderRow({ pendingUntil: "không phải ngày" });
    expect(continueLink(container)).toBeUndefined();
  });

  it.each(["paid", "expired", "cancelled", "refunded"])(
    "%s dù hạn còn xa → không mời trả tiền lần hai",
    (status) => {
      const { container } = renderRow({ status, pendingUntil: FUTURE });
      expect(continueLink(container)).toBeUndefined();
    }
  );
});

describe("bố cục gọn (2026-10-21)", () => {
  it("thẻ dùng đệm gọn và khoảng cách hẹp, không còn gap-4 + p-4 như trước", () => {
    const { container } = renderRow();
    const card = container.querySelector("li") as HTMLElement;
    expect(card.className).toContain("p-3");
    expect(card.className).toContain("gap-2");
    expect(card.className).not.toContain("gap-4 ");
  });

  it("nút 'Kiểm tra lại đơn này' nằm trong khối căn PHẢI ở mọi cỡ", () => {
    const { container } = renderRow();
    const button = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Kiểm tra lại đơn này")
    ) as HTMLElement;
    const actions = button.closest("div[class*='justify-end']") as HTMLElement;
    expect(actions).not.toBeNull();
    expect(actions.className).toContain("justify-end");
  });

  it("thông tin ngày + mã đơn dùng chữ nhỏ trên điện thoại (xs), lớn dần từ sm", () => {
    const { container } = renderRow();
    const meta = Array.from(container.querySelectorAll("p")).find((p) =>
      p.textContent?.includes("Mã đơn")
    ) as HTMLElement;
    expect(meta.className).toContain("text-xs");
    expect(meta.className).toContain("sm:text-sm");
  });
});
