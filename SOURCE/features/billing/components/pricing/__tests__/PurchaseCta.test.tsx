// @vitest-environment jsdom

// PurchaseCta — nút "Mua Premium".
//
// Phải đúng: (1) khi chưa mở bán, bấm KHÔNG tạo đơn và có lý do đọc được qua
// aria-describedby; (2) chỉ điều hướng sang màn thanh toán KHI đơn đã tạo xong,
// không bao giờ lạc quan; (3) bấm đôi chỉ tạo một đơn; (4) lỗi ném ra không lộ
// nội dung.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "@/lib/copy";

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/billing/orderActions", () => ({ createOrder: mocks.createOrder }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));

import { PurchaseCta } from "@/features/billing/components/pricing/PurchaseCta";

beforeEach(() => {
  mocks.createOrder.mockReset();
  mocks.push.mockReset();
});
afterEach(cleanup);

async function click(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}

const CREATED = {
  orderCode: 987654,
  amountVnd: 39000,
  status: "pending",
  pendingUntil: "2099-11-30T23:59:59.000Z",
  qrPayload: "00020101",
  accountNumber: "1",
  accountName: "A",
  memo: "M",
};

describe("khi đã mở bán", () => {
  it("nhãn 'Mua Premium', không bị khoá, không hiện lý do", () => {
    render(<PurchaseCta canPurchase />);
    const button = screen.getByRole("button");
    expect(button.textContent).toBe("Mua Premium");
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(button.getAttribute("aria-describedby")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("tạo đơn xong mới chuyển sang màn thanh toán đúng mã đơn", async () => {
    mocks.createOrder.mockResolvedValue(CREATED);
    render(<PurchaseCta canPurchase />);
    await click(screen.getByRole("button"));
    expect(mocks.createOrder).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/pricing/checkout?order=987654");
  });

  it("không chuyển trang trong lúc đơn còn đang được tạo", async () => {
    let resolve!: (value: unknown) => void;
    mocks.createOrder.mockReturnValue(new Promise((r) => (resolve = r)));
    render(<PurchaseCta canPurchase />);
    const button = screen.getByRole("button");
    await click(button);
    expect(mocks.push).not.toHaveBeenCalled();
    expect(button.getAttribute("aria-busy")).toBe("true");

    await act(async () => resolve(CREATED));
    expect(mocks.push).toHaveBeenCalledTimes(1);
  });

  it("bấm đôi khi lượt đầu chưa xong chỉ tạo MỘT đơn", async () => {
    mocks.createOrder.mockReturnValue(new Promise(() => {}));
    render(<PurchaseCta canPurchase />);
    const button = screen.getByRole("button");
    await click(button);
    await click(button);
    expect(mocks.createOrder).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["unauthenticated", "profile.error.sessionExpired"],
    ["rate_limited", "billing.recheck.rateLimited"],
    ["provider_unavailable", "billing.recheck.providerUnavailable"],
    ["server", "billing.orders.loadError"],
  ] as const)("lỗi %s: hiện đúng câu, KHÔNG chuyển trang", async (error, key) => {
    mocks.createOrder.mockResolvedValue({ error });
    render(<PurchaseCta canPurchase />);
    await click(screen.getByRole("button"));
    expect(screen.getByRole("alert").textContent).toBe(t(key));
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("sau một lỗi, bấm lại được và lần sau thành công thì chuyển trang", async () => {
    mocks.createOrder.mockResolvedValueOnce({ error: "rate_limited" });
    mocks.createOrder.mockResolvedValueOnce(CREATED);
    render(<PurchaseCta canPurchase />);
    const button = screen.getByRole("button");
    await click(button);
    await click(button);
    expect(mocks.createOrder).toHaveBeenCalledTimes(2);
    expect(mocks.push).toHaveBeenCalledWith("/pricing/checkout?order=987654");
  });

  it("server ném lỗi: câu chung, không lộ nội dung, không chuyển trang", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createOrder.mockRejectedValue(Object.assign(new Error("secret-key-abc"), { digest: "d-1" }));
    render(<PurchaseCta canPurchase />);
    await click(screen.getByRole("button"));
    expect(screen.getByRole("alert").textContent).toBe(t("billing.orders.loadError"));
    expect(document.body.textContent).not.toContain("secret-key-abc");
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain("secret-key-abc");
    expect(mocks.push).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe("khi chưa mở bán", () => {
  it("aria-disabled, có lý do được nối qua aria-describedby", () => {
    render(<PurchaseCta canPurchase={false} />);
    const button = screen.getByRole("button");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    const reason = document.getElementById(button.getAttribute("aria-describedby") as string);
    expect(reason?.textContent).toBe(t("billing.cta.unavailableReason"));
    expect(reason?.textContent).toContain("chưa mở bán");
  });

  it("bấm KHÔNG tạo đơn và KHÔNG chuyển trang", async () => {
    render(<PurchaseCta canPurchase={false} />);
    await click(screen.getByRole("button"));
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
