// @vitest-environment jsdom

// PaymentConfirm — nút "Tôi đã chuyển khoản — kiểm tra ngay" (AC-039).
//
// Nó bọc RecheckOrderControl: xác nhận đã trả CHÍNH LÀ hỏi lại payOS — lời khẳng
// định của người dùng không phải bằng chứng (ADR-0014). Khi nội dung Điều khoản /
// Hoàn tiền chưa có, nút hiện nhưng KHÔNG làm gì và nói rõ lý do.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "@/lib/copy";

const mocks = vi.hoisted(() => ({ recheckOrder: vi.fn(), refresh: vi.fn() }));

vi.mock("@/lib/billing/orderActions", () => ({ recheckOrder: mocks.recheckOrder }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));

import { PaymentConfirm } from "@/features/billing/components/checkout/PaymentConfirm";

const LABEL = "Tôi đã chuyển khoản — kiểm tra ngay";

beforeEach(() => {
  mocks.recheckOrder.mockReset();
  mocks.refresh.mockReset();
});
afterEach(cleanup);

async function click(button: HTMLElement) {
  await act(async () => {
    fireEvent.click(button);
  });
}

describe("nội dung pháp lý đã sẵn sàng", () => {
  it("bấm nút thì HỎI LẠI nhà cung cấp với đúng mã đơn (không tin lời khẳng định)", async () => {
    mocks.recheckOrder.mockResolvedValue({ settled: false, reason: "not_paid_yet" });
    render(<PaymentConfirm orderCode={555} status="pending" legalContentReady />);
    const button = screen.getByRole("button");
    expect(button.textContent).toContain(LABEL);
    await click(button);
    expect(mocks.recheckOrder).toHaveBeenCalledExactlyOnceWith(555);
    expect(screen.getByRole("alert").textContent).toBe(t("billing.recheck.stillPending"));
  });
});

describe("nội dung pháp lý CHƯA sẵn sàng", () => {
  it("nút hiện nhưng aria-disabled, kèm lý do nối qua aria-describedby", () => {
    render(<PaymentConfirm orderCode={555} status="pending" legalContentReady={false} />);
    const button = screen.getByRole("button");
    expect(button.textContent).toBe(LABEL);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    const reason = document.getElementById(button.getAttribute("aria-describedby") as string);
    expect(reason?.textContent).toBe(t("billing.confirm.legalPending.reason"));
  });

  it("bấm KHÔNG hỏi nhà cung cấp, KHÔNG làm mới trang", async () => {
    render(<PaymentConfirm orderCode={555} status="pending" legalContentReady={false} />);
    await click(screen.getByRole("button"));
    expect(mocks.recheckOrder).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
