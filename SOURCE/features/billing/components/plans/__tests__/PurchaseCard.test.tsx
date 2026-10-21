// @vitest-environment jsdom

// PurchaseCard — thẻ Premium của tab Gói, CHỈ cho người Miễn phí. Chữ giá và số lượt
// được ghim bằng chuỗi cố định: đây là lời lẽ bán hàng, đổi phải là quyết định có
// chủ ý.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import type { Entitlement } from "@/lib/billing/types";
import { PurchaseCard } from "@/features/billing/components/plans/PurchaseCard";

vi.mock("@/lib/billing/orderActions", () => ({ createOrder: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

const PREMIUM: Entitlement = {
  plan: "premium",
  expiresAt: "2099-11-30T23:59:59.000Z",
  inGracePeriod: false,
  tutor: { state: "unknown" },
  upload: { state: "unknown" },
};

function renderCard(canPurchase: boolean, value?: Entitlement) {
  const ui = <PurchaseCard canPurchase={canPurchase} />;
  return render(value ? <EntitlementProvider value={value}>{ui}</EntitlementProvider> : ui);
}

const buy = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("button")).find((b) => b.textContent === "Mua Premium") as HTMLElement;

describe("người Miễn phí: thẻ Premium", () => {
  it("ghim tên, giá, kỳ hạn và ba dòng quyền lợi", () => {
    const { container } = renderCard(true);
    expect(container.querySelector("h2")?.textContent).toBe("Premium");
    expect(container.textContent).toContain("39.000 VNĐ");
    expect(container.textContent).toContain("mỗi 30 ngày, trả trước");
    const lines = Array.from(container.querySelectorAll("li")).map((li) => li.textContent);
    expect(lines).toEqual([
      "500 lượt gia sư mỗi 30 ngày",
      "15 lượt tải đề mỗi 30 ngày",
      "Mua sớm được cộng dồn ngày còn lại",
    ]);
  });

  it("câu 'không tự gia hạn' luôn hiện (AC-040)", () => {
    const { container } = renderCard(true);
    expect(container.textContent).toContain("Không tự gia hạn, không lưu thẻ.");
  });

  it("có viền nhấn, và KHÔNG có thẻ Miễn phí đặt cạnh", () => {
    const { container } = renderCard(true);
    expect(container.querySelectorAll("section")).toHaveLength(1);
    expect(container.querySelector("section")?.className).toContain("ring-primary");
    expect(container.textContent).not.toContain("Miễn phí");
  });
});

describe("người Premium", () => {
  it("không có thẻ mua nào: không còn 'Mua thêm 30 ngày', không nút mua", () => {
    const { container } = renderCard(true, PREMIUM);
    expect(container.firstChild).toBeNull();
    expect(container.textContent).not.toContain("Mua thêm 30 ngày");
  });
});

describe("nút mua", () => {
  it("cờ bật → nút dùng được; cờ tắt → khoá kèm lý do", () => {
    expect(buy(renderCard(true).container).getAttribute("aria-disabled")).toBe("false");
    cleanup();

    const { container } = renderCard(false);
    expect(buy(container).getAttribute("aria-disabled")).toBe("true");
    expect(container.textContent).toContain("Premium chưa mở bán");
  });
});

describe("cặp link Điều khoản / Hoàn tiền", () => {
  it("nằm ở hàng tiêu đề (góc trên phải), không kèm câu dẫn", () => {
    const { container } = renderCard(true);
    const header = container.querySelector("h2")?.parentElement as HTMLElement;
    expect(header.contains(container.querySelector('a[href="/terms"]'))).toBe(true);
    expect(header.contains(container.querySelector('a[href="/refund-policy"]'))).toBe(true);
    expect(header.className).toContain("justify-between");
    expect(container.textContent).not.toContain("Trước khi mua");
  });

  it("đứng TRƯỚC nút mua trong DOM (AC-039)", () => {
    const { container } = renderCard(true);
    const terms = container.querySelector('a[href="/terms"]') as HTMLElement;
    const refund = container.querySelector('a[href="/refund-policy"]') as HTMLElement;
    const button = buy(container);
    expect(terms.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(refund.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
