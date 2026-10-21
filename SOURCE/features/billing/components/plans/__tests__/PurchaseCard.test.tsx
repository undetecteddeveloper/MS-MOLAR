// @vitest-environment jsdom

// PurchaseCard — thẻ mua của tab Gói: thẻ Premium cho người Miễn phí, thẻ gia hạn
// gọn cho người Premium. Chữ giá và số lượt được ghim bằng chuỗi cố định: đây là lời
// lẽ bán hàng, đổi phải là quyết định có chủ ý.

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

const buttonLabeled = (c: HTMLElement, label: string) =>
  Array.from(c.querySelectorAll("button")).find((b) => b.textContent === label) as HTMLElement;
const buy = (c: HTMLElement) => buttonLabeled(c, "Mua Premium");
const renew = (c: HTMLElement) => buttonLabeled(c, "Gia hạn thêm 30 ngày");

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

describe("người Premium: thẻ gia hạn gọn", () => {
  it("có nút 'Gia hạn thêm 30 ngày', không có nút 'Mua Premium', không còn 'Mua thêm 30 ngày'", () => {
    const { container } = renderCard(true, PREMIUM);
    expect(renew(container)).toBeTruthy();
    expect(buy(container)).toBeUndefined();
    expect(container.textContent).not.toContain("Mua thêm 30 ngày");
  });

  it("không tiêu đề, không danh sách quyền lợi, không viền nhấn; có một dòng giá + cộng dồn", () => {
    const { container } = renderCard(true, PREMIUM);
    expect(container.querySelector("h2")).toBeNull();
    expect(container.querySelector("ul")).toBeNull();
    expect(container.querySelector("section")?.className).not.toContain("ring-primary");
    expect(container.textContent).toContain("39.000 VNĐ, trả trước. Ngày còn lại được cộng dồn.");
  });

  it("là vùng có tên 'Gia hạn thêm 30 ngày'", () => {
    const { container } = renderCard(true, PREMIUM);
    expect(container.querySelector("section")?.getAttribute("aria-label")).toBe(
      "Gia hạn thêm 30 ngày"
    );
  });

  it("cờ tắt → nút gia hạn khoá kèm lý do; cờ bật → dùng được", () => {
    expect(renew(renderCard(true, PREMIUM).container).getAttribute("aria-disabled")).toBe("false");
    cleanup();
    const { container } = renderCard(false, PREMIUM);
    expect(renew(container).getAttribute("aria-disabled")).toBe("true");
    expect(container.textContent).toContain("Premium chưa mở bán");
  });

  it("Điều khoản/Hoàn tiền đứng TRƯỚC nút gia hạn trong DOM (AC-039), không kèm câu dẫn", () => {
    const { container } = renderCard(true, PREMIUM);
    const terms = container.querySelector('a[href="/terms"]') as HTMLElement;
    const refund = container.querySelector('a[href="/refund-policy"]') as HTMLElement;
    const button = renew(container);
    expect(terms.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(refund.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.textContent).not.toContain("Trước khi mua");
  });

  it("đang ân hạn cũng thấy nút gia hạn", () => {
    const { container } = renderCard(true, { ...PREMIUM, inGracePeriod: true });
    expect(renew(container)).toBeTruthy();
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
  it("KHÔNG kèm câu dẫn, và là MỘT bản duy nhất trong DOM (cỡ màn hình đổi chỗ bằng CSS)", () => {
    const { container } = renderCard(true);
    expect(container.querySelectorAll('a[href="/terms"]')).toHaveLength(1);
    expect(container.querySelectorAll('a[href="/refund-policy"]')).toHaveLength(1);
    expect(container.textContent).not.toContain("Trước khi mua");
  });

  it("đứng TRƯỚC nút mua trong DOM (AC-039), dù trên điện thoại nhìn thấy nó SAU nút", () => {
    const { container } = renderCard(true);
    const terms = container.querySelector('a[href="/terms"]') as HTMLElement;
    const refund = container.querySelector('a[href="/refund-policy"]') as HTMLElement;
    const button = buy(container);
    expect(terms.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(refund.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Thứ tự nhìn thấy trên điện thoại: nút (order-3) rồi link (order-4), căn giữa.
    const linksCell = terms.closest("p")?.parentElement as HTMLElement;
    const buttonCell = button.closest("div[class*='order-']") as HTMLElement;
    expect(buttonCell.className).toContain("order-3");
    expect(linksCell.className).toContain("order-4");
    expect(linksCell.className).toContain("text-center");
  });

  it("từ md: góc trên phải (cột 2, hàng 1, căn phải)", () => {
    const { container } = renderCard(true);
    const cell = (container.querySelector('a[href="/terms"]') as HTMLElement).closest("p")
      ?.parentElement as HTMLElement;
    expect(cell.className).toContain("md:col-start-2");
    expect(cell.className).toContain("md:row-start-1");
    expect(cell.className).toContain("md:text-right");
  });
});

describe("thẻ gia hạn: cặp link", () => {
  it("điện thoại: dưới nút, căn giữa; vẫn đứng trước nút trong DOM", () => {
    const { container } = renderCard(true, PREMIUM);
    const terms = container.querySelector('a[href="/terms"]') as HTMLElement;
    const linksCell = terms.closest("p")?.parentElement as HTMLElement;
    const button = renew(container);
    const buttonCell = button.closest("div[class*='order-']") as HTMLElement;
    expect(terms.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(buttonCell.className).toContain("order-2");
    expect(linksCell.className).toContain("order-3");
    expect(linksCell.className).toContain("text-center");
  });
});
