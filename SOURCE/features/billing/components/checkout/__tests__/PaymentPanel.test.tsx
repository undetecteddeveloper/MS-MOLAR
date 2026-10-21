// @vitest-environment jsdom

// PaymentPanel — khối dữ liệu của màn thanh toán.
//
// MỘT cổng duy nhất: isPayable() so SÁT `status === "pending"`. Hướng dẫn chuyển
// khoản chỉ hiện khi đơn còn nhận tiền — bày nó cho một đơn đã đóng hoặc trạng
// thái lạ là mời người dùng trả tiền lần hai.

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CheckoutOrder } from "@/lib/billing/checkoutOrder";
import { formatDateTime } from "@/lib/format/datetime";

vi.mock("@/lib/billing/orderActions", () => ({ recheckOrder: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { isPayable, PaymentPanel } from "@/features/billing/components/checkout/PaymentPanel";

afterEach(cleanup);

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

const text = () => document.body.textContent ?? "";

describe("isPayable", () => {
  it("chỉ 'pending' đúng; mọi thứ khác (kể cả sai hoa/thường, rỗng, lạ) là sai", () => {
    expect(isPayable("pending")).toBe(true);
    for (const status of ["paid", "expired", "cancelled", "refunded", "PENDING", " pending", ""]) {
      expect(isPayable(status)).toBe(false);
    }
  });
});

describe("đơn còn nhận tiền (pending)", () => {
  it("hiện mã đơn nguyên si (không nhóm nghìn) và hạn chót tuyệt đối của dòng", () => {
    render(<PaymentPanel order={ORDER} />);
    expect(text()).toContain("Mã đơn");
    expect(text()).toContain("987654");
    expect(text()).not.toContain("987.654");
    expect(text()).toContain(
      `Lệnh thanh toán này có hiệu lực đến ${formatDateTime(ORDER.pendingUntil)}.`
    );
  });

  it("hiện khối chuyển khoản và KHÔNG có nút hỏi lại hay nhãn trạng thái", () => {
    render(<PaymentPanel order={ORDER} />);
    expect(text()).toContain("1903123456");
    expect(text()).toContain("39.000 VNĐ");
    expect(document.querySelector("button")).toBeNull();
    expect(text()).not.toContain("Chờ thanh toán");
  });
});

describe("đơn không còn nhận tiền", () => {
  it.each(["paid", "expired", "cancelled", "refunded"])(
    "%s: KHÔNG bày hướng dẫn chuyển khoản; có nhãn trạng thái, nút hỏi lại, đường về danh sách đơn",
    (status) => {
      const { container } = render(<PaymentPanel order={{ ...ORDER, status }} />);
      expect(text()).not.toContain("1903123456");
      expect(text()).not.toContain("Nội dung chuyển khoản");
      expect(text()).not.toContain("hiệu lực đến");
      expect(container.querySelector("dl")).toBeNull();

      expect(text()).toContain("987654");
      expect(container.querySelector("button")?.textContent).toContain("Kiểm tra lại đơn này");
      expect(container.querySelector('a[href="/profile?tab=plans"]')?.textContent).toBe(
        "Lịch sử mua"
      );
    }
  );

  it("status lạ hiện 'Không xác định' chứ không giả làm trạng thái thật", () => {
    render(<PaymentPanel order={{ ...ORDER, status: "refunded" }} />);
    expect(text()).toContain("Không xác định");
  });
});
