// @vitest-environment jsdom

// /pricing/checkout?order=<mã> — màn thanh toán.
//
// Ba điều phải đúng:
//   1. Chốt đăng nhập chạy TRƯỚC mọi lượt đọc đơn.
//   2. Bốn nguyên nhân (thiếu ?order=, mã sai dạng, mã không tồn tại, mã của
//      người khác) ra CÙNG một trạng thái rỗng — trả lời khác nhau là xác nhận
//      đơn của người khác có thật.
//   3. Mã đơn là danh sách chấp nhận, không phải phân tích: "123abc" KHÔNG thành 123.

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckoutOrder } from "@/lib/billing/checkoutOrder";

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getMyOrder: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/features/billing/queries", () => ({ getMyOrder: mocks.getMyOrder }));
vi.mock("@/lib/billing/orderActions", () => ({ recheckOrder: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ refresh: vi.fn() }),
}));

import CheckoutPage, { metadata } from "../page";

const ORDER: CheckoutOrder = {
  orderCode: 987654,
  amountVnd: 39000,
  status: "pending",
  pendingUntil: "2099-11-30T23:59:59.000Z",
  qrPayload: "00020101",
  accountNumber: "1903123456",
  accountName: "NGUYEN VAN A",
  memo: "MSMOLAR 987654",
};

beforeEach(() => {
  mocks.getCurrentUser.mockReset().mockResolvedValue({ id: "u1" });
  mocks.getMyOrder.mockReset().mockResolvedValue(ORDER);
  mocks.redirect.mockClear();
});
afterEach(cleanup);

async function renderPage(order?: string | string[]) {
  const ui = await CheckoutPage({ searchParams: Promise.resolve(order === undefined ? {} : { order }) });
  return render(ui);
}

const EMPTY = "Hiện không có lệnh thanh toán nào đang chờ.";

describe("chốt đăng nhập", () => {
  it("chưa đăng nhập → chuyển về form đăng nhập và KHÔNG đọc đơn", async () => {
    mocks.getCurrentUser.mockResolvedValue(null);
    await expect(renderPage("987654")).rejects.toThrow("NEXT_REDIRECT:/?auth=signin");
    expect(mocks.getMyOrder).not.toHaveBeenCalled();
  });
});

describe("mã đơn trên URL", () => {
  it("hợp lệ → đọc đơn bằng đúng số đó", async () => {
    await renderPage("987654");
    expect(mocks.getMyOrder).toHaveBeenCalledExactlyOnceWith(987654);
  });

  it.each([
    ["thiếu", undefined],
    ["rỗng", ""],
    ["chữ", "abc"],
    ["số kèm chữ ('123abc' không được thành 123)", "123abc"],
    ["số âm", "-5"],
    ["số thập phân", "1.5"],
    ["không", "0"],
    ["có khoảng trắng", " 12"],
    ["vượt giới hạn số nguyên an toàn", "9007199254740993"],
    ["mảng (?order=1&order=2)", ["1", "2"]],
  ])("%s → không đọc đơn, hiện trạng thái rỗng", async (_name, raw) => {
    const { container } = await renderPage(raw as string | string[] | undefined);
    expect(mocks.getMyOrder).not.toHaveBeenCalled();
    expect(container.textContent).toContain(EMPTY);
  });

  it("mã không tồn tại / của người khác (getMyOrder trả null) → CÙNG trạng thái rỗng", async () => {
    mocks.getMyOrder.mockResolvedValue(null);
    const { container } = await renderPage("987654");
    expect(container.textContent).toContain(EMPTY);
    expect(container.querySelector('a[href="/profile?tab=plans"]')?.textContent).toBe("Xem các gói");
    expect(container.textContent).not.toContain("1903123456");
  });

  it("đọc đơn HỎNG thì lỗi lan ra (tới error.tsx), không bị dịch thành 'không có đơn'", async () => {
    mocks.getMyOrder.mockRejectedValue(new Error("db down"));
    await expect(renderPage("987654")).rejects.toThrow("db down");
  });
});

describe("đơn đang chờ trả", () => {
  it("hiện khối chuyển khoản, liên kết pháp lý rồi nút xác nhận — pháp lý đứng TRƯỚC nút (AC-039)", async () => {
    const { container } = await renderPage("987654");
    expect(container.textContent).toContain("1903123456");
    const terms = container.querySelector('a[href="/terms"]') as HTMLElement;
    const confirm = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Tôi đã chuyển khoản")
    ) as HTMLElement;
    expect(terms).toBeTruthy();
    expect(confirm).toBeTruthy();
    expect(terms.compareDocumentPosition(confirm) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Nội dung pháp lý đã có trong copy → nút xác nhận hoạt động.
    expect(confirm.getAttribute("aria-disabled")).toBe("false");
  });
});

describe("đơn không còn nhận tiền", () => {
  it.each(["paid", "expired", "cancelled", "refunded"])(
    "%s: KHÔNG có nút xác nhận chuyển khoản và KHÔNG bày tài khoản nhận tiền",
    async (status) => {
      mocks.getMyOrder.mockResolvedValue({ ...ORDER, status });
      const { container } = await renderPage("987654");
      expect(container.textContent).not.toContain("1903123456");
      expect(container.textContent).not.toContain("Tôi đã chuyển khoản");
      expect(container.querySelector('a[href="/terms"]')).toBeNull();
      expect(container.querySelector('a[href="/profile?tab=plans"]')).not.toBeNull();
    }
  );
});

describe("metadata", () => {
  it("tiêu đề tab", () => {
    expect(metadata.title).toBe("Thanh toán");
  });
});
