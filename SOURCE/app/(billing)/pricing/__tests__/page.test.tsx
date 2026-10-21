// @vitest-environment jsdom

// /pricing — bảng giá. Điều phải đúng: (1) cờ mở bán đi từ máy chủ vào nút mua,
// (2) liên kết pháp lý đứng TRƯỚC nút mua trong thứ tự DOM (AC-039), (3) câu
// "không tự gia hạn" luôn hiện (AC-040), (4) trang đọc env lúc render nên phải
// là `force-dynamic` — prerender lúc build sẽ đông cứng giá trị cờ.

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isPaidTierEnabled: vi.fn() }));

vi.mock("@/lib/billing/paidTier", () => ({ isPaidTierEnabled: mocks.isPaidTierEnabled }));
vi.mock("@/lib/billing/orderActions", () => ({ createOrder: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import PricingPage, { dynamic } from "../page";

beforeEach(() => mocks.isPaidTierEnabled.mockReset());
afterEach(cleanup);

async function renderPage() {
  return render(await PricingPage());
}

const buyButton = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("button")).find((b) => b.textContent === "Mua Premium") as HTMLElement;

describe("cấu hình trang", () => {
  it("force-dynamic (cờ mở bán đọc từ env lúc render)", () => {
    expect(dynamic).toBe("force-dynamic");
  });
});

describe("nội dung", () => {
  it("hiện tiêu đề, hai thẻ gói và câu không tự gia hạn", async () => {
    mocks.isPaidTierEnabled.mockReturnValue(true);
    const { container } = await renderPage();
    expect(container.querySelector("h1")?.textContent).toBe("Chọn gói của bạn");
    expect(container.querySelectorAll("section")).toHaveLength(2);
    expect(container.textContent).toContain("Gói này không tự động gia hạn.");
  });

  it("cờ bật → nút mua dùng được; cờ tắt → khoá kèm lý do", async () => {
    mocks.isPaidTierEnabled.mockReturnValue(true);
    expect(buyButton((await renderPage()).container).getAttribute("aria-disabled")).toBe("false");
    cleanup();

    mocks.isPaidTierEnabled.mockReturnValue(false);
    const { container } = await renderPage();
    expect(buyButton(container).getAttribute("aria-disabled")).toBe("true");
    expect(container.textContent).toContain("Premium chưa mở bán");
  });

  it("liên kết Điều khoản và Hoàn tiền đứng TRƯỚC nút mua trong DOM (AC-039)", async () => {
    mocks.isPaidTierEnabled.mockReturnValue(true);
    const { container } = await renderPage();
    const terms = container.querySelector('a[href="/terms"]') as HTMLElement;
    const refund = container.querySelector('a[href="/refund-policy"]') as HTMLElement;
    const buy = buyButton(container);
    expect(terms).toBeTruthy();
    expect(refund).toBeTruthy();
    expect(terms.compareDocumentPosition(buy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(refund.compareDocumentPosition(buy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
